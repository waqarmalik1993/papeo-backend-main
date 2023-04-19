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
  getFeed,
  createSwipe,
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
const Swipe = require("../../services/swipes/swipesService.js");
const generateUser = require("./data/getRandomUserData.js").generateUser;
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const generateNearbyCoords =
  require("./data/getRandomUserData.js").generateNearbyCoords;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
describe("/feed", function () {
  beforeEach(async function() {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("can get feed", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        location: { type: "Point", coordinates: generateNearbyCoords() },
      }).expect(200)
    ).body;
    const feed = await getFeed(myUser).expect(200);
    checkForSensitiveData(feed.body);
    feed.body.forEach((element) => {
      expect(element.data._id).to.not.equal(myUser._id.toString());
    });
    console.log(generateNearbyCoords());
    expect(feed.body).to.have.a.lengthOf(2);
    expect(feed.body[0].type).to.be.string("party");
  });
  it("swiped users and swiped parties are not in my feed", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        location: { type: "Point", coordinates: generateNearbyCoords() },
      }).expect(200)
    ).body._id;
    const feed = await getFeed(myUser).expect(200);
    feed.body.forEach((element) => {
      expect(element.data._id).to.not.equal(myUser._id.toString());
    });
    expect(feed.body).to.have.a.lengthOf(2);
    await createSwipe(myUser, {
      swipedUser: otherUser._id.toString(),
      swipe: false,
    });
    const feed2 = await getFeed(myUser).expect(200);
    expect(feed2.body).to.have.a.lengthOf(1);
    await createSwipe(myUser, {
      swipedParty: partyId,
      swipe: false,
    });
    const feed3 = await getFeed(myUser).expect(200);
    expect(feed3.body).to.have.a.lengthOf(0);
  });
  it.skip("parties seeding", async function() {
    const myUser = await createUser();

    await createParty(myUser, {}).expect(200);
    await createParty(myUser, {}).expect(200);
    await createParty(myUser, {}).expect(200);
    await createParty(myUser, {}).expect(200);
    await createParty(myUser, {}).expect(200);
    await createParty(myUser, {}).expect(200);
    await createParty(myUser, {}).expect(200);
    await createParty(myUser, {}).expect(200);
    await createParty(myUser, {}).expect(200);
    await createParty(myUser, {}).expect(200);
    await createParty(myUser, {}).expect(200);
  });
  it("expired parties are not in my feed", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const before7Days = new Date();
    before7Days.setDate(before7Days.getDate() - 7);
    const partyId = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        startDate: before7Days.toISOString(),
        location: { type: "Point", coordinates: generateNearbyCoords() },
      }).expect(200)
    ).body._id;
    const feed = await getFeed(myUser).expect(200);
    feed.body.forEach((element) => {
      expect(element.data._id).to.not.equal(myUser._id.toString());
    });
    expect(feed.body).to.have.a.lengthOf(1);
  });
  it("my own parties are not in my feed", async function() {
    const myUser = await createUser();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const partyId = (
      await createParty(myUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        startDate: in7Days.toISOString(),
        location: { type: "Point", coordinates: generateNearbyCoords() },
      }).expect(200)
    ).body._id;
    console.log({ myUser });
    const feed = await getFeed(myUser).expect(200);
    console.log(feed.body.owner);
    feed.body.forEach((element) => {
      expect(element.data.owner._id).to.not.equal(myUser._id.toString());
    });
    expect(feed.body).to.have.a.lengthOf(0);
  });
  it("full parties are not in my feed", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const partyId = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 1,
        privacyLevel: "open",
        startDate: in7Days.toISOString(),
        location: { type: "Point", coordinates: generateNearbyCoords() },
      }).expect(200)
    ).body._id;
    await joinParty(partyId, otherUser);
    const feed = await getFeed(myUser).expect(200);
    feed.body.forEach((element) => {
      expect(element.type).to.not.equal("party");
    });
    expect(feed.body).to.have.a.lengthOf(1);
  });
  it.skip("Party: friendsAttendingThisParty, guestCount", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const partyId = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 10,
        privacyLevel: "open",
        startDate: in7Days.toISOString(),
        location: { type: "Point", coordinates: generateNearbyCoords() },
      }).expect(200)
    ).body._id;
    await sendFriendRequest(myUser, otherUser);
    await acceptFriendRequest(otherUser, myUser);
    await joinParty(partyId, otherUser);
    const feed = await getFeed(myUser).expect(200);

    expect(feed.body[0].type).to.equal("party");

    expect(feed.body).to.have.a.lengthOf(1);
    expect(feed.body[0].data.friendsAttendingThisParty).to.have.a.lengthOf(1);
    expect(feed.body[0].data.friendsAttendingThisPartyCount).to.be.equal(1);
    expect(feed.body[0].data.guestCount).to.be.equal(1);
  });
  it("User: partyFriendsCount, sharedPartyFriends", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const otherUser2 = await createUser();
    await sendFriendRequest(myUser, otherUser);
    await acceptFriendRequest(otherUser, myUser);

    await sendFriendRequest(otherUser, otherUser2);
    await acceptFriendRequest(otherUser2, otherUser);

    const feed = await getFeed(myUser).expect(200);

    expect(feed.body[0].type).to.equal("user");

    expect(feed.body).to.have.a.lengthOf(1);
    //expect(feed.body[0].data.friendsAttendingThisParty).to.have.a.lengthOf(1);
    console.log(feed.body[0].data.sharedPartyFriends);
    expect(feed.body[0].data.sharedPartyFriends).to.have.a.lengthOf(1);
    expect(feed.body[0].data.partyFriendsCount).to.be.equal(1);
    expect(feed.body[0].data.sharedPartyFriendsCount).to.be.equal(1);
    expect(feed.body[0].data.followerCount).to.be.equal(0);
  });
  it("User: followerCount", async function() {
    const myUser = await createUser();
    const otherUser = await createUser();
    const otherUser2 = await createUser();
    // to exclude otherUser from feed
    await sendFriendRequest(myUser, otherUser);
    await acceptFriendRequest(otherUser, myUser);
    await followUser(otherUser, otherUser2);

    const feed = await getFeed(myUser).expect(200);

    expect(feed.body[0].type).to.equal("user");

    expect(feed.body).to.have.a.lengthOf(1);
    //expect(feed.body[0].data.friendsAttendingThisParty).to.have.a.lengthOf(1);
    console.log(feed.body[0].data.sharedPartyFriends);
    expect(feed.body[0].data.followerCount).to.be.equal(1);
    expect(feed.body[0].data.friendsWhoFollowThisUser).to.have.a.lengthOf(1);
  });
});

after(async function() {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
