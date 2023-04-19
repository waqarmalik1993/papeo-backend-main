const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const User = require("../../services/users/usersService.js");
const Upload = require("../../services/uploads/uploadsService.js");
const Party = require("../../services/parties/partiesService.js");
const PartyGuest = require("../../services/partyGuests/partyGuestsService");
const Post = require("../../services/posts/postsService.js");
const Report = require("../../services/reports/reportsService.js");
const UserTicket = require("../../services/ticketing/ticketingUserTicketService");
const { Types } = require("mongoose");
const expect = require("chai").expect;
const { generateUserTicket } = require("./data/getRandomUserTicketData");
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
//S3.deleteObjects({Bucket: "papeo-test",Delete:})
const h = require("./helpers.js");
const startServer = require("../../app").startServer;
describe("/parties/:partyId/admins", function () {
  before(async function () {
    await startServer();
    await h.wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });

  it("can create an party admin", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const partyId = (
      await h.createParty(myUser, {
        name: "test",
        privacyLevel: "open",
        capacity: 10,
      })
    ).body._id;
    await h.joinParty(partyId, otherUser).expect(200);
    const res = await h
      .createPartyAdmin(myUser, partyId, otherUser, {
        rights: {
          canManageParty: true,
          canManageGuestlist: true,
          canManagePartyPhotos: true,
          canBroadcastMessages: true,
          canSeeAdminHistory: true,
        },
      })
      .expect(200);

    const databaseParty = await Party.get(partyId);
    expect(databaseParty.admins).to.have.a.lengthOf(1);
    expect(databaseParty.admins[0].user.toString()).to.be.equal(
      otherUser._id.toString()
    );
  });
  it("only users on the guestlist can be party admins", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const partyId = (await h.createParty(myUser, { name: "test" })).body._id;

    const res = await h
      .createPartyAdmin(myUser, partyId, otherUser, {
        rights: {
          canManageParty: true,
          canManageGuestlist: true,
          canManagePartyPhotos: true,
          canBroadcastMessages: true,
          canSeeAdminHistory: true,
        },
      })
      .expect(400);
    expect(res.body.data.code).to.be.equal(
      PAPEO_ERRORS.ONLY_USER_ON_THE_GUESTLIST_CAN_BE_ADMINS.code
    );
    const databaseParty = await Party.get(partyId);
    expect(databaseParty.admins).to.have.a.lengthOf(0);
  });
  it("only the party owner can create party admins", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const partyId = (
      await h.createParty(otherUser, {
        name: "test",
        privacyLevel: "open",
        capacity: 10,
      })
    ).body._id;
    await h.joinParty(partyId, otherUser2).expect(200);
    const res = await h
      .createPartyAdmin(myUser, partyId, otherUser2, {
        rights: {
          canManageParty: true,
          canManageGuestlist: true,
          canManagePartyPhotos: true,
          canBroadcastMessages: true,
          canSeeAdminHistory: true,
        },
      })
      .expect(400);
    expect(res.body.data.code).to.be.equal(
      PAPEO_ERRORS.ONLY_PARTY_OWNERS_CAN_ADD_ADMINS.code
    );
    const databaseParty = await Party.get(partyId);
    expect(databaseParty.admins).to.have.a.lengthOf(0);
  });
  it("can delete an party admin", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const partyId = (
      await h.createParty(myUser, {
        name: "test",
        privacyLevel: "open",
        capacity: 10,
      })
    ).body._id;
    await h.joinParty(partyId, otherUser).expect(200);
    await h
      .createPartyAdmin(myUser, partyId, otherUser, {
        rights: {
          canManageParty: true,
          canManageGuestlist: true,
          canManagePartyPhotos: true,
          canBroadcastMessages: true,
          canSeeAdminHistory: true,
        },
      })
      .expect(200);
    const res = await h
      .deletePartyAdmin(myUser, partyId, otherUser)
      .expect(200);
    const databaseParty = await Party.get(partyId);
    expect(databaseParty.admins).to.have.a.lengthOf(0);
  });
  it("can patch an party admin", async function () {
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const partyId = (
      await h.createParty(myUser, {
        name: "test",
        privacyLevel: "open",
        capacity: 10,
      })
    ).body._id;
    await h.joinParty(partyId, otherUser).expect(200);
    await h.joinParty(partyId, otherUser2).expect(200);
    await h.joinParty(partyId, otherUser3).expect(200);
    await h
      .createPartyAdmin(myUser, partyId, otherUser, {
        rights: {
          canManageParty: true,
          canManageGuestlist: true,
          canManagePartyPhotos: true,
          canBroadcastMessages: false,
          canSeeAdminHistory: false,
        },
      })
      .expect(200);
    const user3Rights = {
      canManageParty: true,
      canManageGuestlist: true,
      canManagePartyPhotos: true,
      canBroadcastMessages: false,
      canSeeAdminHistory: false,
    };
    await h
      .createPartyAdmin(myUser, partyId, otherUser3, {
        rights: user3Rights,
      })
      .expect(200);
    const newRights = {
      canManageParty: false,
      canManageGuestlist: true,
      canManagePartyPhotos: true,
      canBroadcastMessages: false,
      canSeeAdminHistory: true,
    };
    await h
      .patchPartyAdmin(myUser, partyId, otherUser, {
        rights: newRights,
      })
      .expect(200);

    const databaseParty = await Party.get(partyId);
    expect(databaseParty.admins).to.have.a.lengthOf(2);
    expect(
      databaseParty.admins.find(
        (pa) => pa.user.toString() === otherUser._id.toString()
      ).rights
    ).to.deep.equal(newRights);
    expect(
      databaseParty.admins.find(
        (pa) => pa.user.toString() === otherUser3._id.toString()
      ).rights
    ).to.deep.equal(user3Rights);
  });
  describe("Party Admin: MANAGE PARTY", function () {
    it("party admin can MANAGE PARTY", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();
      const otherUser2 = await h.createUser();
      const otherUser3 = await h.createUser();
      const partyId = (
        await h.createParty(myUser, {
          name: "test",
          privacyLevel: "open",
          capacity: 10,
        })
      ).body._id;
      await h.joinParty(partyId, otherUser).expect(200);
      await h.joinParty(partyId, otherUser2).expect(200);
      await h.joinParty(partyId, otherUser3).expect(200);
      await h
        .createPartyAdmin(myUser, partyId, otherUser, {
          rights: {
            canManageParty: false,
            canManageGuestlist: false,
            canManagePartyPhotos: false,
            canBroadcastMessages: false,
            canSeeAdminHistory: false,
          },
        })
        .expect(200);

      let res = await h
        .patchParty(otherUser, partyId, {
          description: "blub",
        })
        .expect(403);
      expect(res.body.data.code).to.be.equal(PAPEO_ERRORS.WRONG_USER_ROLE.code);
      const newRights = {
        canManageParty: true,
        canManageGuestlist: false,
        canManagePartyPhotos: false,
        canBroadcastMessages: false,
        canSeeAdminHistory: false,
      };
      await h
        .patchPartyAdmin(myUser, partyId, otherUser, {
          rights: newRights,
        })
        .expect(200);
      res = await h
        .patchParty(otherUser, partyId, {
          description: "blub",
        })
        .expect(200);
    });
  });
  describe("Party Admin: MANAGE Guestlist", function () {
    it.skip("TODO- party admin can MANAGE Guestlist - guestlist", async function () {});
    it("party admin can MANAGE Guestlist - hasPaid and onSite", async function () {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();
      const otherUser2 = await h.createUser();
      const otherUser3 = await h.createUser();
      const partyId = (
        await h.createParty(myUser, {
          name: "test",
          privacyLevel: "open",
          capacity: 10,
        })
      ).body._id;
      await h.joinParty(partyId, otherUser).expect(200);
      await h.joinParty(partyId, otherUser2).expect(200);
      await h.joinParty(partyId, otherUser3).expect(200);
      await h
        .createPartyAdmin(myUser, partyId, otherUser, {
          rights: {
            canManageParty: false,
            canManageGuestlist: false,
            canManagePartyPhotos: false,
            canBroadcastMessages: false,
            canSeeAdminHistory: false,
          },
        })
        .expect(200);

      let res = await h
        .patchPartyGuest(otherUser, otherUser3, partyId, {
          onSite: "yes",
          hasPaid: false,
        })
        .expect(403);
      expect(res.body.data.code).to.be.equal(PAPEO_ERRORS.WRONG_USER_ROLE.code);
      const newRights = {
        canManageParty: false,
        canManageGuestlist: true,
        canManagePartyPhotos: false,
        canBroadcastMessages: false,
        canSeeAdminHistory: false,
      };
      await h
        .patchPartyAdmin(myUser, partyId, otherUser, {
          rights: newRights,
        })
        .expect(200);
      res = await h
        .patchPartyGuest(otherUser, otherUser3, partyId, {
          onSite: "yes",
          hasPaid: true,
        })
        .expect(200);
      const partyGuest = await PartyGuest.MODEL.find({ user: otherUser3._id });
      console.log(partyGuest);
      expect(partyGuest[0].onSite).to.be.equal("yes");
      expect(partyGuest[0].hasPaid).to.be.equal(true);
    });
  });
  const ALL_COLOR_GROUPS = [
    "default",
    "primary",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
  ];
  describe("Party broadcast messages", function () {
    it.skip("TODO- party admin can MANAGE Guestlist - guestlist", async function () {});
    it("I can broadcast a message if I a the owner of the party", async function () {
      const myUser = await h.createUser();
      const partyOwner = await h.createUser();
      const [party, partyGuests] = await h.createPartyWith10PartyGuests(
        partyOwner
      );
      const result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(10);
    });
    it("I can broadcast a message if I am a party admin of the party", async function () {
      const myUser = await h.createUser();
      const partyOwner = await h.createUser();

      const [party, partyGuests] = await h.createPartyWith10PartyGuests(
        partyOwner
      );
      await h
        .broadcastMessage(myUser, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          genders: ["male", "female", "diverse"],
        })
        .expect(403);
      await h.joinParty(party._id, myUser).expect(200);
      await h
        .createPartyAdmin(partyOwner, party._id, myUser, {
          rights: {
            canManageParty: false,
            canManageGuestlist: false,
            canManagePartyPhotos: false,
            canBroadcastMessages: true,
            canSeeAdminHistory: false,
          },
        })
        .expect(200);
      const result = await h
        .broadcastMessage(myUser, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(11);
    });
    it("Broadcast colorGroup filter", async function () {
      const myUser = await h.createUser();
      const partyOwner = await h.createUser();

      const [party, partyGuests] = await h.createPartyWith10PartyGuests(
        partyOwner
      );

      // default colorGroup is "default"

      let result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ["default"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(10);

      async function setColorGroup(partyGuestId, colorGroup) {
        await PartyGuest.MODEL.updateOne({ _id: partyGuestId }, { colorGroup });
      }
      console.log(partyGuests[0]);
      await Promise.all([
        setColorGroup(partyGuests[0].partyGuest, "primary"),
        setColorGroup(partyGuests[1].partyGuest, "yellow"),
        setColorGroup(partyGuests[2].partyGuest, "green"),
        setColorGroup(partyGuests[3].partyGuest, "blue"),
        setColorGroup(partyGuests[4].partyGuest, "purple"),
        setColorGroup(partyGuests[5].partyGuest, "pink"),
        setColorGroup(partyGuests[6].partyGuest, "primary"),
        setColorGroup(partyGuests[7].partyGuest, "yellow"),
        setColorGroup(partyGuests[8].partyGuest, "green"),
        setColorGroup(partyGuests[9].partyGuest, "blue"),
      ]);

      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ["yellow"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(2);

      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ["yellow", "primary"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(4);

      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ["default"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(0);

      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: [
            "default",
            "primary",
            "yellow",
            "green",
            "blue",
            "purple",
            "pink",
          ],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(10);
    });
    it("Broadcast filter all", async function () {
      const myUser = await h.createUser();
      const partyOwner = await h.createUser();

      const [party, partyGuests] = await h.createPartyWith10PartyGuests(
        partyOwner
      );
      let result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(10);

      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          filter: ["all"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(10);
    });
    it("Broadcast paid", async function () {
      const myUser = await h.createUser();
      const partyOwner = await h.createUser();

      const [party, partyGuests] = await h.createPartyWith10PartyGuests(
        partyOwner
      );
      let result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(10);

      async function patchPg(partyGuestId, data) {
        await PartyGuest.MODEL.updateOne({ _id: partyGuestId }, data);
      }
      await Promise.all([
        patchPg(partyGuests[0].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[1].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[2].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[3].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[4].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[5].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[6].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[7].partyGuest, { hasPaid: false, onSite: "yes" }),
        patchPg(partyGuests[8].partyGuest, { hasPaid: false, onSite: "yes" }),
        patchPg(partyGuests[9].partyGuest, { hasPaid: false, onSite: "yes" }),
      ]);
      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          filter: ["paid"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(7);
    });
    it("Broadcast on_site", async function () {
      const myUser = await h.createUser();
      const partyOwner = await h.createUser();

      const [party, partyGuests] = await h.createPartyWith10PartyGuests(
        partyOwner
      );
      let result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(10);

      async function patchPg(partyGuestId, data) {
        await PartyGuest.MODEL.updateOne({ _id: partyGuestId }, data);
      }
      await Promise.all([
        patchPg(partyGuests[0].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[1].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[2].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[3].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[4].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[5].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[6].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[7].partyGuest, { hasPaid: false, onSite: "yes" }),
        patchPg(partyGuests[8].partyGuest, { hasPaid: false, onSite: "yes" }),
        patchPg(partyGuests[9].partyGuest, { hasPaid: false, onSite: "yes" }),
      ]);
      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          filter: ["on_site"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(3);
    });
    it("Broadcast on_site and paid combination", async function () {
      const myUser = await h.createUser();
      const partyOwner = await h.createUser();

      const [party, partyGuests] = await h.createPartyWith10PartyGuests(
        partyOwner
      );
      let result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(10);

      async function patchPg(partyGuestId, data) {
        await PartyGuest.MODEL.updateOne({ _id: partyGuestId }, data);
      }
      await Promise.all([
        patchPg(partyGuests[0].partyGuest, { hasPaid: true, onSite: "yes" }),
        patchPg(partyGuests[1].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[2].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[3].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[4].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[5].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[6].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[7].partyGuest, { hasPaid: false, onSite: "yes" }),
        patchPg(partyGuests[8].partyGuest, { hasPaid: false, onSite: "yes" }),
        patchPg(partyGuests[9].partyGuest, { hasPaid: true, onSite: "yes" }),
      ]);
      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          filter: ["on_site", "paid"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(2);
    });
    it("Broadcast without_ticket and with_ticket", async function () {
      const myUser = await h.createUser();
      const partyOwner = await h.createUser();

      const [party, partyGuests] = await h.createPartyWith10PartyGuests(
        partyOwner
      );
      let result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(10);

      async function patchPg(partyGuestId, data) {
        await PartyGuest.MODEL.updateOne({ _id: partyGuestId }, data);
      }
      await Promise.all([
        patchPg(partyGuests[0].partyGuest, { hasPaid: true, onSite: "yes" }),
        patchPg(partyGuests[1].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[2].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[3].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[4].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[5].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[6].partyGuest, { hasPaid: true }),
        patchPg(partyGuests[7].partyGuest, { hasPaid: false, onSite: "yes" }),
        patchPg(partyGuests[8].partyGuest, { hasPaid: false, onSite: "yes" }),
        patchPg(partyGuests[9].partyGuest, { hasPaid: true, onSite: "yes" }),
      ]);
      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          filter: ["without_ticket"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      async function mockUserTicket(partyGuest, party) {
        return await UserTicket.MODEL.create({
          ...generateUserTicket(),
          user: partyGuest.user,
          party: party._id,
        });
      }
      expect(result.body).to.have.a.lengthOf(10);

      await mockUserTicket(partyGuests[0], party);
      await mockUserTicket(partyGuests[1], party);
      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          filter: ["without_ticket"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(8);

      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          filter: ["with_ticket"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(2);
      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          filter: ["all", "with_ticket"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(2);
      result = await h
        .broadcastMessage(partyOwner, party, {
          message: "blub",
          colorGroups: ALL_COLOR_GROUPS,
          filter: ["all", "with_ticket", "without_ticket"],
          genders: ["male", "female", "diverse"],
        })
        .expect(200);
      expect(result.body).to.have.a.lengthOf(0);
    });
  });
  it("TODO: party admin can MANAGE PARTYPHOTOS", async function () {});
  it("TODO: party admin can BROADCAST MESSAGES", async function () {});
  it("TODO: party admin can CAN SEE ADMIN HISTORY", async function () {});
});

after(async function () {
  if (process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
