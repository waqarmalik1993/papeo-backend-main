const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const h = require("./helpers.js");
const wipeDatabaseAndEmptyS3Bucket =
  require("./helpers.js").wipeDatabaseAndEmptyS3Bucket;

const createJWToken =
  require("../../services/users/usersService.js").createJWToken;
const User = require("../../services/users/usersService.js");
const Party = require("../../services/parties/partiesService.js");
const Bookmark = require("../../services/bookmarks/bookmarksService");
const PartyGuest = require("../../services/partyGuests/partyGuestsService.js");
const Rating = require("../../services/ratings/ratingsService.js");
const MyPartyGuests = require("../../services/myPartyGuests/myPartyGuestsService");
const generateUser = require("./data/getRandomUserData.js").generateUser;
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
describe("/parties", function () {
  before(async () => {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });

  describe("MyPartyGuests", function () {
    it("I can create my party guest but not twice", async () => {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const myPartyGuest = await h
        .createMyPartyGuest(myUser, otherUser)
        .expect(200);

      expect(myPartyGuest.body.user).to.be.equal(myUser._id.toString());
      expect(myPartyGuest.body.guest._id).to.be.equal(otherUser._id.toString());
      expect(myPartyGuest.body.isDeleted).to.be.equal(false);
      const myPartyGuest2 = await h
        .createMyPartyGuest(myUser, otherUser)
        .expect(200);
      await h.createMyPartyGuest(myUser, otherUser).expect(200);
      expect(myPartyGuest2.body.user).to.be.equal(myUser._id.toString());
      expect(myPartyGuest2.body.guest._id).to.be.equal(otherUser._id.toString());
      expect(myPartyGuest2.body.isDeleted).to.be.equal(false);
      expect(
        (await MyPartyGuests.find({ query: { user: myUser._id } })).data.length
      ).to.be.equal(1);
    });
    it("my party guest is created when he joins my party", async () => {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const party = (await h.createParty(myUser)).body;

      await h.joinParty(party._id, otherUser).expect(200);
      expect(
        (
          await MyPartyGuests.find({
            query: { user: myUser._id, guest: otherUser._id },
          })
        ).data.length
      ).to.be.equal(1);
    });
    it("my party guest is created when he joins my private party and is accepted", async () => {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const party = (await h.createParty(myUser, { privacyLevel: "closed" }))
        .body;

      const partyGuest = (await h.joinParty(party._id, otherUser).expect(200))
        .body;
      expect(
        (
          await MyPartyGuests.find({
            query: { user: myUser._id, guest: otherUser._id },
          })
        ).data.length
      ).to.be.equal(0);
      console.log({partyId: party._id, pgId: otherUser._id});
      await h
        .patchPartyGuest(myUser, otherUser, party._id, { status: "attending" })
        .expect(200);
      expect(
        (
          await MyPartyGuests.find({
            query: { user: myUser._id, guest: otherUser._id },
          })
        ).data.length
      ).to.be.equal(1);
    });
    it("I can delete my party guest but not partyguests from other users", async () => {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const myPartyGuest = await h
        .createMyPartyGuest(myUser, otherUser)
        .expect(200);

      expect(myPartyGuest.body.user).to.be.equal(myUser._id.toString());
      expect(myPartyGuest.body.guest._id).to.be.equal(otherUser._id.toString());
      expect(myPartyGuest.body.isDeleted).to.be.equal(false);

      expect(
        (await MyPartyGuests.find({ query: { user: myUser._id } })).data.length
      ).to.be.equal(1);
      await h.deleteMyPartyGuest(otherUser, myPartyGuest.body).expect(403);
      await h.deleteMyPartyGuest(myUser, myPartyGuest.body).expect(200);
      expect(
        (await MyPartyGuests.find({ query: { user: myUser._id } })).data.length
      ).to.be.equal(0);
    });
    it("I can SOFT delete my party guest but not partyguests from other users but not for foreign users", async () => {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();

      const myPartyGuest = await h
        .createMyPartyGuest(myUser, otherUser)
        .expect(200);

      expect(myPartyGuest.body.user).to.be.equal(myUser._id.toString());
      expect(myPartyGuest.body.guest._id).to.be.equal(otherUser._id.toString());
      expect(myPartyGuest.body.isDeleted).to.be.equal(false);

      await h
        .patchMyPartyGuest(otherUser, myPartyGuest.body, { isDeleted: true })
        .expect(403);
      await h
        .patchMyPartyGuest(myUser, myPartyGuest.body, { isDeleted: true })
        .expect(200);

      expect(
        (await MyPartyGuests.find({ query: { user: myUser._id } })).data[0]
          .isDeleted
      ).to.be.equal(true);
    });
    it("my party guest is blub when he joins my party", async () => {
      const myUser = await h.createUser();
      const otherUser = await h.createUser();
    });
  });
});

after(async () => {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
