const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const getPartyGuests = require("./helpers.js").getPartyGuests;
const getMyBookmarks = require("./helpers.js").getMyBookmarks;
const bookmarkParty = require("./helpers.js").bookmarkParty;
const joinParty = require("./helpers.js").joinParty;
const rateParty = require("./helpers.js").rateParty;
const patchRating = require("./helpers.js").patchRating;
const createParty = require("./helpers.js").createParty;
const createUser = require("./helpers.js").createUser;
const deleteBookmark = require("./helpers.js").deleteBookmark;
const getRatings = require("./helpers.js").getRatings;
const wipeDatabaseAndEmptyS3Bucket =
  require("./helpers.js").wipeDatabaseAndEmptyS3Bucket;
const deleteParty = require("./helpers.js").deleteParty;
const deletePartyAdmin = require("./helpers.js").deletePartyAdmin;
const checkForSensitiveData = require("./helpers.js").checkForSensitiveData;
const h = require("./helpers.js");
const createJWToken =
  require("../../services/users/usersService.js").createJWToken;
const User = require("../../services/users/usersService.js");
const Activity = require("../../services/activities/activitiesService");
const Party = require("../../services/parties/partiesService.js");
const Bookmark = require("../../services/bookmarks/bookmarksService");
const PartyGuest = require("../../services/partyGuests/partyGuestsService.js");
const Rating = require("../../services/ratings/ratingsService.js");
const generateUser = require("./data/getRandomUserData.js").generateUser;
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
describe("/parties", function () {
  before(async function () {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("TODO if party is private, location withing 1km", async function () {});
  it("TODO accepted guest see the exact location", async function () {});
  it("TODO limit party creation to the current subscription", async function () {
    /*
    Limits: Es gibt für Standardmitglieder und PartyKing Mitglieder unterschiedliche Limits, wieviele Partys gleichzeitig erstellt werden können. Die Anzahl maximal möglicher erstellbarer Partys findet der Nutzer im Bildschirm zur Mitgliedschaft (36- Membership). Sind maximal 3 private Partys möglich, bedeutet das, dass du 3 aktive private Partys haben kannst. Du kannst jedoch beliebig viele Entwürfe für private Partys erstellen. Wurde eine der aktiven Partys gelöscht oder ist diese abgelaufen, so kann eine neue private Party aktiviert werden.
    */
  });
  it("can create a party", async function () {
    const myUser = await createUser();
    const r = await createParty(myUser, { name: "Test Party" }).expect(200);
    checkForSensitiveData(r.body);
    expect(r.body.name).to.be.string("Test Party");
  });
  it("created party is a draft and owner is myself", async function () {
    const myUser = await createUser();
    const partyId = (
      await createParty(myUser, { name: "Test Party", status: "draft" }).expect(
        200
      )
    ).body._id;
    const r = await request(app)
      .get(`/parties/${partyId.toString()}`)
      .set("Authorization", myUser.TOKEN)
      .expect(200);

    expect(r.body.status).to.be.string("draft");
    expect(r.body.owner._id).to.be.string(myUser._id.toString());
  });
  describe("Ratings", function () {
    it("can not rate my own party", async function () {
      const myUser = await createUser();
      const partyId = (
        await createParty(myUser, { name: "Test Party" }).expect(200)
      ).body._id;
      const r = await rateParty(partyId, myUser, 5).expect(400);
      checkForSensitiveData(r.body);
      expect(r.body.data.code).to.be.eq(
        PAPEO_ERRORS.YOU_CANNOT_RATE_YOUR_OWN_PARTY.code
      );
    });
    it("cannot rate a party that doesnt exists", async function () {
      const myUser = await createUser();
      const r = await request(app)
        .post("/parties/000000000000000000000000/ratings")
        .set("Authorization", myUser.TOKEN)
        .send({
          value: 5,
          comment: "top 🥳🎉",
        })
        .expect(404);
    });
    it("can rate a party but not twice", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const r = await createParty(otherUser, { name: "Test Party" }).expect(
        200
      );
      const partyId = r.body._id;
      await joinParty(partyId, myUser);
      const r2 = await rateParty(partyId, myUser, 5).expect(200);
      checkForSensitiveData(r2.body);
      const r3 = await rateParty(partyId, myUser, 5).expect(400);
      expect(r3.body.data.code).to.be.eq(PAPEO_ERRORS.PARTY_ALREADY_RATED.code);
    });
    it("cannot delete rating from another user", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const party = (await createParty(myUser, { name: "test" }).expect(200))
        .body;
      await joinParty(party._id, otherUser);
      const rating = (await rateParty(party._id, otherUser, 4).expect(200))
        .body;
      const r = await request(app)
        .delete(
          `/parties/${party._id.toString()}/ratings/${rating._id.toString()}`
        )
        .set("Authorization", myUser.TOKEN)
        .expect(403);
      checkForSensitiveData(r.body);
      expect(r.body.data.code).to.be.eq(PAPEO_ERRORS.WRONG_USER_ROLE.code);
    });
    describe("Average rating of a party", function () {
      it("average rating is updated after rating created", async function () {
        const myUser = await createUser();
        const otherUser = await createUser();
        const otherUser2 = await createUser();
        const p = await Party.create({
          owner: myUser._id,
          name: "test",
          capacity: 10,
        });
        const partyId = p._id.toString();
        let party = await Party.get(partyId);
        expect(party.rating.avg).to.be.null;
        expect(party.rating.count).to.be.eq(0);
        await joinParty(partyId, otherUser);
        await joinParty(partyId, otherUser2);
        const r = await rateParty(partyId, otherUser, 5).expect(200);

        party = await Party.get(partyId);
        expect(party.rating.avg).to.be.eq(5);
        expect(party.rating.count).to.be.eq(1);

        await rateParty(partyId, otherUser2, 2);

        party = await Party.get(partyId);
        expect(party.rating.avg).to.be.eq(3.5);
        expect(party.rating.count).to.be.eq(2);
      });
      it("average rating is updated after rating patched", async function () {
        const myUser = await createUser();
        const otherUser = await createUser();
        const otherUser2 = await createUser();
        const p = await Party.create({
          owner: myUser._id,
          name: "test",
          capacity: 10,
        });
        const partyId = p._id.toString();
        await joinParty(partyId, otherUser);
        await joinParty(partyId, otherUser2);
        await rateParty(partyId, otherUser, 5).expect(200);
        const r2 = await rateParty(partyId, otherUser2, 2);
        const urser2RatingId = r2.body._id;
        let party = await Party.get(partyId);
        expect(party.rating.avg).to.be.eq(3.5);
        expect(party.rating.count).to.be.eq(2);
        await patchRating(partyId, otherUser, urser2RatingId, 4);
        party = await Party.get(partyId);
        console.log(party);
        expect(party.rating.avg).to.be.eq(4.5);
        expect(party.rating.count).to.be.eq(2);
      });
      it("average rating is updated after rating deleted", async function () {
        const myUser = await createUser();
        const otherUser = await createUser();
        const otherUser2 = await createUser();
        const partyId = (
          await Party.create({ owner: myUser._id, name: "test", capacity: 10 })
        )._id.toString();
        await joinParty(partyId, otherUser);
        await joinParty(partyId, otherUser2);
        await rateParty(partyId, otherUser2, 1).expect(200);
        const urser2RatingId = (await rateParty(partyId, otherUser, 2)).body
          ._id;
        let party = await Party.get(partyId);

        expect(party.rating.avg).to.be.eq(1.5);
        expect(party.rating.count).to.be.eq(2);
        const r = await request(app)
          .delete(`/parties/${partyId}/ratings/${urser2RatingId}`)
          .set("Authorization", otherUser.TOKEN);
        checkForSensitiveData(r.body);

        party = await Party.get(partyId);
        expect(party.rating.avg).to.be.eq(1);
        expect(party.rating.count).to.be.eq(1);
      });
      it("can get all ratings for a party", async function () {
        const myUser = await createUser();
        const users = [];
        for (let i = 0; i < 10; i++) {
          users.push(await createUser());
        }
        const partyId = (
          await Party.create({ owner: myUser._id, name: "test", capacity: 10 })
        )._id.toString();

        for (const u of users) {
          await joinParty(partyId, u);
          await rateParty(partyId, u, 4).expect(200);
        }
        const ratings = await getRatings(partyId, myUser);
        checkForSensitiveData(ratings);
        expect(ratings.body.data).to.have.a.lengthOf(10);
      });
      it("all ratings for a party are deleted when a party is deleted", async function () {
        const myUser = await createUser();
        const otherUser = await createUser();
        const otherUser2 = await createUser();
        const partyId = (
          await Party.create({ owner: myUser._id, name: "test", capacity: 10 })
        )._id.toString();

        await joinParty(partyId, otherUser);
        await joinParty(partyId, otherUser2);
        await rateParty(partyId, otherUser2, 1).expect(200);
        const urser2RatingId = (await rateParty(partyId, otherUser, 2)).body
          ._id;
        let party = await Party.get(partyId);

        expect(party.rating.avg).to.be.eq(1.5);
        expect(party.rating.count).to.be.eq(2);
        await deleteParty(partyId, myUser).expect(200);
        const ratings = await Rating.find({
          query: {
            party: partyId,
            user: otherUser._id.toString(),
          },
        });
        expect(ratings.data.length).to.be.equal(0);
      });
    });
    describe("Average rating of a user", function () {
      it("average rating is updated after rating created", async function () {
        const myUser = await createUser();
        const otherUser = await createUser();
        const otherUser2 = await createUser();
        const otherUser3 = await createUser();
        const p = await Party.create({
          owner: myUser._id,
          name: "test",
          capacity: 10,
        });
        const p2 = await Party.create({
          owner: myUser._id,
          name: "test",
          capacity: 10,
        });
        const partyId = p._id.toString();
        let user = await User.get(myUser._id.toString());
        expect(user.rating.avg).to.be.null;
        expect(user.rating.count).to.be.eq(0);

        await joinParty(partyId, otherUser);
        await joinParty(partyId, otherUser2);
        await joinParty(partyId, otherUser3);
        const r = await rateParty(partyId, otherUser, 5).expect(200);

        user = await User.get(myUser._id.toString());
        expect(user.rating.avg).to.be.eq(5);
        expect(user.rating.count).to.be.eq(1);

        await rateParty(partyId, otherUser2, 2);

        user = await User.get(myUser._id.toString());
        expect(user.rating.avg).to.be.eq(3.5);
        expect(user.rating.count).to.be.eq(2);

        await rateParty(partyId, otherUser3, 2).expect(200);
        user = await User.get(myUser._id.toString());
        expect(user.rating.avg).to.be.eq(3);
        expect(user.rating.count).to.be.eq(3);
      });
      it("average rating is updated after rating patched", async function () {
        const myUser = await createUser();
        const otherUser = await createUser();
        const otherUser2 = await createUser();
        const p = await Party.create({
          owner: myUser._id,
          name: "test",
          capacity: 10,
        });
        const partyId = p._id.toString();
        await joinParty(partyId, otherUser);
        await joinParty(partyId, otherUser2);

        await rateParty(partyId, otherUser, 5).expect(200);
        const r2 = await rateParty(partyId, otherUser2, 2);
        const urser2RatingId = r2.body._id;
        let user = await User.get(myUser._id.toString());
        expect(user.rating.avg).to.be.eq(3.5);
        expect(user.rating.count).to.be.eq(2);
        await patchRating(partyId, otherUser, urser2RatingId, 4);
        user = await User.get(myUser._id.toString());

        expect(user.rating.avg).to.be.eq(4.5);
        expect(user.rating.count).to.be.eq(2);
      });
      it("average rating is updated after rating deleted", async function () {
        const myUser = await createUser();
        const otherUser = await createUser();
        const otherUser2 = await createUser();
        const partyId = (
          await Party.create({ owner: myUser._id, name: "test", capacity: 10 })
        )._id.toString();

        await joinParty(partyId, otherUser);
        await joinParty(partyId, otherUser2);

        await rateParty(partyId, otherUser2, 1).expect(200);
        const urser2RatingId = (await rateParty(partyId, otherUser, 2)).body
          ._id;
        let user = await User.get(myUser._id.toString());

        expect(user.rating.avg).to.be.eq(1.5);
        expect(user.rating.count).to.be.eq(2);
        await request(app)
          .delete(`/parties/${partyId}/ratings/${urser2RatingId}`)
          .set("Authorization", otherUser.TOKEN);

        user = await User.get(myUser._id.toString());
        expect(user.rating.avg).to.be.eq(1);
        expect(user.rating.count).to.be.eq(1);
      });
    });
  });
  describe("Join a party", function () {
    it("can join a party but not twice", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const partyId = (
        await createParty(otherUser, { name: "test", capacity: 10 })
      ).body._id;
      await joinParty(partyId, myUser).expect(200);
      const r = await joinParty(partyId, myUser).expect(400);
      expect(r.body.data.code).to.be.eq(
        PAPEO_ERRORS.YOU_CANNOT_JOIN_THIS_PARTY.code
      );
    });
    it("can join my own party", async function () {
      const myUser = await createUser();
      const partyId = (
        await createParty(myUser, { name: "test", capacity: 10 })
      ).body._id;
      const r = await joinParty(partyId, myUser).expect(200);
      checkForSensitiveData(r.body);
    });
    it("when I join a privacyLevel->closed party, the status is requested", async function () {
      const myUser = await createUser();
      const party = (
        await createParty(myUser, {
          name: "test",
          capacity: 10,
          privacyLevel: "closed",
        })
      ).body;
      const r = (await joinParty(party._id, myUser).expect(200)).body;
      expect(r.status).to.be.string("requested");
    });
    it("when I join a party, the partyguest count increases", async function () {
      const myUser = await createUser();
      const party = (
        await createParty(myUser, {
          name: "test",
          capacity: 10,
          privacyLevel: "open",
        })
      ).body;
      const guests = (await getPartyGuests(party._id, myUser).expect(200)).body
        .data;
      expect(guests).to.have.lengthOf(0);
      const r = (await joinParty(party._id, myUser).expect(200)).body;
      expect(r.status).to.be.string("attending");

      const guests2 = (await getPartyGuests(party._id, myUser).expect(200)).body
        .data;
      expect(guests2).to.have.lengthOf(1);
    });
    it("when I delete a party join, the partyguest count decreases", async function () {
      const myUser = await createUser();
      const party = (
        await createParty(myUser, {
          name: "test",
          capacity: 10,
          privacyLevel: "open",
        })
      ).body;
      const r = (await joinParty(party._id, myUser).expect(200)).body;
      expect(r.status).to.be.string("attending");
      const guests = (await getPartyGuests(party._id, myUser).expect(200)).body
        .data;
      expect(guests).to.have.lengthOf(1);
      await request(app)
        .delete(`/parties/${party._id.toString()}/guests`)
        .set("Authorization", myUser.TOKEN)
        .expect(200);

      const guests2 = (await getPartyGuests(party._id, myUser).expect(200)).body
        .data;
      expect(guests2).to.have.lengthOf(0);
    });
    it("I cannot join a full party", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const party = (
        await createParty(myUser, {
          name: "test",
          capacity: 1,
          privacyLevel: "open",
        })
      ).body;
      const r = (await joinParty(party._id, otherUser).expect(200)).body;
      expect(r.status).to.be.string("attending");
      const r2 = (await joinParty(party._id, myUser).expect(400)).body;
      expect(r2.data.code).to.be.eq(
        PAPEO_ERRORS.YOU_CANNOT_JOIN_THIS_PARTY.code
      );

      const guests2 = (await getPartyGuests(party._id, myUser).expect(200)).body
        .data;
      expect(guests2).to.have.lengthOf(1);
    });
  });
  describe("Bookmark a party", function () {
    it("can create a bookmark for a party but not twice", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const partyId = (await createParty(otherUser, { name: "test" })).body._id;
      const res = await bookmarkParty(partyId, myUser).expect(200);
      checkForSensitiveData(res.body);
      let myBookmarks = (await getMyBookmarks(myUser).expect(200)).body.data;
      expect(myBookmarks).to.have.lengthOf(1);
      const r = await bookmarkParty(partyId, myUser).expect(400);
      expect(r.body.data.code).to.be.eq(
        PAPEO_ERRORS.PARTY_ALREADY_BOOKMARKED.code
      );
    });
    it("can delete a bookmark for a party", async function () {
      await Bookmark.MODEL.deleteMany({});
      const myUser = await createUser();
      const otherUser = await createUser();
      const partyId = (await createParty(otherUser, { name: "test" })).body._id;
      await bookmarkParty(partyId, myUser).expect(200);
      await deleteBookmark(partyId, myUser).expect(200);

      let myBookmarks = (await getMyBookmarks(myUser).expect(200)).body.data;
      expect(myBookmarks).to.have.lengthOf(0);
    });
    it("can get all my bookmarks, and no bookmarks from other users", async function () {
      await Bookmark.MODEL.deleteMany({});
      const myUser = await createUser();
      const otherUser = await createUser();
      const otherUser2 = await createUser();
      const party1 = (await createParty(otherUser2, { name: "test" })).body._id;
      const party2 = (await createParty(otherUser2, { name: "test" })).body._id;
      let myBookmarks = (await getMyBookmarks(myUser).expect(200)).body.data;
      expect(myBookmarks).to.have.lengthOf(0);

      await bookmarkParty(party1, myUser);
      myBookmarks = (await getMyBookmarks(myUser).expect(200)).body.data;
      expect(myBookmarks).to.have.lengthOf(1);

      await bookmarkParty(party1, otherUser);
      myBookmarks = (await getMyBookmarks(myUser).expect(200)).body.data;
      expect(myBookmarks).to.have.lengthOf(1);

      await bookmarkParty(party2, myUser);
      myBookmarks = (await getMyBookmarks(myUser).expect(200)).body.data;
      expect(myBookmarks).to.have.lengthOf(2);

      const r = await request(app)
        .get(`/bookmarks?user=${otherUser._id.toString()}`)
        .set("Authorization", myUser.TOKEN)
        .expect(403);
      expect(r.body.data.code).to.be.eq(PAPEO_ERRORS.WRONG_USER_ROLE.code);
    });
  });
  describe("Invite Token", function () {
    it("I cannot join a secret party without inviteToken", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const party = (
        await createParty(otherUser, { name: "test", privacyLevel: "secret" })
      ).body;
      const r = (
        await h.joinPartyWithInviteToken(party._id, myUser, {}).expect(403)
      ).body;
    });
    it("I can join a secret party with inviteToken", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const party = (
        await createParty(otherUser, { name: "test", privacyLevel: "secret" })
      ).body;
      console.log(party.inviteToken);
      const r = (
        await h
          .joinPartyWithInviteToken(party._id, myUser, {
            inviteToken: party.inviteToken,
          })
          .expect(200)
      ).body;
      const partyguests = await PartyGuest.MODEL.find({ party: party._id });
      expect(partyguests).to.have.lengthOf(1);
      expect(partyguests[0].user.toString()).to.be.eq(myUser._id.toString());
      expect(partyguests[0].status).to.be.eq("requested");
    });
    it("I can join a secret party when I am invited", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const party = (
        await createParty(otherUser, { name: "test", privacyLevel: "secret" })
      ).body;
      await h.inviteUsers(otherUser, party._id, [myUser]).expect(200);
      const activities = await Activity.MODEL.find({
        user: myUser._id,
        type: "invitedParty",
      });
      expect(activities).to.have.lengthOf(1);
      expect(activities[0].parties[0]._id.toString()).to.be.eq(
        party._id.toString()
      );
      const r = (await h.joinParty(party._id, myUser).expect(200)).body;
      const partyguests = await PartyGuest.MODEL.find({ party: party._id });
      expect(partyguests).to.have.lengthOf(1);
      expect(partyguests[0].user.toString()).to.be.eq(myUser._id.toString());
      expect(partyguests[0].status).to.be.eq("requested");
    });
    it("I cannot join a secret party when I am NOT invited", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const party = (
        await createParty(otherUser, { name: "test", privacyLevel: "secret" })
      ).body;

      const r = (await h.joinParty(party._id, myUser).expect(403)).body;
      const partyguests = await PartyGuest.MODEL.find({ party: party._id });
      expect(partyguests).to.have.lengthOf(0);
    });
    it("I cannot join a secret party with faulty inviteToken", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const party = (
        await createParty(otherUser, { name: "test", privacyLevel: "secret" })
      ).body;
      console.log(party.inviteToken);
      const r = (
        await h
          .joinPartyWithInviteToken(party._id, myUser, {
            inviteToken: party.inviteToken + "1",
          })
          .expect(403)
      ).body;
      const partyguests = await PartyGuest.MODEL.find({ party: party._id });
      expect(partyguests).to.have.lengthOf(0);
    });
    it("I can share a secret party if I am the owner and the inviteToken is in the activity", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const otherUser2 = await createUser();
      const party = (
        await createParty(otherUser, { name: "test", privacyLevel: "secret" })
      ).body;
      console.log(party.inviteToken);
      await h.sendFriendRequest(otherUser, otherUser2).expect(200);
      await h.acceptFriendRequest(otherUser2, otherUser).expect(200);
      await h
        .share(otherUser, [otherUser2], {
          sharedParty: party._id.toString(),
        })
        .expect(200);
      const activities = await Activity.MODEL.find({
        user: otherUser2._id,
        type: "sharedParty",
      });
      expect(activities).to.have.lengthOf(1);
      expect(activities[0].parties[0]._id.toString()).to.be.eq(
        party._id.toString()
      );
      expect(activities[0].additionalInformation.inviteToken).to.be.eq(
        party.inviteToken
      );
    });
    it("I can share a closed party as the owner and the inviteToken is not in the activity", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const otherUser2 = await createUser();
      const party = (
        await createParty(otherUser, { name: "test", privacyLevel: "closed" })
      ).body;
      console.log(party.inviteToken);
      await h.sendFriendRequest(otherUser, otherUser2).expect(200);
      await h.acceptFriendRequest(otherUser2, otherUser).expect(200);
      await h
        .share(otherUser, [otherUser2], {
          sharedParty: party._id.toString(),
        })
        .expect(200);
      const activities = await Activity.MODEL.find({
        user: otherUser2._id,
        type: "sharedParty",
      });
      expect(activities).to.have.lengthOf(1);
      expect(activities[0].parties[0]._id.toString()).to.be.eq(
        party._id.toString()
      );
      expect(activities[0].additionalInformation).to.be.undefined;
    });
    it("I can share a closed party and the inviteToken is not in the activity", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const otherUser2 = await createUser();
      const party = (
        await createParty(otherUser, { name: "test", privacyLevel: "closed" })
      ).body;
      console.log(party.inviteToken);
      await h.sendFriendRequest(myUser, otherUser2).expect(200);
      await h.acceptFriendRequest(otherUser2, myUser).expect(200);
      await h
        .share(myUser, [otherUser2], {
          sharedParty: party._id.toString(),
        })
        .expect(200);
      const activities = await Activity.MODEL.find({
        user: otherUser2._id,
        type: "sharedParty",
      });
      expect(activities).to.have.lengthOf(1);
      expect(activities[0].parties[0]._id.toString()).to.be.eq(
        party._id.toString()
      );
      expect(activities[0].additionalInformation).to.be.undefined;
    });
    it("I cannot share a secret party if I am not the owner or a partyAdmin", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const otherUser2 = await createUser();
      const party = (
        await createParty(otherUser, { name: "test", privacyLevel: "secret" })
      ).body;
      await h
        .share(myUser, [otherUser2], {
          sharedParty: party._id.toString(),
        })
        .expect(400);
    });
    it("I can share a secret party if I am a partyadmin", async function () {
      const myUser = await createUser();
      const otherUser = await createUser();
      const otherUser2 = await createUser();
      const party = (
        await createParty(otherUser, { name: "test", privacyLevel: "secret" })
      ).body;
      console.log(party.inviteToken);
      await h.sendFriendRequest(myUser, otherUser2).expect(200);
      await h.acceptFriendRequest(otherUser2, myUser).expect(200);
      await h
        .joinPartyWithInviteToken(party._id, myUser, {
          inviteToken: party.inviteToken,
        })
        .expect(200);
      await h
        .patchPartyGuest(otherUser, myUser, party._id, {
          status: "attending",
        })
        .expect(200);
      await h
        .createPartyAdmin(otherUser, party._id, myUser, {
          rights: {
            canManageParty: false,
            canManageGuestlist: false,
            canManagePartyPhotos: false,
            canBroadcastMessages: false,
            canSeeAdminHistory: false,
          },
        })
        .expect(200);
      await h
        .share(myUser, [otherUser2], {
          sharedParty: party._id.toString(),
        })
        .expect(200);
      const activities = await Activity.MODEL.find({
        user: otherUser2._id,
        type: "sharedParty",
      });
      expect(activities).to.have.lengthOf(1);
      expect(activities[0].parties[0]._id.toString()).to.be.eq(
        party._id.toString()
      );
      expect(activities[0].additionalInformation.inviteToken).to.be.eq(
        party.inviteToken
      );
    });
  });
});

after(async function () {
  if (process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
