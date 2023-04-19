const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const h = require("./helpers.js");
const t = h.ticketing;
const User = require("../../services/users/usersService.js");
const Party = require("../../services/parties/partiesService");
const Ticketing = require("../../services/ticketing/ticketingShopService");
const TicketingTicket = require("../../services/ticketing/ticketingTicketService");
const TicketingTransactions = require("../../services/ticketing/ticketingTransactionService");
const UserTicket = require("../../services/ticketing/ticketingUserTicketService");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
const WEBHOOK_CARDS_ENABLED = require("./data/ticketing/cardPaymentsEnabledWebhook");
const WEBHOOK_TRANSFERS_ENABLED = require("./data/ticketing/transfersEnabledWebhook");
const WEBHOOK_PAYMENT_INTENT_SUCCEEDED = require("./data/ticketing/paymentintentSucceeded");
describe("Staff", function () {
  before(async function () {
    await startServer();
    await h.wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("I cannot create staff when I am not the owner of the party", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();

    const party = (await h.createParty(myUser).expect(200)).body;

    expect(party.staff).to.have.a.lengthOf(0);
    await h.createPartyStaff(otherUser, party, otherUser2).expect(400);
    await h.createPartyStaff(otherUser, party, otherUser).expect(400);
    await h.createPartyStaff(otherUser, party, myUser).expect(400);

    expect((await Party.get(party._id)).staff).to.have.a.lengthOf(0);
  });
  it("I can create staff but not twice", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();

    const party = (await h.createParty(myUser).expect(200)).body;
    await h.createPartyStaff(myUser, party, otherUser).expect(200);
    await h.createPartyStaff(myUser, party, otherUser).expect(200);

    expect((await Party.get(party._id)).staff).to.have.a.lengthOf(1);
  });
  it("I cannot patch staff if I am not the owner of the party", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();

    const party = (await h.createParty(myUser).expect(200)).body;
    await h
      .createPartyStaff(myUser, party, otherUser, {
        responsibility: "test",
        rights: {
          canScanTickets: true,
          canScanOrders: false,
        },
      })
      .expect(200);

    await h
      .patchPartyStaff(otherUser, party, otherUser, {
        responsibility: "Pizza essen",
        rights: { canScanTickets: false },
      })
      .expect(400);

    let staff = (await Party.get(party._id)).staff;
    expect(staff).to.have.a.lengthOf(1);
    expect(staff[0].responsibility).to.be.equal("test");
    expect(staff[0].rights.canScanTickets).to.be.true;
    expect(staff[0].rights.canScanOrders).to.be.false;
  });
  it("I can patch staff", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();

    const party = (await h.createParty(myUser).expect(200)).body;
    await h
      .createPartyStaff(myUser, party, otherUser, {
        responsibility: "test",
        rights: {
          canScanTickets: true,
          canScanOrders: false,
        },
      })
      .expect(200);
    let staff = (await Party.get(party._id)).staff;
    expect(staff).to.have.a.lengthOf(1);
    expect(staff[0].responsibility).to.be.equal("test");
    expect(staff[0].rights.canScanTickets).to.be.true;
    expect(staff[0].rights.canScanOrders).to.be.false;

    await h
      .patchPartyStaff(myUser, party, otherUser, {
        responsibility: "Pizza essen",
        rights: { canScanTickets: false },
      })
      .expect(200);

    staff = (await Party.get(party._id)).staff;
    expect(staff).to.have.a.lengthOf(1);
    expect(staff[0].responsibility).to.be.equal("Pizza essen");
    expect(staff[0].rights.canScanTickets).to.be.false;
    expect(staff[0].rights.canScanOrders).to.be.false;
  });
  describe("Ticket scanning", function () {
    it("I cannot scan a ticket if I am not a staff member", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      let [party, ticket, ticketingShop, userTicket] =
        await t.createTicketingShopWithTicketAndBuyTicket(merchant, myUser);
      expect(userTicket.checkedIn).to.be.false;
      await t.scanUserTicket(otherUser, userTicket).expect(403);
      [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
      expect(userTicket.checkedIn).to.be.false;
    });
    it("I cannot scan a ticket if I dont have the staff right canScanTickets", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      let [party, ticket, ticketingShop, userTicket] =
        await t.createTicketingShopWithTicketAndBuyTicket(merchant, myUser);
      await h
        .createPartyStaff(merchant, party, otherUser, {
          responsibility: "test",
          rights: {
            canScanTickets: false,
            canScanOrders: true,
          },
        })
        .expect(200);
      await t.scanUserTicket(otherUser, userTicket).expect(403);
      [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
      expect(userTicket.checkedIn).to.be.false;
    });
    it("I can scan a ticket if I have the staff right canScanTickets but not twice", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      let [party, ticket, ticketingShop, userTicket] =
        await t.createTicketingShopWithTicketAndBuyTicket(merchant, myUser);
      await h
        .createPartyStaff(merchant, party, otherUser, {
          responsibility: "test",
          rights: {
            canScanTickets: true,
            canScanOrders: false,
          },
        })
        .expect(200);
      console.log;
      await t.scanUserTicket(otherUser, userTicket).expect(200);
      [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
      expect(userTicket.checkedIn).to.be.true;
      await t.scanUserTicket(otherUser, userTicket).expect(400);
      [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
      expect(userTicket.checkedIn).to.be.true;
    });
    it("I cannot scan a ticket if I am a staff member of another party", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();
      const merchant = await h.createUser();
      const merchant2 = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      let [party, ticket, ticketingShop, userTicket] =
        await t.createTicketingShopWithTicketAndBuyTicket(merchant, myUser);
      let [party2, ticket2, ticketingShop2, userTicket2] =
        await t.createTicketingShopWithTicketAndBuyTicket(merchant, myUser);
      await h
        .createPartyStaff(merchant, party, otherUser, {
          responsibility: "test",
          rights: {
            canScanTickets: true,
            canScanOrders: false,
          },
        })
        .expect(200);

      await t.scanUserTicket(otherUser, userTicket).expect(200);
      [userTicket, userTicket2] = await UserTicket.MODEL.find({
        user: myUser._id,
      });
      expect(userTicket.checkedIn).to.be.true;
      expect(userTicket2.checkedIn).to.be.false;
      await t.scanUserTicket(otherUser, userTicket2).expect(403);
      [userTicket, userTicket2] = await UserTicket.MODEL.find({
        user: myUser._id,
      });
      expect(userTicket.checkedIn).to.be.true;
      expect(userTicket2.checkedIn).to.be.false;
    });
  });
});

after(async function () {
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
