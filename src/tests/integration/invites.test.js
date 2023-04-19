const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const {
  getPartyGuests,
  getMyBookmarks,
  bookmarkParty,
  joinParty,
  rateParty,
  patchRating,
  createParty,
  createUser,
  deleteBookmark,
  getRatings,
  inviteUsers,
  wipeDatabaseAndEmptyS3Bucket,
  checkForSensitiveData,
  sendFriendRequest,
  acceptFriendRequest,
  followUser,
} = require("./helpers.js");

const createJWToken =
  require("../../services/users/usersService.js").createJWToken;
const User = require("../../services/users/usersService.js");
const Party = require("../../services/parties/partiesService.js");
const PartyGuest = require("../../services/partyGuests/partyGuestsService.js");
const Rating = require("../../services/ratings/ratingsService.js");
const Invite = require("../../services/invites/invitesService.js");
const generateUser = require("./data/getRandomUserData.js").generateUser;
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const startServer = require("../../app").startServer;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
describe("/invites", function () {
  before(async function() {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("I can invite a user", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (await createParty(myUser, { name: "test", capacity: 10 }))
      .body._id;

    const res = await inviteUsers(myUser, partyId, [otherUser]).expect(200);
    checkForSensitiveData(res.body);
    expect(res.body).to.have.a.lengthOf(1);
    const invites = await Invite.find({
      query: {
        invitedUser: otherUser._id.toString(),
      },
    });
    expect(invites.data).to.have.a.lengthOf(1);
  });
  it("I cannot invite a user twice to the same party", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (await createParty(myUser, { name: "test", capacity: 10 }))
      .body._id;
    await inviteUsers(myUser, partyId, [otherUser]).expect(200);
    const res = await inviteUsers(myUser, partyId, [otherUser]).expect(200);
    expect(res.body).to.have.a.lengthOf(1);
    const invites = await Invite.find({
      query: {
        invitedUser: otherUser._id.toString(),
      },
    });
    expect(invites.data).to.have.a.lengthOf(1);
  });
  it("I cannot invite myself to a party", async function() {
    const myUser = await createUser();
    const partyId = (await createParty(myUser, { name: "test", capacity: 10 }))
      .body._id;
    const res = await inviteUsers(myUser, partyId, [myUser]).expect(200);
    expect(res.body[0].error.data.code).to.be.equal(
      PAPEO_ERRORS.YOU_CANNOT_INVITE_YOURSELF_TO_A_PARTY.code
    );
    const invites = await Invite.find({
      query: {
        invitedUser: myUser._id.toString(),
      },
    });
    expect(invites.data).to.have.a.lengthOf(0);
  });
  it("I cannot invite a user if I am not the owner of the party or on the guestlist", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (
      await createParty(otherUser, { name: "test", capacity: 10 })
    ).body._id;
    const res = await inviteUsers(myUser, partyId, [otherUser]).expect(400);
    expect(res.body.data.code).to.be.equal(
      PAPEO_ERRORS.YOU_MUST_BE_A_GUEST_TO_INVITE_OTHERS.code
    );
    const invites = await Invite.find({
      query: {
        invitedUser: otherUser._id.toString(),
      },
    });
    expect(invites.data).to.have.a.lengthOf(0);
  });
  it("I can invite a user if I am on the guestlist of the party", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (
      await createParty(otherUser, {
        name: "test",
        capacity: 10,
        privacyLevel: "open",
      })
    ).body._id;
    await joinParty(partyId, myUser).expect(200);
    const res = await inviteUsers(myUser, partyId, [otherUser]).expect(200);
    expect(res.body).to.have.a.lengthOf(1);
    const invites = await Invite.find({
      query: {
        invitedUser: otherUser._id.toString(),
      },
    });
    expect(invites.data).to.have.a.lengthOf(1);
  });
  it.skip("TODO I cant invite a user if the guestlist is full", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (
      await createParty(otherUser, {
        name: "test",
        capacity: 10,
        privacyLevel: "open",
      })
    ).body._id;
    await joinParty(partyId, myUser).expect(200);
    const res = await inviteUsers(myUser, partyId, [otherUser]).expect(200);
    expect(res.body).to.have.a.lengthOf(1);
    const invites = await Invite.find({
      query: {
        invitedUser: otherUser._id.toString(),
      },
    });
    expect(invites.data).to.have.a.lengthOf(1);
  });
  describe("Users Relationship category", function() {
    it("If there is no relationship, the category is 'other'", async function() {
      const myUser = await createUser();
      const otherUser = await createUser();

      const res = await Invite.getUserRelationShipCategories(myUser, otherUser);
      expect(res).to.deep.equal({
        following: false,
        followers: false,
        partyFriends: false,
        others: true,
      });
    });
    it("If user are friends, the category is 'partyFriends'", async function() {
      const myUser = await createUser();
      const otherUser = await createUser();
      await sendFriendRequest(myUser, otherUser);

      const res = await Invite.getUserRelationShipCategories(
        await User.getRaw(myUser._id),
        await User.getRaw(otherUser._id)
      );
      expect(res).to.deep.equal({
        following: false,
        followers: false,
        partyFriends: false,
        others: true,
      });

      await acceptFriendRequest(otherUser, myUser);

      const res2 = await Invite.getUserRelationShipCategories(
        await User.getRaw(myUser._id),
        await User.getRaw(otherUser._id)
      );
      expect(res2.partyFriends).to.be.true;
    });
    it("If user1 is following user2, the category is 'following'", async function() {
      const myUser = await createUser();
      const otherUser = await createUser();

      const res = await Invite.getUserRelationShipCategories(
        await User.getRaw(myUser._id),
        await User.getRaw(otherUser._id)
      );
      expect(res.following).to.be.false;

      await followUser(otherUser, myUser);

      const res2 = await Invite.getUserRelationShipCategories(
        await User.getRaw(myUser._id),
        await User.getRaw(otherUser._id)
      );
      expect(res2).to.deep.equal({
        following: true,
        followers: false,
        partyFriends: false,
        others: false,
      });
    });
    it("If user2 is following user1, the category is 'followers'", async function() {
      const myUser = await createUser();
      const otherUser = await createUser();

      const res = await Invite.getUserRelationShipCategories(
        await User.getRaw(myUser._id),
        await User.getRaw(otherUser._id)
      );
      expect(res.followers).to.be.false;

      await followUser(myUser, otherUser);

      const res2 = await Invite.getUserRelationShipCategories(
        await User.getRaw(myUser._id),
        await User.getRaw(otherUser._id)
      );
      expect(res2).to.deep.equal({
        following: false,
        followers: true,
        partyFriends: false,
        others: false,
      });
    });
  });
  describe("User can be invited", function() {
    it("Users can be invited by default", async function() {
      const myUser = await createUser();
      const otherUser = await createUser();

      const res = await Invite.userCanBeInvited(
        await Invite.getUserRelationShipCategories(
          await User.getRaw(myUser._id),
          await User.getRaw(otherUser._id)
        ),
        await User.getRaw(otherUser._id),
        1000000
      );
      expect(res).to.be.true;
    });
    it("User cannot be invited if the other user has invitation settings turned off for category others", async function() {
      const myUser = await createUser();
      const otherUser = await createUser();
      await User.patch(otherUser._id, {
        "settings.invitations.others": false,
      });
      const res = await Invite.userCanBeInvited(
        await Invite.getUserRelationShipCategories(
          await User.getRaw(myUser._id),
          await User.getRaw(otherUser._id)
        ),
        await User.getRaw(otherUser._id),
        0
      );
      expect(res).to.be.false;
    });
    it.skip("User cannot be invited if the other user has invitation settings turned off for category partyfriends", async function() {
      const myUser = await createUser();
      const otherUser = await createUser();
      await User.patch(otherUser._id, {
        "settings.invitations.partyFriends": false,
      });
      await sendFriendRequest(myUser, otherUser);
      await acceptFriendRequest(otherUser, myUser);
      const res = await Invite.userCanBeInvited(
        await Invite.getUserRelationShipCategories(
          await User.getRaw(myUser._id),
          await User.getRaw(otherUser._id)
        ),
        await User.getRaw(otherUser._id),
        0
      );
      expect(res).to.be.false;
    });
    it.skip("User can be invited if the other user has invitation distance set to 200km and distance is 200km", async function() {
      const myUser = await createUser();
      const otherUser = await createUser();
      await User.patch(otherUser._id, {
        "settings.invitations.distanceTo": 200000,
      });
      const res = await Invite.userCanBeInvited(
        await Invite.getUserRelationShipCategories(
          await User.getRaw(myUser._id),
          await User.getRaw(otherUser._id)
        ),
        await User.getRaw(otherUser._id),
        200000
      );
      expect(res).to.be.true;
    });
    it.skip("User cannot be invited if the other user has invitation distance set to 200km and distance is 201km", async function() {
      const myUser = await createUser();
      const otherUser = await createUser();
      await User.patch(otherUser._id, {
        "settings.invitations.distanceTo": 200000,
      });
      const res = await Invite.userCanBeInvited(
        await Invite.getUserRelationShipCategories(
          await User.getRaw(myUser._id),
          await User.getRaw(otherUser._id)
        ),
        await User.getRaw(otherUser._id),
        200001
      );
      expect(res).to.be.false;
    });
    describe("Invitation Costs", function() {
      it("User cannot be invited if the other user has invitation settings turned off for category partyfriends and cost is 0", async function() {
        const myUser = await createUser();
        const otherUser = await createUser();
        await User.patch(otherUser._id, {
          "settings.invitations.partyFriends": false,
        });
        await sendFriendRequest(myUser, otherUser);
        await acceptFriendRequest(otherUser, myUser);
        const res = await Invite.calculateInvitationCost(
          await User.getRaw(myUser._id),
          await User.getRaw(otherUser._id),
          0
        );
        expect(res).to.equal(0);
      });
      it("User can be invited if the other user has invitation settings turned on for category partyfriends and cost is 0", async function() {
        const myUser = await createUser();
        const otherUser = await createUser();
        await User.patch(otherUser._id, {
          "settings.invitations.partyFriends": true,
        });
        await sendFriendRequest(myUser, otherUser);
        await acceptFriendRequest(otherUser, myUser);
        const res = await Invite.calculateInvitationCost(
          await User.getRaw(myUser._id),
          await User.getRaw(otherUser._id),
          0
        );
        expect(res).to.equal(0);
      });
      it("Cost for category other is 8", async function() {
        const myUser = await createUser();
        const otherUser = await createUser();
        const res = await Invite.calculateInvitationCost(
          await User.getRaw(myUser._id),
          await User.getRaw(otherUser._id),
          0
        );
        expect(res).to.equal(8);
      });
      it("Cost for category following is 8", async function() {
        const myUser = await createUser();
        const otherUser = await createUser();
        await followUser(otherUser, myUser);
        const res = await Invite.calculateInvitationCost(
          await User.getRaw(myUser._id),
          await User.getRaw(otherUser._id),
          0
        );
        expect(res).to.equal(8);
      });
      it("Cost for category followers is 8", async function() {
        const myUser = await createUser();
        const otherUser = await createUser();
        await followUser(myUser, otherUser);
        const res = await Invite.calculateInvitationCost(
          await User.getRaw(myUser._id),
          await User.getRaw(otherUser._id),
          0
        );
        expect(res).to.equal(8);
      });
      it("Cost for category followers is 6 if user is PartyKing", async function() {
        const myUser = await createUser({ isPartyKing: true });
        const otherUser = await createUser();
        await followUser(myUser, otherUser);
        const res = await Invite.calculateInvitationCost(
          await User.getRaw(myUser._id),
          await User.getRaw(otherUser._id),
          0
        );
        expect(res).to.equal(6);
      });
      describe("Party Points and Transactions logic", function() {
        it("I cannot invite users if I have not enough PP", async function() {
          const myUser = await createUser({ partyPoints: 10 });
          const otherUser = await createUser();
          const otherUser2 = await createUser();
          const partyId = (
            await createParty(myUser, { name: "test", capacity: 10 })
          ).body._id;

          const res = await inviteUsers(myUser, partyId, [
            otherUser,
            otherUser2,
          ]).expect(400);
          checkForSensitiveData(res.body);
          expect(res.body.data.code).to.be.equal(
            PAPEO_ERRORS.YOU_DONT_HAVE_ENOUGH_PP_TO_INVITE_USERS.code
          );
          const invites = await Invite.find({
            query: {
              party: partyId,
            },
          });
          expect(invites.data).to.have.a.lengthOf(0);
        });
        it("I can invite users if I have enough PP and my PP are decreasing", async function() {
          const myUser = await createUser({ partyPoints: 16 });
          const otherUser = await createUser();
          const otherUser2 = await createUser();
          const partyId = (
            await createParty(myUser, { name: "test", capacity: 10 })
          ).body._id;

          const res = await inviteUsers(myUser, partyId, [
            otherUser,
            otherUser2,
          ]).expect(200);
          checkForSensitiveData(res.body);
          expect(res.body).to.have.a.lengthOf(2);
          const invites = await Invite.find({
            query: {
              party: partyId,
            },
          });
          expect(invites.data).to.have.a.lengthOf(2);
          let myUserDb = await User.getRaw(myUser._id);
          expect(myUserDb.partyPoints).to.be.equal(0);
        });
        it("I can invite users as a partyKing if I have enough PP and my PP are decreasing", async function() {
          const myUser = await createUser({
            isPartyKing: true,
            partyPoints: 16,
          });
          const otherUser = await createUser();
          const otherUser2 = await createUser();
          const partyId = (
            await createParty(myUser, { name: "test", capacity: 10 })
          ).body._id;

          const res = await inviteUsers(myUser, partyId, [
            otherUser,
            otherUser2,
          ]).expect(200);
          checkForSensitiveData(res.body);
          expect(res.body).to.have.a.lengthOf(2);
          const invites = await Invite.find({
            query: {
              party: partyId,
            },
          });
          expect(invites.data).to.have.a.lengthOf(2);
          let myUserDb = await User.getRaw(myUser._id);
          expect(myUserDb.partyPoints).to.be.equal(4);
        });
      });
    });
  });
});

after(async function() {
  if (process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
