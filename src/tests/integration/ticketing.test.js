const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const h = require("./helpers.js");
const t = h.ticketing;
const User = require("../../services/users/usersService.js");
const Ticketing = require("../../services/ticketing/ticketingShopService");
const TicketingTicket = require("../../services/ticketing/ticketingTicketService");
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
describe("Ticketing", function () {
  before(async function () {
    await startServer();
    await h.wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("creates an inactive ticketing shop when onboarding route is called", async function () {
    const myUser = await h.createUser();
    let ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
    expect(ticketingShops).to.have.a.lengthOf(0);

    const url = await t.getShopOnboardUrl(myUser).expect(200);
    expect(url.body.onboardingUrl).to.be.a.string("example.com/onboard");
    const stripeAccountId = url.body.stripeAccountId;
    ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
    expect(ticketingShops).to.have.a.lengthOf(1);

    expect(ticketingShops[0].isActive).to.be.false;
    expect(ticketingShops[0].cardPaymentsEnabled).to.be.false;
    expect(ticketingShops[0].transfersEnabled).to.be.false;
    expect(ticketingShops[0].stripeAccountId).to.be.eq(stripeAccountId);
  });
  it("/myaccount route returns only my stripe account", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();

    const url = await t.getShopOnboardUrl(myUser).expect(200);
    await t.getShopOnboardUrl(otherUser).expect(200);
    expect(url.body.onboardingUrl).to.be.a.string("example.com/onboard");
    const stripeAccountId = url.body.stripeAccountId;
    let ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
    expect(ticketingShops).to.have.a.lengthOf(1);

    const myAcc = await t.getMyStripeAccount(myUser);
    const otherAcc = await t.getMyStripeAccount(otherUser);
    console.log(myAcc.body);
    expect(myAcc.body.id).to.be.eq(stripeAccountId);
    expect(myAcc.body.id).to.be.not.eq(otherAcc.body.id);
  });
  describe("Tickets visibility", function () {
    it("I can see a ticket if no visibility constraints are enabled", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();

      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(
          merchant,
          {},
          {
            visibility: {
              hostOnly: false,
              adminsOnly: false,
              friendsOnly: false,
              guestlistOnly: false,
            },
          }
        );
      const tickets = await t.getTickets(myUser, party);
      expect(tickets.body.data).to.have.a.lengthOf(1);
    });
    it("I can only see a ticket if I am an admin and visibility.adminsOnly is enabled", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();

      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(
          merchant,
          {},
          {
            visibility: {
              hostOnly: false,
              adminsOnly: true,
              friendsOnly: false,
              guestlistOnly: false,
            },
          }
        );
      let tickets = await t.getTickets(myUser, party);
      expect(tickets.body.data).to.have.a.lengthOf(0);

      await User.MODEL.updateOne(
        { _id: myUser._id },
        { $set: { isAdmin: true } }
      );
      tickets = await t.getTickets(myUser, party);
      expect(tickets.body.data).to.have.a.lengthOf(1);
    });
    it("I can only see a ticket if I am the owner of the party and visibility.hostOnly is enabled", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();

      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(
          merchant,
          {},
          {
            visibility: {
              hostOnly: true,
              adminsOnly: false,
              friendsOnly: false,
              guestlistOnly: false,
            },
          }
        );
      let tickets = await t.getTickets(myUser, party);
      expect(tickets.body.data).to.have.a.lengthOf(0);

      tickets = await t.getTickets(merchant, party);
      expect(tickets.body.data).to.have.a.lengthOf(1);
    });
    it("I can only see a ticket if I am on the guestlist of the party and visibility.guestlistOnly is enabled", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();

      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(
          merchant,
          {},
          {
            visibility: {
              hostOnly: false,
              adminsOnly: false,
              friendsOnly: false,
              guestlistOnly: true,
            },
          }
        );
      let tickets = await t.getTickets(myUser, party);
      expect(tickets.body.data).to.have.a.lengthOf(0);

      await PartyGuest.create({
        party: party._id,
        user: myUser._id,
        status: "attending",
      });
      tickets = await t.getTickets(myUser, party);
      expect(tickets.body.data).to.have.a.lengthOf(1);
    });
    it("I can only see a ticket if I am a friend of the of the party and visibility.friendsOnly is enabled", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();

      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(
          merchant,
          {},
          {
            visibility: {
              hostOnly: false,
              adminsOnly: false,
              friendsOnly: true,
              guestlistOnly: false,
            },
          }
        );
      let tickets = await t.getTickets(myUser, party);
      expect(tickets.body.data).to.have.a.lengthOf(0);

      await h.sendFriendRequest(myUser, merchant);
      await h.acceptFriendRequest(merchant, myUser);
      tickets = await t.getTickets(myUser, party);
      expect(tickets.body.data).to.have.a.lengthOf(1);
    });
  });
  describe("Tickets", function () {
    it("cannot create a ticket if user has no ticket shop", async function () {
      const myUser = await h.createUser();
      await t.createTicket(myUser, {}).expect(400);
    });
    it("cannot create a ticket if my ticketshop is inactive", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      const stripeAccountId = url.body.stripeAccountId;
      await t
        .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
        .expect(200);
      let ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.false;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.false;
      expect(ticketingShops[0].transfersEnabled).to.be.true;

      const party = await h.createParty(myUser, {}).expect(200);
      const ticket = await t
        .createTicket(myUser, { party: party.body._id, name: "12345" })
        .expect(400);
    });
    it("cannot create a ticket for a party which I am not the owner of", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      const stripeAccountId = url.body.stripeAccountId;

      await t
        .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
        .expect(200);
      await t
        .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
        .expect(200);
      let ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.true;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.true;
      expect(ticketingShops[0].transfersEnabled).to.be.true;

      const party = await h.createParty(otherUser, {}).expect(200);
      const ticket = await t
        .createTicket(myUser, { party: party.body._id, name: "12345" })
        .expect(403);
    });
    it("can create a ticket", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      const stripeAccountId = url.body.stripeAccountId;

      await t
        .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
        .expect(200);
      await t
        .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
        .expect(200);
      let ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.true;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.true;
      expect(ticketingShops[0].transfersEnabled).to.be.true;

      const party = await h.createParty(myUser, {}).expect(200);
      const ticket = await t
        .createTicket(myUser, { party: party.body._id, name: "12345" })
        .expect(200);

      expect(ticket.body.name).to.be.equal("12345");
    });
    it("can patch party.ticketingSettings if I am the owner", async function () {
      const myUser = await h.createUser();
      const party = await h.createParty(myUser);

      await h
        .patchParty(myUser, party.body._id, {
          ticketingSettings: {
            allowExternalSharing: true,
            allowInternalSharing: true,
            limitTicketPurchasesPerUser: false,
            ticketPurchasesPerUser: 0,
            guestlistPurchaseOnly: false,
            boxOffice: false,
          },
        })
        .expect(200);
    });
    it("cannot patch partyticketingSettings if I am a party admin", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();
      const party = await h.createParty(otherUser);
      await h.createPartyAdmin(otherUser, party.body._id, myUser, {
        rights: {
          canManageParty: true,
          canManageGuestlist: true,
          canManagePartyPhotos: true,
          canBroadcastMessages: true,
          canSeeAdminHistory: true,
        },
      });

      await h
        .patchParty(myUser, party.body._id, {
          ticketingSettings: {
            allowExternalSharing: true,
            allowInternalSharing: true,
            limitTicketPurchasesPerUser: false,
            ticketPurchasesPerUser: 0,
            guestlistPurchaseOnly: false,
            boxOffice: false,
          },
        })
        .expect(403);
    });
    describe("Ticket tax and fees calculation", function () {
      it("fees and tax are calculated correctly", async function () {
        expect(
          TicketingTicket.calculatePrice({ net: 1000, taxPerMille: 190 }, 10)
        ).to.deep.equal({
          taxPerMille: 190,
          net: 1000,
          gross: 1190,
          fees: 100,
          tax: 190,
          total: 1290,
        });
        expect(
          TicketingTicket.calculatePrice({ net: 1000, taxPerMille: 190 }, 15)
        ).to.deep.equal({
          taxPerMille: 190,
          net: 1000,
          gross: 1190,
          fees: 150,
          tax: 190,
          total: 1340,
        });
        expect(
          TicketingTicket.calculatePrice({ net: 1234, taxPerMille: 190 }, 10)
        ).to.deep.equal({
          taxPerMille: 190,
          net: 1234,
          gross: 1234 + 234,
          fees: 123,
          tax: 234,
          total: 1234 + 234 + 123,
        });
        expect(
          TicketingTicket.calculatePrice({ net: 1234, taxPerMille: 0 }, 10)
        ).to.deep.equal({
          taxPerMille: 0,
          net: 1234,
          gross: 1234,
          fees: 123,
          tax: 0,
          total: 1234 + 123,
        });
      });
    });
    it("fees and tax are calculated correctly and added to the ticket object", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      const stripeAccountId = url.body.stripeAccountId;

      await t
        .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
        .expect(200);
      await t
        .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
        .expect(200);
      const party = await h.createParty(myUser, {}).expect(200);
      const ticket = await t
        .createTicket(myUser, {
          party: party.body._id,
          price: {
            net: 1234,
            taxPerMille: 190,
          },
        })
        .expect(200);

      expect(ticket.body.price).to.deep.equal({
        taxPerMille: 190,
        net: 1234,
        gross: 1234 + 234,
        fees: 123,
        tax: 234,
        total: 1234 + 234 + 123,
      });
    });
    it("only the ticket owner can patch tickets", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      const stripeAccountId = url.body.stripeAccountId;

      await t
        .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
        .expect(200);
      await t
        .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
        .expect(200);
      const party = await h.createParty(myUser, {}).expect(200);
      const ticket = await t
        .createTicket(myUser, {
          party: party.body._id,
          price: { taxPerMille: 190, net: 1000 },
        })
        .expect(200);

      await t
        .patchTicket(otherUser, ticket.body, {
          price: {
            net: 100,
          },
        })
        .expect(403);
      const ticketDb = await TicketingTicket.get(ticket.body._id);
      expect(ticketDb.price).to.deep.equal({
        taxPerMille: 190,
        net: 1000,
        gross: 1000 + 190,
        fees: 100,
        tax: 190,
        total: 1000 + 190 + 100,
      });
    });
    it("calculateprice endpoint calculates accurate price", async function () {
      const myUser = await h.createUser();
      await t
        .getTicketPrice(myUser, { net: 1000, taxPerMille: -1900 })
        .expect(400);
      await t
        .getTicketPrice(myUser, { net: -1000, taxPerMille: 1900 })
        .expect(400);

      expect(
        (
          await t
            .getTicketPrice(myUser, { net: 1000, taxPerMille: 190 })
            .expect(200)
        ).body
      ).to.deep.equal({
        taxPerMille: 190,
        net: 1000,
        gross: 1000 + 190,
        fees: 100,
        tax: 190,
        total: 1000 + 190 + 100,
      });
      expect(
        (
          await t
            .getTicketPrice(myUser, { net: 1234, taxPerMille: 190 })
            .expect(200)
        ).body
      ).to.deep.equal({
        taxPerMille: 190,
        net: 1234,
        gross: 1234 + 234,
        fees: 123,
        tax: 234,
        total: 1234 + 234 + 123,
      });
    });
    it("fees and tax are updated correctly when ticket net is patched", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      const stripeAccountId = url.body.stripeAccountId;

      await t
        .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
        .expect(200);
      await t
        .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
        .expect(200);
      const party = await h.createParty(myUser, {}).expect(200);
      const ticket = await t
        .createTicket(myUser, {
          party: party.body._id,
          price: {
            net: 1234,
            taxPerMille: 190,
          },
        })
        .expect(200);

      const patchedTicket = await t
        .patchTicket(myUser, ticket.body, {
          price: {
            net: 1000,
          },
        })
        .expect(200);
      expect(patchedTicket.body.price).to.deep.equal({
        taxPerMille: 190,
        net: 1000,
        gross: 1000 + 190,
        fees: 100,
        tax: 190,
        total: 1000 + 190 + 100,
      });
      const ticketDb = await TicketingTicket.get(ticket.body._id);
      expect(ticketDb.price).to.deep.equal({
        taxPerMille: 190,
        net: 1000,
        gross: 1000 + 190,
        fees: 100,
        tax: 190,
        total: 1000 + 190 + 100,
      });
    });
    it("fees and tax are updated correctly when ticket taxPerMille is patched", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      const stripeAccountId = url.body.stripeAccountId;

      await t
        .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
        .expect(200);
      await t
        .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
        .expect(200);
      const party = await h.createParty(myUser, {}).expect(200);
      const ticket = await t
        .createTicket(myUser, {
          party: party.body._id,
          price: {
            net: 1000,
            taxPerMille: 190,
          },
        })
        .expect(200);

      const patchedTicket = await t
        .patchTicket(myUser, ticket.body, {
          price: {
            taxPerMille: 100,
          },
        })
        .expect(200);
      expect(patchedTicket.body.price).to.deep.equal({
        taxPerMille: 100,
        net: 1000,
        gross: 1000 + 100,
        fees: 100,
        tax: 100,
        total: 1000 + 100 + 100,
      });
      const ticketDb = await TicketingTicket.get(ticket.body._id);
      expect(ticketDb.price).to.deep.equal({
        taxPerMille: 100,
        net: 1000,
        gross: 1000 + 100,
        fees: 100,
        tax: 100,
        total: 1000 + 100 + 100,
      });
    });
    it("fees and tax are updated correctly when ticket taxPerMille and net are patched", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      const stripeAccountId = url.body.stripeAccountId;

      await t
        .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
        .expect(200);
      await t
        .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
        .expect(200);
      const party = await h.createParty(myUser, {}).expect(200);
      const ticket = await t
        .createTicket(myUser, {
          party: party.body._id,
          price: {
            net: 1234,
            taxPerMille: 190,
          },
        })
        .expect(200);

      const patchedTicket = await t
        .patchTicket(myUser, ticket.body, {
          price: {
            taxPerMille: 100,
            net: 1000,
          },
        })
        .expect(200);
      expect(patchedTicket.body.price).to.deep.equal({
        taxPerMille: 100,
        net: 1000,
        gross: 1000 + 100,
        fees: 100,
        tax: 100,
        total: 1000 + 100 + 100,
      });
      const ticketDb = await TicketingTicket.get(ticket.body._id);
      expect(ticketDb.price).to.deep.equal({
        taxPerMille: 100,
        net: 1000,
        gross: 1000 + 100,
        fees: 100,
        tax: 100,
        total: 1000 + 100 + 100,
      });
    });
    it.skip("available tickets are decreased", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      expect(url.body.onboardingUrl).to.be.a.string("example.com/onboard");
      const stripeAccountId = url.body.stripeAccountId;
      let ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.false;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.false;
      expect(ticketingShops[0].transfersEnabled).to.be.false;

      await t
        .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
        .expect(200);
      await t
        .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
        .expect(200);
      ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.true;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.true;
      expect(ticketingShops[0].transfersEnabled).to.be.true;

      // other users shop is not enabled
      ticketingShops = await Ticketing.MODEL.find({ user: otherUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.false;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.false;
      expect(ticketingShops[0].transfersEnabled).to.be.false;
    });
  });
  describe("Purchasing tickets", function () {
    it("cannot purchase a ticket if I have no attached stripe user", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();

      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);

      expect(party.owner).to.be.equal(merchant._id.toString());
      expect(ticket.user).to.be.equal(merchant._id.toString());
      expect(ticketingShop.user).to.be.equal(merchant._id.toString());

      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(400);
    });
    it("cannot purchase a paused ticket", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();

      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);

      expect(party.owner).to.be.equal(merchant._id.toString());
      expect(ticket.user).to.be.equal(merchant._id.toString());
      expect(ticketingShop.user).to.be.equal(merchant._id.toString());

      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(200);

      await t.patchTicket(merchant, ticket, { paused: true });
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(400);
    });
    it("cannot purchase a ticket when sellingEndDate from ticket is reached", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();

      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(
          merchant,
          {},
          {
            sellingStartDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
            sellingEndDate: new Date(Date.now() - 1000 * 60 * 60 * 24), // yesterday
          }
        );

      expect(party.owner).to.be.equal(merchant._id.toString());
      expect(ticket.user).to.be.equal(merchant._id.toString());
      expect(ticketingShop.user).to.be.equal(merchant._id.toString());

      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(400);
    });
    it("cannot purchase a ticket when sellingStartDate from ticket not reached yet", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();

      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(
          merchant,
          {},
          {
            sellingStartDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2), // 2 days from now
            sellingEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // 3 days from now
          }
        );

      expect(party.owner).to.be.equal(merchant._id.toString());
      expect(ticket.user).to.be.equal(merchant._id.toString());
      expect(ticketingShop.user).to.be.equal(merchant._id.toString());

      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(400);
    });
    it("cannot purchase a deleted ticket", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();

      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);

      expect(party.owner).to.be.equal(merchant._id.toString());
      expect(ticket.user).to.be.equal(merchant._id.toString());
      expect(ticketingShop.user).to.be.equal(merchant._id.toString());

      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(200);

      await t.deleteTicket(myUser, ticket).expect(403);
      await t.deleteTicket(merchant, ticket).expect(200);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(404);
    });
    it("cannot order 2 tickets from different parties", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();

      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);
      const party2 = (await h.createParty(merchant).expect(200)).body;
      const ticket2 = (
        await h.ticketing
          .createTicket(merchant, {
            party: party2._id,
          })
          .expect(200)
      ).body;

      expect(party2.owner).to.be.equal(merchant._id.toString());
      expect(ticket2.user).to.be.equal(merchant._id.toString());

      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(200);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket2._id,
            quantity: 1,
          },
        ])
        .expect(200);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket2._id,
            quantity: 1,
          },
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(400);
    });
    it("cannot order 2 tickets from different merchants", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      const merchant2 = await h.createUser();

      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);
      const [party2, ticket2, ticketingShop2] =
        await t.createTicketingShopWithTicket(merchant2);

      expect(party2.owner).to.be.equal(merchant2._id.toString());
      expect(ticket2.user).to.be.equal(merchant2._id.toString());
      expect(ticketingShop2.user).to.be.equal(merchant2._id.toString());

      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(200);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket2._id,
            quantity: 1,
          },
        ])
        .expect(200);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket2._id,
            quantity: 1,
          },
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(400);
    });
    describe("Party.ticketingSettings", function () {
      it("I cannot purchase 2 tickets if if limitTicketPurchasesPerUser is enabled and ticketPurchasesPerUser is set to 1", async function () {
        const myUser = await h.createUser();
        const merchant = await h.createUser();

        await User.patch(myUser._id, { stripeCustomerId: "blub" });
        const [party, ticket, ticketingShop] =
          await t.createTicketingShopWithTicket(merchant);

        await t
          .purchaseTickets(myUser, [
            {
              ticketId: ticket._id,
              quantity: 2,
            },
          ])
          .expect(200);

        await h.patchParty(merchant, party._id, {
          ticketingSettings: {
            allowExternalSharing: false,
            allowInternalSharing: false,
            limitTicketPurchasesPerUser: true,
            ticketPurchasesPerUser: 1,
            guestlistPurchaseOnly: false,
            boxOffice: false,
          },
        });
        await t
          .purchaseTickets(myUser, [
            {
              ticketId: ticket._id,
              quantity: 2,
            },
          ])
          .expect(400);
      });
      it.skip("guestlistPurchaseOnly", async function () {});
      describe.skip("Ticket Sharing", function () {
        it.skip("allowExternalSharing", async function () {});
        it.skip("allowInternalSharing", async function () {});
      });
    });
  });
  describe("Party.ticketingSettings", function () {
    it("cannot buy a ticket if guestlistPurchaseOnly is enabled and I am not on the guestlist", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);

      let ticketDb = await TicketingTicket.MODEL.findById(ticket._id);

      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(200);

      await h
        .patchParty(merchant, party._id, {
          ticketingSettings: {
            allowExternalSharing: false,
            allowInternalSharing: false,
            limitTicketPurchasesPerUser: false,
            ticketPurchasesPerUser: 0,
            guestlistPurchaseOnly: true,
            boxOffice: false,
          },
        })
        .expect(200);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(400);
      ticketDb = await TicketingTicket.MODEL.findById(ticket._id);
      expect(ticketDb.availability).to.be.equal(ticket.availability - 1);
      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      expect(transactions).to.have.a.lengthOf(1);
    });
  });
  describe("Webhooks", function () {
    it("sets transfersEnabled Flag to true if webhook capability.updated includes transfers", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      expect(url.body.onboardingUrl).to.be.a.string("example.com/onboard");
      const stripeAccountId = url.body.stripeAccountId;
      let ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.false;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.false;
      expect(ticketingShops[0].transfersEnabled).to.be.false;

      await t
        .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
        .expect(200);
      ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.false;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.false;
      expect(ticketingShops[0].transfersEnabled).to.be.true;

      // other users shop is not enabled
      ticketingShops = await Ticketing.MODEL.find({ user: otherUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.false;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.false;
      expect(ticketingShops[0].transfersEnabled).to.be.false;
    });
    it("sets cardPaymentsEnabled Flag to true if webhook capability.updated includes card payments", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      expect(url.body.onboardingUrl).to.be.a.string("example.com/onboard");
      const stripeAccountId = url.body.stripeAccountId;
      let ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.false;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.false;
      expect(ticketingShops[0].transfersEnabled).to.be.false;

      await t
        .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
        .expect(200);
      ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.false;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.true;
      expect(ticketingShops[0].transfersEnabled).to.be.false;

      // other users shop is not enabled
      ticketingShops = await Ticketing.MODEL.find({ user: otherUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.false;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.false;
      expect(ticketingShops[0].transfersEnabled).to.be.false;
    });
    it("sets active Flag if cardPaymentsEnabled and transfersEnabled flag are true", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const url = await t.getShopOnboardUrl(myUser).expect(200);
      await t.getShopOnboardUrl(otherUser).expect(200);
      expect(url.body.onboardingUrl).to.be.a.string("example.com/onboard");
      const stripeAccountId = url.body.stripeAccountId;
      let ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.false;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.false;
      expect(ticketingShops[0].transfersEnabled).to.be.false;

      await t
        .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
        .expect(200);
      await t
        .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
        .expect(200);
      ticketingShops = await Ticketing.MODEL.find({ user: myUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.true;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.true;
      expect(ticketingShops[0].transfersEnabled).to.be.true;

      // other users shop is not enabled
      ticketingShops = await Ticketing.MODEL.find({ user: otherUser._id });
      expect(ticketingShops).to.have.a.lengthOf(1);
      expect(ticketingShops[0].isActive).to.be.false;
      expect(ticketingShops[0].cardPaymentsEnabled).to.be.false;
      expect(ticketingShops[0].transfersEnabled).to.be.false;
    });
    it("saves transaction into db with status pending and paymentIntentId when purchase route is called", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);

      expect(party.owner).to.be.equal(merchant._id.toString());
      expect(ticket.user).to.be.equal(merchant._id.toString());
      expect(ticketingShop.user).to.be.equal(merchant._id.toString());
      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      expect(transactions).to.have.a.lengthOf(0);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 3,
          },
        ])
        .expect(200);
      transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      const orders = transactions[0].orders;
      expect(transactions).to.have.a.lengthOf(1);
      expect(orders).to.have.a.lengthOf(1);
      expect(orders[0].quantity).to.be.equal(3);
      expect(orders[0].ticket.toString()).to.be.equal(ticket._id.toString());
      expect(transactions[0].status).to.be.equal("pending");
      expect(transactions[0].paymentIntent).to.be.equal("123");
    });
    it("creates pending transaction when purchasing route was called", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);

      let ticketDb = await TicketingTicket.MODEL.findById(ticket._id);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 3,
          },
        ])
        .expect(200);
      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      const orders = transactions[0].orders;
      expect(transactions).to.have.a.lengthOf(1);
      expect(orders).to.have.a.lengthOf(1);
      expect(orders[0].quantity).to.be.equal(3);
      expect(transactions[0].status).to.be.equal("pending");

      const in5min = new Date();
      in5min.setTime(in5min.getTime() + 5 * 60 * 1000);
      expect(transactions[0].expiresAt.getTime()).be.a.closeTo(
        in5min.getTime(),
        200
      );

      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(200);
      transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      expect(transactions[1].expiresAt.getTime()).be.a.closeTo(
        in5min.getTime(),
        200
      );
    });
    it("decreases available ticket count when a payment intent is created", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 50,
          },
        ])
        .expect(200);

      const ticketDb = await TicketingTicket.MODEL.findById(ticket._id);
      expect(ticketDb.availability).to.be.equal(ticket.availability - 50);
    });
    it("cannot buy 101 tickets if availability is 100", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);

      let ticketDb = await TicketingTicket.MODEL.findById(ticket._id);

      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: ticket.availability + 1,
          },
        ])
        .expect(404);

      ticketDb = await TicketingTicket.MODEL.findById(ticket._id);
      expect(ticketDb.availability).to.be.equal(ticket.availability);
      expect(ticketDb.bought).to.be.equal(0);
      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      expect(transactions).to.have.a.lengthOf(0);
    });

    //it.skip("updates transaction when payment_intent.processing webhook was received", async () => {});
    it.skip("releases ticket(s) and invalidates paymentintent if payment_intent.payment_failed webhook was received and pending transaction in ticket is removed", async function () {});
    it("updates transaction to expired if payment intent was not payed within 5 minutes", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 3,
          },
        ])
        .expect(200);

      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      expect(transactions).to.have.a.lengthOf(1);
      expect(transactions[0].status).to.be.equal("pending");
      const in5min = new Date();
      in5min.setTime(in5min.getTime() + 5 * 60 * 1000);
      expect(transactions[0].expiresAt.getTime()).be.a.closeTo(
        in5min.getTime(),
        200
      );
      // should not expire transaction
      await TicketingTransactions.expireTransactions();
      transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      expect(transactions[0].status).to.be.equal("pending");
      // overwrite expiresAt
      await TicketingTransactions.MODEL.updateOne(
        { _id: transactions[0]._id },
        { $set: { expiresAt: new Date() } }
      );
      await TicketingTransactions.expireTransactions();
      transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      expect(transactions[0].status).to.be.equal("expired");
    });
    it("releases ticket(s) when payment intent was not payed within 5 minutes", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 4,
          },
        ])
        .expect(200);
      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      let ticketDb = await TicketingTicket.MODEL.findById(ticket._id);
      expect(ticketDb.availability).to.be.equal(ticket.availability - 4);
      await TicketingTransactions.MODEL.updateOne(
        { _id: transactions[0]._id },
        { $set: { expiresAt: new Date() } }
      );
      await TicketingTransactions.expireTransactions();
      transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      expect(transactions[0].status).to.be.equal("expired");
      ticketDb = await TicketingTicket.MODEL.findById(ticket._id);
      expect(ticketDb.availability).to.be.equal(ticket.availability);
    });
    it.skip("cancels paymentintent if payment intent was not payed within 5 minutes", async function () {});
    it("creates UserTicket if payment intent succeeded", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);

      expect(
        await UserTicket.MODEL.find({ user: myUser._id })
      ).to.have.a.lengthOf(0);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 1,
          },
        ])
        .expect(200);
      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      // send paymentintent.successfull webhook
      await t
        .sendConnectWebhook(
          WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
            accountId: ticketingShop.stripeAccountId,
            transactionId: transactions[0]._id.toString(),
          })
        )
        .expect(200);

      expect(
        await UserTicket.MODEL.find({ user: myUser._id })
      ).to.have.a.lengthOf(1);
    });
    it("creates UserTicket if payment intent succeeded and sets purchasedPrice correctly", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);

      expect(
        await UserTicket.MODEL.find({ user: myUser._id })
      ).to.have.a.lengthOf(0);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 2,
          },
        ])
        .expect(200);
      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      // send paymentintent.successfull webhook
      await t
        .sendConnectWebhook(
          WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
            accountId: ticketingShop.stripeAccountId,
            transactionId: transactions[0]._id.toString(),
          })
        )
        .expect(200);

      const usertickets = await UserTicket.MODEL.find({ user: myUser._id });
      expect(usertickets).to.have.a.lengthOf(2);
      expect(usertickets[0].purchasedPrice).to.be.equal(ticket.price.total);
    });
    it("creates two UserTicket if payment intent succeeded with order quantity 2", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);

      expect(
        await UserTicket.MODEL.find({ user: myUser._id })
      ).to.have.a.lengthOf(0);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 2,
          },
        ])
        .expect(200);
      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      // send paymentintent.successfull webhook
      await t
        .sendConnectWebhook(
          WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
            accountId: ticketingShop.stripeAccountId,
            transactionId: transactions[0]._id.toString(),
          })
        )
        .expect(200);

      expect(
        await UserTicket.MODEL.find({ user: myUser._id })
      ).to.have.a.lengthOf(2);
    });
    it("ticket.bought is increased when order is successfull", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);

      expect(
        await UserTicket.MODEL.find({ user: myUser._id })
      ).to.have.a.lengthOf(0);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 3,
          },
        ])
        .expect(200);
      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      let ticketDb = await TicketingTicket.get(ticket._id);
      expect(ticketDb.bought).to.be.equal(0);
      // send paymentintent.successfull webhook
      await t
        .sendConnectWebhook(
          WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
            accountId: ticketingShop.stripeAccountId,
            transactionId: transactions[0]._id.toString(),
          })
        )
        .expect(200);

      ticketDb = await TicketingTicket.get(ticket._id);
      expect(ticketDb.bought).to.be.equal(3);
    });

    it("cancel party route returns 200", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);
      await t.cancelParty(merchant, party).expect(200);
    });
    it("I cannot cancel a party if I am not the owner", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);
      await t.cancelParty(myUser, party).expect(403);
    });
    it("If I cancel a party all usertickets for this party are refunded=true", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 2,
          },
        ])
        .expect(200);
      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      // send paymentintent.successfull webhook
      await t
        .sendConnectWebhook(
          WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
            accountId: ticketingShop.stripeAccountId,
            transactionId: transactions[0]._id.toString(),
          })
        )
        .expect(200);

      (await UserTicket.MODEL.find({ user: myUser._id })).map((ut) => {
        expect(ut.refunded).to.be.false;
      });
      await t.cancelParty(merchant, party).expect(200);
      (await UserTicket.MODEL.find({ user: myUser._id })).map((ut) => {
        expect(ut.refunded).to.be.true;
      });
    });
    it("If I cancel a party, all transactions have the status refunded", async function () {
      const myUser = await h.createUser();
      const merchant = await h.createUser();
      // mock stripe customer id
      await User.patch(myUser._id, { stripeCustomerId: "blub" });
      const [party, ticket, ticketingShop] =
        await t.createTicketingShopWithTicket(merchant);
      await t
        .purchaseTickets(myUser, [
          {
            ticketId: ticket._id,
            quantity: 2,
          },
        ])
        .expect(200);
      let transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      // send paymentintent.successfull webhook
      await t
        .sendConnectWebhook(
          WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
            accountId: ticketingShop.stripeAccountId,
            transactionId: transactions[0]._id.toString(),
          })
        )
        .expect(200);

      (await UserTicket.MODEL.find({ user: myUser._id })).map((ut) => {
        expect(ut.refunded).to.be.false;
      });
      await t.cancelParty(merchant, party).expect(200);
      transactions = await TicketingTransactions.MODEL.find({
        user: myUser._id,
      });
      transactions.map((trx) => {
        expect(trx.status).to.be.equal("refunded");
      });
    });
    it.skip("I cannot create a ticket if a party was cancelled", async function () {});
    it.skip("I cannot buy a ticket if a party was cancelled", async function () {});
    it.skip("if a ticket is deleted, all transactions for this Ticket are refunded and all UserTickets are updated to refunded=true", async function () {});
    describe("Ticket Sharing", function () {
      it("I can share a userTicket", async function () {
        const myUser = await h.createUser();
        const otherUser = await h.createUser();
        const merchant = await h.createUser();
        // mock stripe customer id
        await User.patch(myUser._id, { stripeCustomerId: "blub" });
        const [party, ticket, ticketingShop] =
          await t.createTicketingShopWithTicket(merchant);
        await t
          .purchaseTickets(myUser, [
            {
              ticketId: ticket._id,
              quantity: 1,
            },
          ])
          .expect(200);
        let transactions = await TicketingTransactions.MODEL.find({
          user: myUser._id,
        });
        // send paymentintent.successfull webhook
        await t
          .sendConnectWebhook(
            WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
              accountId: ticketingShop.stripeAccountId,
              transactionId: transactions[0]._id.toString(),
            })
          )
          .expect(200);

        let [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.sharedWith).to.be.null;
        await t.shareUserTicket(myUser, userTicket, otherUser).expect(200);
        [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.sharedWith.toString()).to.be.eq(
          otherUser._id.toString()
        );
      });
      it("I can decline a shared userTicket", async function () {
        const myUser = await h.createUser();
        const otherUser = await h.createUser();
        const merchant = await h.createUser();
        // mock stripe customer id
        await User.patch(myUser._id, { stripeCustomerId: "blub" });
        const [party, ticket, ticketingShop] =
          await t.createTicketingShopWithTicket(merchant);
        await t
          .purchaseTickets(myUser, [
            {
              ticketId: ticket._id,
              quantity: 1,
            },
          ])
          .expect(200);
        let transactions = await TicketingTransactions.MODEL.find({
          user: myUser._id,
        });
        // send paymentintent.successfull webhook
        await t
          .sendConnectWebhook(
            WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
              accountId: ticketingShop.stripeAccountId,
              transactionId: transactions[0]._id.toString(),
            })
          )
          .expect(200);

        let [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.sharedWith).to.be.null;
        await t.shareUserTicket(myUser, userTicket, otherUser).expect(200);
        [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.sharedWith.toString()).to.be.eq(
          otherUser._id.toString()
        );

        await t.declineSharedUserTicket(otherUser, userTicket).expect(200);
        [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.sharedWith).to.be.eq(null);
      });
      it("I can accept a shared userTicket", async function () {
        const myUser = await h.createUser();
        const otherUser = await h.createUser();
        const merchant = await h.createUser();
        // mock stripe customer id
        await User.patch(myUser._id, { stripeCustomerId: "blub" });
        const [party, ticket, ticketingShop] =
          await t.createTicketingShopWithTicket(merchant);
        await t
          .purchaseTickets(myUser, [
            {
              ticketId: ticket._id,
              quantity: 1,
            },
          ])
          .expect(200);
        let transactions = await TicketingTransactions.MODEL.find({
          user: myUser._id,
        });
        // send paymentintent.successfull webhook
        await t
          .sendConnectWebhook(
            WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
              accountId: ticketingShop.stripeAccountId,
              transactionId: transactions[0]._id.toString(),
            })
          )
          .expect(200);

        let [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.sharedWith).to.be.null;
        await t.shareUserTicket(myUser, userTicket, otherUser).expect(200);
        [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.sharedWith.toString()).to.be.eq(
          otherUser._id.toString()
        );

        await t.acceptSharedUserTicket(otherUser, userTicket).expect(200);
        [userTicket] = await UserTicket.MODEL.find({ user: otherUser._id });
        expect(userTicket.user.toString()).to.be.eq(otherUser._id.toString());
        expect(userTicket.sharedWith).to.be.eq(null);
      });
      it("I cannot accept a shared userTicket which is not shared with me", async function () {
        const myUser = await h.createUser();
        const otherUser = await h.createUser();
        const otherUser2 = await h.createUser();
        const merchant = await h.createUser();
        // mock stripe customer id
        await User.patch(myUser._id, { stripeCustomerId: "blub" });
        const [party, ticket, ticketingShop] =
          await t.createTicketingShopWithTicket(merchant);
        await t
          .purchaseTickets(myUser, [
            {
              ticketId: ticket._id,
              quantity: 1,
            },
          ])
          .expect(200);
        let transactions = await TicketingTransactions.MODEL.find({
          user: myUser._id,
        });
        // send paymentintent.successfull webhook
        await t
          .sendConnectWebhook(
            WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
              accountId: ticketingShop.stripeAccountId,
              transactionId: transactions[0]._id.toString(),
            })
          )
          .expect(200);

        let [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.sharedWith).to.be.null;
        await t.shareUserTicket(myUser, userTicket, otherUser).expect(200);
        [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.sharedWith.toString()).to.be.eq(
          otherUser._id.toString()
        );

        await t.acceptSharedUserTicket(otherUser2, userTicket).expect(403);
        [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.user.toString()).to.be.eq(myUser._id.toString());
        expect(userTicket.sharedWith.toString()).to.be.eq(
          otherUser._id.toString()
        );
      });
      it("I cannot decline a shared userTicket which is not shared with me", async function () {
        const myUser = await h.createUser();
        const otherUser = await h.createUser();
        const otherUser2 = await h.createUser();
        const merchant = await h.createUser();
        // mock stripe customer id
        await User.patch(myUser._id, { stripeCustomerId: "blub" });
        const [party, ticket, ticketingShop] =
          await t.createTicketingShopWithTicket(merchant);
        await t
          .purchaseTickets(myUser, [
            {
              ticketId: ticket._id,
              quantity: 1,
            },
          ])
          .expect(200);
        let transactions = await TicketingTransactions.MODEL.find({
          user: myUser._id,
        });
        // send paymentintent.successfull webhook
        await t
          .sendConnectWebhook(
            WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
              accountId: ticketingShop.stripeAccountId,
              transactionId: transactions[0]._id.toString(),
            })
          )
          .expect(200);

        let [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.sharedWith).to.be.null;
        await t.shareUserTicket(myUser, userTicket, otherUser).expect(200);
        [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.sharedWith.toString()).to.be.eq(
          otherUser._id.toString()
        );

        await t.declineSharedUserTicket(otherUser2, userTicket).expect(403);
        [userTicket] = await UserTicket.MODEL.find({ user: myUser._id });
        expect(userTicket.user.toString()).to.be.eq(myUser._id.toString());
        expect(userTicket.sharedWith.toString()).to.be.eq(
          otherUser._id.toString()
        );
      });
    });
  });
});

after(async function () {
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
