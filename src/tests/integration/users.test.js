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
  blockUser,
  createParty,
  rateParty,
  joinParty,
  createPartyAdmin,
} = require("./helpers.js");
const h = require("./helpers.js");
const User = require("../../services/users/usersService.js");
const PartyGuest = require("../../services/partyGuests/partyGuestsService");
const MyPartyGuests = require("../../services/myPartyGuests/myPartyGuestsService");
const Party = require("../../services/parties/partiesService");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
describe("/users", function () {
  before(async () => {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("is not accessible without a token", async () => {
    const myUser = await createUser();
    await request(app)
      .get(`/users/${myUser._id.toString()}`)
      .expect("Content-Type", /json/)
      .expect(401);
  });
  it("can get own user", async () => {
    const myUser = await createUser();
    await getUser(myUser, myUser).expect(200);
  });
  it("can get a second user", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const res = await getUser(myUser, otherUser).expect(200);
    checkForSensitiveData(res.body);
  });
  it("own user should not contain tokens", async () => {
    const myUser = await createUser();
    const r = await getUser(myUser, myUser).expect(200);
    checkForSensitiveDataInOwnUser(r.body);
    expect(r.body.tokens).to.be.undefined;
  });
  it("own user should contain phoneNumber, email", async () => {
    const myUser = await createUser();
    const r = await getUser(myUser, myUser).expect(200);
    checkForSensitiveDataInOwnUser(r.body);
    expect(r.body).to.have.property("phoneNumber");
    expect(r.body).to.have.property("email");
  });
  it("response for other users should not contain phoneNumber, email", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const r = await getUser(myUser, otherUser).expect(200);
    checkForSensitiveDataInOwnUser(r.body);
    expect(r.body).to.not.have.property("phoneNumber");
    expect(r.body).to.not.have.property("email");
    checkForSensitiveData(r.body);
  });
  it("TODO response for other users should not contain (exact) locations", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const res = await getUser(myUser, otherUser).expect(200);
    checkForSensitiveData(res.body);
  });
  it("cannot delete other users", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const r = await deleteUser(myUser, otherUser).expect(403);
    checkForSensitiveData(r.body);
  });
  it("can delete own user, tokens are not in response, receive a 401 in the following requests", async () => {
    const myUser = await createUser();
    const r = await deleteUser(myUser, myUser).expect(200);

    expect(r.body).to.not.have.property("tokens");
    await getUser(myUser, myUser).expect(401);
  });
  describe("PATCH /users", function () {
    describe("username", function () {
      it("can set my username", async () => {
        const myUser = await createUser();
        const res = await patchUser(myUser, myUser, {
          username: "pizzalover3000",
        }).expect(200);
        const user = await getUser(myUser, myUser);
        expect(user.body.username).to.be.a.string("pizzalover3000");
      });
      it("cannot set a username with length under 3 and over 40", async () => {
        const myUser = await createUser();
        await patchUser(myUser, myUser, {
          username: "a",
        }).expect(400);
        await patchUser(myUser, myUser, {
          username: "ilikepizzaveryveryveryveryveryveryveryveryveryverymuch",
        }).expect(400);
      });
    });
  });
  describe("Availability check", function () {
    it("username is available", async () => {
      const myUser = await createUser();
      const res = await checkAvailability(myUser, {
        type: "username",
        username: "blub",
      }).expect(200);
      checkForSensitiveData(res.body);
    });
    it("username is not available", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await patchUser(myUser, myUser, { username: "wassermelone" }).expect(200);
      const res = await checkAvailability(otherUser, {
        type: "username",
        username: "wassermelone",
      }).expect(400);
      checkForSensitiveData(res.body);
      expect(res.body.data.code).to.be.eq(
        PAPEO_ERRORS.USERNAME_ALREADY_EXISTS.code
      );
    });
    it("phoneNumber is available", async () => {
      const myUser = await createUser();
      const res = await checkAvailability(myUser, {
        type: "phoneNumber",
        phoneNumber: "+4917643371318",
      }).expect(200);
      checkForSensitiveData(res.body);
    });
    it("phoneNumber is not available", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      // patch phoneNumber directly to avoid sms
      await User.patch(otherUser._id, {
        phoneNumber: "+4917643371318",
      });
      const res = await checkAvailability(myUser, {
        type: "phoneNumber",
        phoneNumber: "+4917643371318",
      }).expect(400);
      checkForSensitiveData(res.body);
      expect(res.body.data.code).to.be.eq(
        PAPEO_ERRORS.USER_WITH_PHONENUMBER_ALREADY_EXISTS.code
      );
    });
    it("email is available", async () => {
      const myUser = await createUser();
      const res = await checkAvailability(myUser, {
        type: "email",
        email: "test@neon.dev",
      }).expect(200);
      checkForSensitiveData(res.body);
    });
    it("email is not available", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      // patch email directly to avoid email
      await User.patch(otherUser._id, {
        email: "test@neon.dev",
      });
      const res = await checkAvailability(myUser, {
        type: "email",
        email: "test@neon.dev",
      }).expect(400);
      expect(res.body.data.code).to.be.eq(
        PAPEO_ERRORS.EMAIL_ALREADY_EXISTS.code
      );
    });
  });

  describe("Followers", function () {
    it("I can follow a user but not twice", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await followUser(myUser, otherUser).expect(200);
      const res = await followUser(myUser, otherUser).expect(400);
      expect(res.body.data.code).to.be.eq(
        PAPEO_ERRORS.ALREADY_FOLLOWING_THIS_USER.code
      );
      checkForSensitiveData(res.body);
    });
    it("I cannot follow myself", async () => {
      const myUser = await createUser();
      const res = await followUser(myUser, myUser).expect(400);
      expect(res.body.data.code).to.be.eq(
        PAPEO_ERRORS.YOU_CANNOT_FOLLOW_YOURSELF.code
      );
      checkForSensitiveData(res.body);
    });
    it("Follower count is 0 if new account", async () => {
      const myUser = await createUser();
      const followers = (await getFollowers(myUser, myUser).expect(200)).body
        .data;
      expect(followers).to.have.lengthOf(0);
      checkForSensitiveData(followers);
    });
    it("Follower count is 1 if a user follows me", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await followUser(otherUser, myUser);
      const followers = (await getFollowers(myUser, myUser).expect(200)).body
        .data;
      expect(followers).to.have.lengthOf(1);
    });
    it("Follower count is 1 if a user follows me and a user follows another user", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      const otherUser2 = await createUser();
      await followUser(otherUser, myUser);
      await followUser(otherUser2, otherUser);
      const followers = (await getFollowers(myUser, myUser).expect(200)).body
        .data;
      checkForSensitiveData(followers);
      expect(followers).to.have.lengthOf(1);
    });
    it("I cannot unfollow a user if I dont follow that user", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      const res = await unfollowUser(otherUser, myUser).expect(400);
      expect(res.body.data.code).to.be.eq(
        PAPEO_ERRORS.YOU_ARE_NOT_FOLLOWING_THIS_USER.code
      );
      checkForSensitiveData(res.body);
    });
    it("Follower count is 0 if a user unfollows me", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await followUser(myUser, otherUser);
      await unfollowUser(myUser, otherUser);
      const followers = (await getFollowers(myUser, myUser).expect(200)).body
        .data;
      expect(followers).to.have.lengthOf(0);
    });
  });
  describe("Friends", function () {
    it("I can send a friend request but not twice", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await sendFriendRequest(myUser, otherUser).expect(200);
      const res = await sendFriendRequest(myUser, otherUser).expect(400);
      expect(res.body.data.code).to.be.eq(PAPEO_ERRORS.ALREADY_FRIENDS.code);
    });
    it("I cannot send myself a friend request", async () => {
      const myUser = await createUser();
      const res = await sendFriendRequest(myUser, myUser).expect(400);
      expect(res.body.data.code).to.be.eq(
        PAPEO_ERRORS.YOU_CANNOT_FRIEND_REQUEST_YOURSELF.code
      );
    });
    it("I can see my friend own incoming friend requests", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await sendFriendRequest(otherUser, myUser).expect(200);
      const myFriends = await (
        await getFriends(myUser, myUser).expect(200)
      ).body.data;
      expect(myFriends).to.have.lengthOf(1);
      expect(myFriends[0].status).to.be.equal("requested");
    });
    it("I can see my friend own outgoing friend requests", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await sendFriendRequest(myUser, otherUser).expect(200);
      const myFriends = await (
        await getFriends(myUser, myUser).expect(200)
      ).body.data;
      expect(myFriends).to.have.lengthOf(1);
      expect(myFriends[0].status).to.be.equal("requested_by_me");
    });
    it("I cannot see other users friends requests", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await sendFriendRequest(myUser, otherUser).expect(200);
      const myFriends = await (
        await getFriends(myUser, otherUser).expect(200)
      ).body.data;
      expect(myFriends).to.have.lengthOf(0);
    });
    it("I can accept a friend request but not twice", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await sendFriendRequest(otherUser, myUser).expect(200);

      await acceptFriendRequest(myUser, otherUser).expect(200);
      const myFriends = await (
        await getFriends(myUser, myUser).expect(200)
      ).body.data;
      expect(myFriends).to.have.lengthOf(1);
      expect(myFriends[0].status).to.be.equal("accepted");
      const otherUsersFriends = await (
        await getFriends(otherUser, otherUser).expect(200)
      ).body.data;
      expect(otherUsersFriends).to.have.lengthOf(1);
      expect(otherUsersFriends[0].status).to.be.equal("accepted");

      const res = await acceptFriendRequest(myUser, otherUser).expect(400);
      expect(res.body.data.code).to.be.eq(
        PAPEO_ERRORS.THERE_IS_NO_SUCH_FRIEND_REQUEST.code
      );
    });
    it("I can decline a friend request", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await sendFriendRequest(otherUser, myUser).expect(200);

      await deleteFriend(myUser, otherUser).expect(200);
      const myFriends = await (
        await getFriends(myUser, myUser).expect(200)
      ).body.data;
      expect(myFriends).to.have.lengthOf(0);

      const otherUsersFriends = await (
        await getFriends(otherUser, otherUser).expect(200)
      ).body.data;
      expect(otherUsersFriends).to.have.lengthOf(0);
    });
    it("I can unfriend a user", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      checkForSensitiveData(
        (await sendFriendRequest(otherUser, myUser).expect(200)).body
      );
      checkForSensitiveData(
        (await acceptFriendRequest(myUser, otherUser).expect(200)).body
      );
      await deleteFriend(myUser, otherUser).expect(200);
      const myFriends = await (
        await getFriends(myUser, myUser).expect(200)
      ).body.data;
      expect(myFriends).to.have.lengthOf(0);
      const otherUsersFriends = await (
        await getFriends(otherUser, otherUser).expect(200)
      ).body.data;
      expect(otherUsersFriends).to.have.lengthOf(0);
    });
    describe("Blocked Users", async () => {
      it("29. get blocked user should return 404", async () => {
        const myUser = await createUser();
        const otherUser = await createUser();
        await getUser(myUser, otherUser).expect(200);
        await blockUser(otherUser, myUser).expect(200);
        await getUser(myUser, otherUser).expect(404);
      });
      it("9. cannot join party if blocked", async () => {
        const myUser = await createUser();
        const otherUser = await createUser();
        const partyId = (
          await createParty(myUser, { name: "test", capacity: 10 })
        ).body._id;
        const otherPartyId = (
          await createParty(otherUser, { name: "test", capacity: 10 })
        ).body._id;
        await blockUser(myUser, otherUser).expect(200);
        const res1 = await joinParty(partyId, otherUser).expect(404);
        const res2 = await joinParty(otherPartyId, myUser).expect(404);
      });
      it("11. cannot rate party if blocked", async () => {
        const myUser = await createUser();
        const otherUser = await createUser();

        const partyId = (
          await createParty(myUser, { name: "test", capacity: 10 })
        ).body._id;
        const otherPartyId = (
          await createParty(otherUser, { name: "test", capacity: 10 })
        ).body._id;
        await joinParty(partyId, otherUser).expect(200);
        await joinParty(otherPartyId, myUser).expect(200);
        await blockUser(otherUser, myUser).expect(200);
        const rating = (await rateParty(partyId, otherUser, 4).expect(404))
          .body;
        const rating2 = (await rateParty(otherPartyId, myUser, 4).expect(404))
          .body;
      });
      it("13. user is removed from guestlist", async () => {
        const myUser = await createUser();
        const otherUser = await createUser();
        const otherUser2 = await createUser();

        const partyId = (
          await createParty(myUser, { name: "test", capacity: 10 })
        ).body._id;
        const otherPartyId = (
          await createParty(otherUser, { name: "test", capacity: 10 })
        ).body._id;
        await joinParty(partyId, otherUser).expect(200);
        await joinParty(otherPartyId, myUser).expect(200);
        await joinParty(otherPartyId, otherUser2).expect(200);
        expect(
          await PartyGuest.MODEL.find({ party: partyId })
        ).to.have.a.lengthOf(1);
        expect(
          await PartyGuest.MODEL.find({ party: otherPartyId })
        ).to.have.a.lengthOf(2);

        await blockUser(otherUser, myUser).expect(200);

        expect(
          await PartyGuest.MODEL.find({ party: partyId })
        ).to.have.a.lengthOf(0);
        expect(
          await PartyGuest.MODEL.find({ party: otherPartyId })
        ).to.have.a.lengthOf(1);
      });
      it("22. blocked user is removed from party admin list", async () => {
        const myUser = await createUser();
        const otherUser = await createUser();

        const partyId = (
          await createParty(myUser, { name: "test", capacity: 10 })
        ).body._id;

        await joinParty(partyId, otherUser).expect(200);
        await createPartyAdmin(myUser, partyId, otherUser).expect(200);
        expect((await Party.get(partyId)).admins).to.have.a.lengthOf(1);

        await blockUser(otherUser, myUser).expect(200);
        expect((await Party.get(partyId)).admins).to.have.a.lengthOf(0);
      });
      it("22. blocking user is removed from party admin list", async () => {
        const myUser = await createUser();
        const otherUser = await createUser();

        const partyId = (
          await createParty(myUser, { name: "test", capacity: 10 })
        ).body._id;

        await joinParty(partyId, otherUser).expect(200);
        await createPartyAdmin(myUser, partyId, otherUser).expect(200);
        expect((await Party.get(partyId)).admins).to.have.a.lengthOf(1);

        await blockUser(myUser, otherUser).expect(200);
        expect((await Party.get(partyId)).admins).to.have.a.lengthOf(0);
      });
      it("30. follower is removed", async () => {
        const myUser = await createUser();
        const otherUser = await createUser();

        await followUser(myUser, otherUser).expect(200);

        let followers = (await getFollowers(myUser, otherUser).expect(200)).body
          .data;
        expect(followers).to.have.lengthOf(1);
        await blockUser(myUser, otherUser).expect(200);
        followers = (await getFollowers(myUser, otherUser).expect(200)).body
          .data;
        expect(followers).to.have.lengthOf(0);
      });
    });
    describe("User deletion", async () => {
      it("My Party Guests are deleted when I delete my user account", async () => {
        const myUser = await createUser();
        const otherUser = await createUser();
        await h.createMyPartyGuest(myUser, otherUser).expect(200);
        let myPartyGuests = await MyPartyGuests.MODEL.find({
          user: myUser._id,
        });
        expect(myPartyGuests.length).to.be.equal(1);
        await h.deleteUser(myUser, myUser).expect(200);

        myPartyGuests = await MyPartyGuests.MODEL.find({
          user: myUser._id,
        });
        expect(myPartyGuests.length).to.be.equal(0);
      });
      it("I am deleted from other MyPartyGuests when I delete my user account", async () => {
        const myUser = await createUser();
        const otherUser = await createUser();
        await h.createMyPartyGuest(myUser, otherUser).expect(200);
        let myPartyGuests = await MyPartyGuests.MODEL.find({
          user: myUser._id,
        });
        expect(myPartyGuests.length).to.be.equal(1);
        await h.deleteUser(otherUser, otherUser).expect(200);

        myPartyGuests = await MyPartyGuests.MODEL.find({
          user: myUser._id,
        });
        expect(myPartyGuests.length).to.be.equal(0);
        myPartyGuests = await MyPartyGuests.MODEL.find({
          guest: otherUser._id,
        });
        expect(myPartyGuests.length).to.be.equal(0);
      });
    });
  });
});

after(async () => {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
