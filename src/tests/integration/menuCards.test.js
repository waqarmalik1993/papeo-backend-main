const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const h = require("./helpers.js");
const t = h.ticketing;
const m = h.menucard;
const User = require("../../services/users/usersService.js");
const Ticketing = require("../../services/ticketing/ticketingShopService");
const TicketingTicket = require("../../services/ticketing/ticketingTicketService");
const Menucard = require("../../services/menuCards/menuCardsService");
const Party = require("../../services/parties/partiesService");
const TicketingTransactions = require("../../services/ticketing/ticketingTransactionService");
const UserTicket = require("../../services/ticketing/ticketingUserTicketService");
const PartyGuest = require("../../services/partyGuests/partyGuestsService");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
const WEBHOOK_CARDS_ENABLED = require("./data/ticketing/cardPaymentsEnabledWebhook");
const WEBHOOK_TRANSFERS_ENABLED = require("./data/ticketing/transfersEnabledWebhook");
const WEBHOOK_PAYMENT_INTENT_SUCCEEDED = require("./data/ticketing/paymentintentSucceeded");
describe("Menucards", function () {
  before(async function () {
    await startServer();
    await h.wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("I can create a menucard", async function () {
    const myUser = await h.createUser();
    const menuCard = await m.createMenucard(myUser).expect(200);
    const menuecardsDb = await Menucard.MODEL.find({ user: myUser._id });
    expect(menuecardsDb.length).to.equal(1);
  });
  it("I can attach a menucard to my party", async function () {
    const myUser = await h.createUser();
    const menuCard = await m.createMenucard(myUser).expect(200);
    const [party, ticket, ticketingShop] =
      await t.createTicketingShopWithTicket(myUser);
    await h
      .patchParty(myUser, party._id, { menuCard: menuCard.body._id })
      .expect(200);
    const partyDb = await Party.MODEL.findById(party._id);
    expect(partyDb.menuCard).to.not.be.null;
    expect(partyDb.menuCard.toString()).to.equal(menuCard.body._id.toString());
  });
  it("I cannot attach a menucard to my party if the owner of the party has no ticketingshop", async function () {
    const myUser = await h.createUser();
    const menuCard = await m.createMenucard(myUser).expect(200);
    const party = await h.createParty(myUser).expect(200);
    expect(
      (
        await h
          .patchParty(myUser, party.body._id, { menuCard: menuCard.body._id })
          .expect(400)
      ).body.data.code
    ).to.be.equal(
      PAPEO_ERRORS.CANNOT_ATTACH_MENUCARD_TO_PARTY_IF_PARTY_HAS_NO_TICKETINGSHOP
        .code
    );
    const partyDb = await Party.MODEL.findById(party.body._id);
    expect(partyDb.menuCard).to.be.null;
  });
  it("I cannot attach a menucard to a party when I am not the owner", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const menuCard = await m.createMenucard(myUser).expect(200);
    const [party, ticket, ticketingShop] =
      await t.createTicketingShopWithTicket(otherUser);
    await h
      .patchParty(myUser, party._id, { menuCard: menuCard._id })
      .expect(403);
    const partyDb = await Party.MODEL.findById(party._id);
    expect(partyDb.menuCard).to.be.null;
  });
  it("I can attach a menucard to a party when I am a partyadmin with the right canManageParty", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const menuCard = await m.createMenucard(myUser).expect(200);
    const [party, ticket, ticketingShop] =
      await t.createTicketingShopWithTicket(otherUser);
    await h.joinParty(party._id, myUser).expect(200);
    await h
      .createPartyAdmin(otherUser, party._id, myUser, {
        rights: {
          canManageParty: true,
          canManageGuestlist: false,
          canManagePartyPhotos: false,
          canBroadcastMessages: false,
          canSeeAdminHistory: false,
        },
      })
      .expect(200);
    await h
      .patchParty(myUser, party._id, { menuCard: menuCard.body._id })
      .expect(200);
    const partyDb = await Party.MODEL.findById(party._id);
    expect(partyDb.menuCard).to.not.be.null;
    expect(partyDb.menuCard.toString()).to.equal(menuCard.body._id.toString());
  });
  it("I can order from a menucard with paymentmethod cash", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const menuCard = await m.createMenucard(myUser).expect(200);
    const [party, ticket, ticketingShop] =
      await t.createTicketingShopWithTicket(myUser);
    await h.joinParty(party._id, myUser).expect(200);
    await h
      .patchParty(myUser, party._id, { menuCard: menuCard.body._id })
      .expect(200);
    console.log(menuCard.body);
    console.log(menuCard.body.categories[0].articles);
    const order = (
      await m
        .orderFromMenucard(otherUser, menuCard.body, {
          party: party._id.toString(),
          paymentMethod: "cash",
          note: "bitte schnell",
          orders: [
            {
              articleId: menuCard.body.categories[0].articles[0]._id,
              quantity: 1,
            },
          ],
        })
        .expect(200)
    ).body.order;

    expect(order.status).to.be.equal("pending");
    expect(order.paymentMethod).to.be.equal("cash");
  });
  it("I can order from a menucard with paymentmethod partyPoints", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser({ partyPoints: 100000 });
    const menuCard = await m.createMenucard(myUser).expect(200);
    const [party, ticket, ticketingShop] =
      await t.createTicketingShopWithTicket(myUser);
    await h.joinParty(party._id, myUser).expect(200);
    await h
      .patchParty(myUser, party._id, { menuCard: menuCard.body._id })
      .expect(200);
    console.log(menuCard.body);
    console.log(menuCard.body.categories[0].articles);
    const order = (
      await m
        .orderFromMenucard(otherUser, menuCard.body, {
          party: party._id.toString(),
          paymentMethod: "partyPoints",
          note: "bitte schnell",
          orders: [
            {
              articleId: menuCard.body.categories[0].articles[0]._id,
              quantity: 1,
            },
          ],
        })
        .expect(200)
    ).body.order;

    expect(order.status).to.be.equal("pending");
    expect(order.paymentMethod).to.be.equal("partyPoints");
  });
  it("Order cannot be successful if I have not enough partyPoints", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser({ partyPoints: 1 });
    const menuCard = await m.createMenucard(myUser).expect(200);
    const [party, ticket, ticketingShop] =
      await t.createTicketingShopWithTicket(myUser);
    await h.joinParty(party._id, myUser).expect(200);
    await h
      .patchParty(myUser, party._id, { menuCard: menuCard.body._id })
      .expect(200);
    console.log(menuCard.body);
    console.log(menuCard.body.categories[0].articles);
    const order = (
      await m
        .orderFromMenucard(otherUser, menuCard.body, {
          party: party._id.toString(),
          paymentMethod: "partyPoints",
          note: "bitte schnell",
          orders: [
            {
              articleId: menuCard.body.categories[0].articles[0]._id,
              quantity: 1,
            },
          ],
        })
        .expect(200)
    ).body.order;

    expect(order.status).to.be.equal("pending");
    expect(order.paymentMethod).to.be.equal("partyPoints");
    expect(
      (await m.acceptOrder(myUser, order).expect(400)).body.data.code
    ).to.be.equal(PAPEO_ERRORS.MENUCARD_ORDER_FAILED_NOT_ENOUGH_PP.code);
    expect(await User.getRaw(otherUser._id)).to.have.property("partyPoints", 1);
  });
  it("I cannot order two times from a menucard with paymentmethod partyPoints when ppPaymentLimited is set to 1", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser({ partyPoints: 100000 });
    const menuCard = await m
      .createMenucard(myUser, { ppPaymentLimited: true, ppPaymentLimit: 1 })
      .expect(200);
    const [party, ticket, ticketingShop] =
      await t.createTicketingShopWithTicket(myUser);
    await h.joinParty(party._id, myUser).expect(200);
    await h
      .patchParty(myUser, party._id, { menuCard: menuCard.body._id })
      .expect(200);
    console.log(menuCard.body);
    console.log(menuCard.body.categories[0].articles);
    const order = (
      await m
        .orderFromMenucard(otherUser, menuCard.body, {
          party: party._id.toString(),
          paymentMethod: "partyPoints",
          note: "bitte schnell",
          orders: [
            {
              articleId: menuCard.body.categories[0].articles[0]._id,
              quantity: 1,
            },
          ],
        })
        .expect(200)
    ).body.order;

    expect(order.status).to.be.equal("pending");
    expect(order.paymentMethod).to.be.equal("partyPoints");

    const secondResult = await m
      .orderFromMenucard(otherUser, menuCard.body, {
        party: party._id.toString(),
        paymentMethod: "partyPoints",
        note: "bitte schnell",
        orders: [
          {
            articleId: menuCard.body.categories[0].articles[0]._id,
            quantity: 1,
          },
        ],
      })
      .expect(400);

    expect(secondResult.body.data.code).to.be.equal(PAPEO_ERRORS.MENUCARD_ORDER_FAILED_PP_ORDER_LIMIT_PER_PARTY_REACHED.code);
  });
});

after(async function () {
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
