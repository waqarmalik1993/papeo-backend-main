const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const {
  getUser,
  followUser,
  sendFriendRequest,
  deleteFriend,
  acceptFriendRequest,
  getFriends,
  unfollowUser,
  getFollowers,
  checkAvailability,
  patchUser,
  deleteUser,
  createUser,
  wipeDatabaseAndEmptyS3Bucket,
  checkForSensitiveData,
  checkForSensitiveDataInOwnUser,
  uploadVerificationVideo,
  setVerificationVideo,
  getUsersS3Uploads,
  removeUpload,
  voteForVerification,
  getUsersToVerify,
  createParty,
  getAvailablePartyCount,
  getDatePlusHours,
  getDatePlusMinutes,
  joinParty,
} = require("./helpers");
const User = require("../../services/users/usersService.js");
const Party = require("../../services/parties/partiesService");
const Upload = require("../../services/uploads/uploadsService");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
describe("Membership", function () {
  this.timeout(3000);
  before(async function() {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("I cannot mark me as an artist if I dont have a party king membership", async function() {
    await wipeDatabaseAndEmptyS3Bucket();
    const myUser = await createUser({ isPartyKing: false });

    const res = await patchUser(myUser, myUser, {
      isArtist: true,
    }).expect(400);

    expect(res.body.data.code).to.be.equal(
      PAPEO_ERRORS.YOU_MUST_BE_A_PARTY_KING_MEMBER_TO_MARK_YOURSELF_AS_AN_ARTIST
        .code
    );
    const dbUser = await User.get(myUser._id);
    expect(dbUser.isArtist).to.be.false;
  });
  it("I can mark me as an artist", async function() {
    await wipeDatabaseAndEmptyS3Bucket();
    const myUser = await createUser({ isPartyKing: true });

    const res = await patchUser(myUser, myUser, {
      isArtist: true,
    }).expect(200);

    const dbUser = await User.get(myUser._id);
    expect(dbUser.isArtist).to.be.true;
  });
  describe("Active parties logic", function () {
    const now = new Date();

    it("draft parties are not active", async function() {
      const myUser = await createUser({ isPartyKing: false });
      await createParty(myUser, {
        status: "draft",
        startDate: getDatePlusHours(24),
        endDate: undefined,
      });
      await createParty(myUser, {
        status: "draft",
        startDate: getDatePlusHours(24),
        endDate: getDatePlusHours(25),
      });

      const activeParties = await Party.getActivePartiesFromUser(myUser._id);
      expect(activeParties).to.have.a.lengthOf(0);
    });
    it("parties with startdate before two hours are active", async function() {
      const myUser = await createUser({ isPartyKing: false });
      await createParty(myUser, {
        status: "published",
        startDate: getDatePlusMinutes(-2 * 59),
        endDate: undefined,
      });
      await createParty(myUser, {
        status: "published",
        startDate: getDatePlusMinutes(-2 * 61),
        endDate: undefined,
      });

      const activeParties = await Party.getActivePartiesFromUser(myUser._id);
      expect(activeParties).to.have.a.lengthOf(1);
    });
    it("Expired (endDate < now) parties are not active parties", async function() {
      const myUser = await createUser({ isPartyKing: false });
      const now = new Date();
      const beforeOneMinute = new Date();
      beforeOneMinute.setTime(beforeOneMinute.getTime() - 1 * 60 * 1000);
      console.log(getDatePlusMinutes(-2));
      await createParty(myUser, {
        status: "published",
        startDate: getDatePlusHours(-2),
        endDate: getDatePlusMinutes(-1),
      });

      const activeParties = await Party.getActivePartiesFromUser(myUser._id);
      expect(activeParties).to.have.a.lengthOf(0);
    });
    const standardDefaultPartyCount = {
      availablePrivateParties: 2,
      availableCommercialParties: 1,
      availableSecretParties: 1,
      availableTotal: 3,
      partyPointsAreSufficientToCreateParty: false,
      costOfParty: 100,
      privatePartyCreationWillCost: 0,
      commercialPartyCreationWillCost: 0,
      secretPartyCreationWillCost: 0,
    };
    const partyKingDefaultPartyCount = {
      availablePrivateParties: 10,
      availableCommercialParties: 10,
      availableSecretParties: 10,
      availableTotal: 10,
      partyPointsAreSufficientToCreateParty: false,
      costOfParty: 75,
      privatePartyCreationWillCost: 0,
      commercialPartyCreationWillCost: 0,
      secretPartyCreationWillCost: 0,
    };
    it("Available party counts for standard user", async function() {
      const myUser = await createUser({ isPartyKing: false, partyPoints: 0 });
      const availablePartyCount = (
        await getAvailablePartyCount(myUser).expect(200)
      ).body;
      expect(availablePartyCount).to.deep.equal(standardDefaultPartyCount);
    });
    it("Available party counts for party king user", async function() {
      const myUser = await createUser({ isPartyKing: true, partyPoints: 0 });
      const availablePartyCount = (
        await getAvailablePartyCount(myUser).expect(200)
      ).body;
      expect(availablePartyCount).to.deep.equal(partyKingDefaultPartyCount);
    });
    it("Available party count decreases for standard users", async function() {
      const myUser = await createUser({ isPartyKing: false, partyPoints: 0 });
      await createParty(myUser, {
        type: "private",
        status: "published",
        startDate: getDatePlusHours(48),
      });
      const availablePartyCount = (
        await getAvailablePartyCount(myUser).expect(200)
      ).body;
      expect(availablePartyCount.availablePrivateParties).to.equal(1);
      expect(availablePartyCount.availableCommercialParties).to.equal(1);
      expect(availablePartyCount.availableTotal).to.equal(2);
      expect(availablePartyCount.privatePartyCreationWillCost).to.equal(0);
    });
    it("Available party count decreases for party king users", async function() {
      const myUser = await createUser({ isPartyKing: true, partyPoints: 0 });
      await createParty(myUser, {
        type: "private",
        status: "published",
        startDate: getDatePlusHours(48),
      });
      const availablePartyCount = (
        await getAvailablePartyCount(myUser).expect(200)
      ).body;
      expect(availablePartyCount.availablePrivateParties).to.equal(9);
      expect(availablePartyCount.availableCommercialParties).to.equal(9);
      expect(availablePartyCount.availableTotal).to.equal(9);
      expect(availablePartyCount.privatePartyCreationWillCost).to.equal(0);
    });
    it("Standard user: Cost of a party is returned if there are no more free parties", async function() {
      const myUser = await createUser({ isPartyKing: false, partyPoints: 0 });
      let availablePartyCount = (
        await getAvailablePartyCount(myUser).expect(200)
      ).body;
      expect(availablePartyCount.availablePrivateParties).to.equal(2);
      expect(availablePartyCount.availableCommercialParties).to.equal(1);
      expect(availablePartyCount.availableTotal).to.equal(3);
      expect(availablePartyCount.privatePartyCreationWillCost).to.equal(0);
      expect(availablePartyCount.commercialPartyCreationWillCost).to.equal(0);
      await createParty(myUser, {
        type: "private",
        status: "published",
        startDate: getDatePlusHours(48),
      });
      await createParty(myUser, {
        type: "private",
        status: "published",
        startDate: getDatePlusHours(48),
      });
      await createParty(myUser, {
        type: "commercial",
        status: "published",
        startDate: getDatePlusHours(48),
      });
      availablePartyCount = (await getAvailablePartyCount(myUser).expect(200))
        .body;
      expect(availablePartyCount.availablePrivateParties).to.equal(0);
      expect(availablePartyCount.availableCommercialParties).to.equal(0);
      expect(availablePartyCount.availableTotal).to.equal(0);
      expect(availablePartyCount.privatePartyCreationWillCost).to.equal(100);
      expect(availablePartyCount.commercialPartyCreationWillCost).to.equal(100);
    });
    it("Party King user: Cost of a party is returned if there are no more free parties", async function() {
      const myUser = await createUser({ isPartyKing: true, partyPoints: 0 });
      let availablePartyCount = (
        await getAvailablePartyCount(myUser).expect(200)
      ).body;
      expect(availablePartyCount.availablePrivateParties).to.equal(10);
      expect(availablePartyCount.availableCommercialParties).to.equal(10);
      expect(availablePartyCount.availableTotal).to.equal(10);
      expect(availablePartyCount.privatePartyCreationWillCost).to.equal(0);
      expect(availablePartyCount.commercialPartyCreationWillCost).to.equal(0);

      for (let i = 0; i < 9; i++) {
        await createParty(myUser, {
          type: "private",
          status: "published",
          startDate: getDatePlusHours(48),
        });
      }

      availablePartyCount = (await getAvailablePartyCount(myUser).expect(200))
        .body;
      expect(availablePartyCount.availablePrivateParties).to.equal(1);
      expect(availablePartyCount.availableCommercialParties).to.equal(1);
      expect(availablePartyCount.availableTotal).to.equal(1);
      expect(availablePartyCount.privatePartyCreationWillCost).to.equal(0);
      expect(availablePartyCount.commercialPartyCreationWillCost).to.equal(0);

      await createParty(myUser, {
        type: "commercial",
        status: "published",
        startDate: getDatePlusHours(48),
      });
      availablePartyCount = (await getAvailablePartyCount(myUser).expect(200))
        .body;
      expect(availablePartyCount.availablePrivateParties).to.equal(0);
      expect(availablePartyCount.availableCommercialParties).to.equal(0);
      expect(availablePartyCount.availableTotal).to.equal(0);
      expect(availablePartyCount.privatePartyCreationWillCost).to.equal(75);
      expect(availablePartyCount.commercialPartyCreationWillCost).to.equal(75);
    });
    it("cannot create a party if PartyPoints are not sufficient", async function() {
      const myUser = await createUser({ isPartyKing: false, partyPoints: 0 });
      await createParty(myUser, {
        type: "commercial",
        status: "published",
        startDate: getDatePlusHours(48),
        endDate: undefined,
      }).expect(200);
      const res = await createParty(myUser, {
        type: "commercial",
        status: "published",
        startDate: getDatePlusHours(48),
      }).expect(400);
      expect(res.body.data.code).to.be.equal(
        PAPEO_ERRORS.YOU_DONT_HAVE_ENOUGH_PP_TO_PUBLISH_PARTY.code
      );
    });
    it("PP decrasing when creating a commercial party", async function() {
      const myUser = await createUser({ isPartyKing: false, partyPoints: 100 });
      await createParty(myUser, {
        type: "commercial",
        status: "published",
        startDate: getDatePlusHours(48),
        endDate: undefined,
      }).expect(200);
      console.log({ myUser });
      let dbUser = await User.getRaw(myUser._id);
      expect(dbUser.partyPoints).to.be.equal(100);
      await createParty(myUser, {
        type: "commercial",
        status: "published",
        startDate: getDatePlusHours(48),
        endDate: undefined,
      }).expect(200);
      dbUser = await User.getRaw(myUser._id);
      expect(dbUser.partyPoints).to.be.equal(0);
      const res = await createParty(myUser, {
        type: "commercial",
        status: "published",
        startDate: getDatePlusHours(48),
      }).expect(400);
      expect(res.body.data.code).to.be.equal(
        PAPEO_ERRORS.YOU_DONT_HAVE_ENOUGH_PP_TO_PUBLISH_PARTY.code
      );
    });
    it("PP decrasing when creating a private party", async function() {
      const myUser = await createUser({ isPartyKing: false, partyPoints: 100 });
      await createParty(myUser, {
        type: "private",
        status: "published",
        startDate: getDatePlusHours(48),
        endDate: undefined,
      }).expect(200);
      await createParty(myUser, {
        type: "private",
        status: "published",
        startDate: getDatePlusHours(48),
        endDate: undefined,
      }).expect(200);
      console.log({ myUser });
      let dbUser = await User.getRaw(myUser._id);
      expect(dbUser.partyPoints).to.be.equal(100);
      await createParty(myUser, {
        type: "private",
        status: "published",
        startDate: getDatePlusHours(48),
        endDate: undefined,
      }).expect(200);
      dbUser = await User.getRaw(myUser._id);
      expect(dbUser.partyPoints).to.be.equal(0);
      const res = await createParty(myUser, {
        type: "private",
        status: "published",
        startDate: getDatePlusHours(48),
      }).expect(400);
      expect(res.body.data.code).to.be.equal(
        PAPEO_ERRORS.YOU_DONT_HAVE_ENOUGH_PP_TO_PUBLISH_PARTY.code
      );
    });
    it.skip("TODO PP decrasing when inviting users", async function() {
      const myUser = await createUser({ isPartyKing: false, partyPoints: 100 });
    });
    it("TODO PP decrasing when inviting users", async function() {
      const myUser = await createUser({
        isPartyKing: false,
        partyPoints: 1000,
      });
      const party1 = (
        await createParty(myUser, {
          type: "private",
          status: "published",
          startDate: getDatePlusHours(48),
          endDate: undefined,
        }).expect(200)
      ).body;
      const party2 = (
        await createParty(myUser, {
          type: "private",
          status: "published",
          startDate: getDatePlusHours(48),
          endDate: undefined,
        }).expect(200)
      ).body;
      const party3 = (
        await createParty(myUser, {
          type: "private",
          status: "published",
          startDate: getDatePlusHours(48),
          endDate: undefined,
        }).expect(200)
      ).body;
      const party4 = (
        await createParty(myUser, {
          type: "private",
          status: "published",
          startDate: getDatePlusHours(48),
          endDate: undefined,
        }).expect(200)
      ).body;
      await joinParty(party1._id, myUser).expect(200);
      await joinParty(party2._id, myUser).expect(200);
      await joinParty(party3._id, myUser).expect(200);
      const res = await joinParty(party4._id, myUser).expect(400);
      expect(res.body.data.code).to.be.equal(
        PAPEO_ERRORS.YOU_CANNOT_JOIN_THIS_PARTY.code
      );
    });
  });
});

after(async function() {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
