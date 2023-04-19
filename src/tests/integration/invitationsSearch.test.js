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
  invitationsSearch,
  inviteUsers,
  getDatePlusHours,
  getDatePlusMinutes,
  sendFriendRequest,
  acceptFriendRequest,
  followUser,
} = require("./helpers");
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
describe("/invites/search", function () {
  beforeEach(async () => {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  const COORDS = "&lat=12.0&long=52.0";
  it("route is available", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const party = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        location: { type: "Point", coordinates: generateNearbyCoords() },
      }).expect(200)
    ).body;
    const search = await invitationsSearch(myUser, party._id, COORDS).expect(
      200
    );
    expect(search.body.data).to.have.a.lengthOf(1);
  });
  it("partyguests are filtered", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const otherUser2 = await createUser();
    const party = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        location: { type: "Point", coordinates: generateNearbyCoords() },
      }).expect(200)
    ).body;
    await joinParty(party._id, otherUser).expect(200);
    await joinParty(party._id, otherUser2).expect(200);
    const search = await invitationsSearch(myUser, party._id, COORDS).expect(
      200
    );
    expect(search.body.data).to.have.a.lengthOf(0);
  });
  describe("Overlapping Parties logic", async () => {
    async function party(user, startDate, endDate) {
      return (
        await createParty(user, {
          startDate,
          endDate,
        }).expect(200)
      ).body;
    }
    it("Overlapping Parties logic", async () => {
      const myUser = await createUser();
      const party1 = await party(
        myUser,
        getDatePlusHours(0),
        getDatePlusHours(10)
      );
      await party(myUser, getDatePlusHours(0), getDatePlusHours(10));
      let overlapping = await Party.getOverlappingParties(party1);
      expect(overlapping).to.have.a.lengthOf(1);

      // create a parties after party1
      await party(myUser, getDatePlusHours(10), getDatePlusHours(20));
      await party(myUser, getDatePlusHours(10), undefined);
      await party(myUser, getDatePlusHours(12), undefined);
      overlapping = await Party.getOverlappingParties(party1);
      expect(overlapping).to.have.a.lengthOf(1);

      // create a parties before party1
      await party(myUser, getDatePlusHours(-10), getDatePlusHours(-0.1));
      await party(myUser, getDatePlusHours(-2.1), undefined);
      await party(myUser, getDatePlusHours(-10), undefined);
      overlapping = await Party.getOverlappingParties(party1);
      expect(overlapping).to.have.a.lengthOf(1);

      // create a overlapping parties to party1
      await party(myUser, getDatePlusHours(-10), getDatePlusHours(0.1));
      await party(myUser, getDatePlusHours(-1.9), undefined);
      await party(myUser, getDatePlusHours(9.5), undefined);
      overlapping = await Party.getOverlappingParties(party1);
      expect(overlapping).to.have.a.lengthOf(4);
    });
  });
  /* Wurde rausgenommen
  it("partyguests from other parties at the same time are filtered", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const otherUser2 = await createUser();
    const otherUser3 = await createUser();
    const otherUser4 = await createUser();
    const otherUser5 = await createUser();
    const party1 = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        location: { type: "Point", coordinates: generateNearbyCoords() },
        startDate: getDatePlusHours(10),
        endDate: getDatePlusHours(20),
      }).expect(200)
    ).body;
    const party2 = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        location: { type: "Point", coordinates: generateNearbyCoords() },
        startDate: getDatePlusHours(10),
        endDate: getDatePlusHours(20),
      }).expect(200)
    ).body;
    const party3 = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        location: { type: "Point", coordinates: generateNearbyCoords() },
        startDate: getDatePlusHours(20),
        endDate: getDatePlusHours(24),
      }).expect(200)
    ).body;
    await joinParty(party1._id, otherUser).expect(200);
    //await joinParty(party._id, otherUser2).expect(200);
    await joinParty(party2._id, otherUser3).expect(200);
    await joinParty(party2._id, otherUser4).expect(200);

    await joinParty(party3._id, otherUser5).expect(200);
    await joinParty(party2._id, otherUser5).expect(200);
    const search = await invitationsSearch(myUser, party1._id, COORDS).expect(
      200
    );
    console.log({
      search: search.body.data,
      party1: party1._id,
      party2: party2._id,
    });
    expect(search.body.data).to.have.a.lengthOf(1);
  });
  */

  /* Wurde rausgenommen
it.only("already invited users are filtered", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const otherUser2 = await createUser();
    const party = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        location: { type: "Point", coordinates: generateNearbyCoords() },
      }).expect(200)
    ).body;
    // I must be a guest of the party to invite others
    await joinParty(party._id, myUser).expect(200);

    await inviteUsers(myUser, party._id, [otherUser]).expect(200);
    await inviteUsers(myUser, party._id, [otherUser2]).expect(200);
    const search = await invitationsSearch(myUser, party._id, COORDS).expect(
      200
    );
    expect(search.body.data).to.have.a.lengthOf(0);
  });
  it("already invited users are filtered 2", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const otherUser2 = await createUser();
    const party = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        location: { type: "Point", coordinates: generateNearbyCoords() },
      }).expect(200)
    ).body;
    const party2 = (
      await createParty(otherUser, {
        name: "Test Party",
        status: "published",
        capacity: 100,
        location: { type: "Point", coordinates: generateNearbyCoords() },
      }).expect(200)
    ).body;
    // I must be a guest of the party to invite others
    await joinParty(party._id, myUser).expect(200);
    await joinParty(party2._id, myUser).expect(200);

    await inviteUsers(myUser, party2._id, [otherUser]).expect(200);

    await inviteUsers(myUser, party._id, [otherUser]).expect(200);
    await inviteUsers(myUser, party._id, [otherUser2]).expect(200);
    const search = await invitationsSearch(myUser, party._id, COORDS).expect(
      200
    );
    expect(search.body.data).to.have.a.lengthOf(0);
  });
  */
  describe("Users Relationship category in search", async () => {
    it("If there is no relationship, the category is 'other'", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;

      const search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      console.log(search.body.data);
      expect(search.body.data[0].relationship).to.deep.equal({
        followingMe: false,
        myPartyGuests: false,
        followers: false,
        partyFriends: false,
        others: true,
      });
    });
    it("If user are friends, the category is 'partyFriends'", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await sendFriendRequest(myUser, otherUser);
      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;
      let search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      expect(search.body.data[0].relationship).to.deep.equal({
        followingMe: false,
        myPartyGuests: false,
        followers: false,
        partyFriends: false,
        others: true,
      });

      await acceptFriendRequest(otherUser, myUser);

      search = await invitationsSearch(myUser, party._id, COORDS).expect(200);
      console.log(search.body.data[0].relationship);
      expect(search.body.data[0].relationship).to.deep.equal({
        followingMe: false,
        myPartyGuests: false,
        followers: false,
        partyFriends: true,
        others: false,
      });
    });
    it("If user1 is following user2, the category is 'following'", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();

      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;
      let search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      expect(search.body.data[0].relationship).to.deep.equal({
        followingMe: false,
        myPartyGuests: false,
        followers: false,
        partyFriends: false,
        others: true,
      });

      await followUser(otherUser, myUser);

      search = await invitationsSearch(myUser, party._id, COORDS).expect(200);
      console.log(search.body.data[0].relationship);
      expect(search.body.data[0].relationship).to.deep.equal({
        followingMe: true,
        myPartyGuests: false,
        followers: false,
        partyFriends: false,
        others: false,
      });
    });
    it("If user2 is following user1, the category is 'followers'", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();

      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;
      let search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      expect(search.body.data[0].relationship).to.deep.equal({
        followingMe: false,
        myPartyGuests: false,
        followers: false,
        partyFriends: false,
        others: true,
      });

      await followUser(myUser, otherUser);

      search = await invitationsSearch(myUser, party._id, COORDS).expect(200);
      console.log(search.body.data[0].relationship);
      expect(search.body.data[0].relationship).to.deep.equal({
        followingMe: false,
        myPartyGuests: false,
        followers: true,
        partyFriends: false,
        others: false,
      });
    });
    it("If user2 is following user1, and they are friends the categories are 'followers' and partyFriends", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();

      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;
      let search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      expect(search.body.data[0].relationship).to.deep.equal({
        followingMe: false,
        myPartyGuests: false,
        followers: false,
        partyFriends: false,
        others: true,
      });

      await followUser(myUser, otherUser);
      await sendFriendRequest(otherUser, myUser);
      await acceptFriendRequest(myUser, otherUser);
      search = await invitationsSearch(myUser, party._id, COORDS).expect(200);
      console.log(search.body.data[0].relationship);
      expect(search.body.data[0].relationship).to.deep.equal({
        followingMe: false,
        myPartyGuests: false,
        followers: true,
        partyFriends: true,
        others: false,
      });
    });
  });
  describe("Users Invitation Settings", async () => {
    it("Can invite user by default", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;

      console.log(otherUser.settings.notifications);
      const search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
    });
    it("Cannot invite user if he has others turned off", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await User.patch(otherUser._id, {
        "settings.invitations.others": false,
      });
      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;

      const search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(0);
    });
    /* Wurde rausgenommen
    it("Cannot invite user if he has friends turned off", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await User.patch(otherUser._id, {
        "settings.invitations.partyFriends": false,
      });
      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;

      let search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
      await sendFriendRequest(otherUser, myUser);
      await acceptFriendRequest(myUser, otherUser);

      search = await invitationsSearch(myUser, party._id, COORDS).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(0);
    });
    */
    it("Cannot invite user if he has following turned off", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await User.patch(otherUser._id, {
        "settings.invitations.following": false,
      });
      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;

      let search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
      await followUser(otherUser, myUser);

      search = await invitationsSearch(myUser, party._id, COORDS).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(0);
    });
    it("Cannot invite user if he has followers turned off", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await User.patch(otherUser._id, {
        "settings.invitations.followers": false,
      });
      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;

      let search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
      await followUser(myUser, otherUser);

      search = await invitationsSearch(myUser, party._id, COORDS).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(0);
    });
    const zeroKm = [13.401752, 52.479354];
    const coordsQueryZeroKm = `&lat=${zeroKm[1]}&long=${zeroKm[0]}`;

    const tenKm = [13.402944485313062, 52.56929847575323];
    const fiftyKm = [13.411117970219214, 52.928887870059604];
    const twohundredKm = [13.04788404155393, 54.26647556081062];
    it("Cannot invite user if he is not within distance", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await User.patch(otherUser._id, {
        "settings.invitations.distanceTo": 0,
        "currentLocation.coordinates": zeroKm,
      });
      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;

      let search = await invitationsSearch(
        myUser,
        party._id,
        coordsQueryZeroKm
      ).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
      await User.patch(otherUser._id, {
        "settings.invitations.distanceTo": 100,
        "currentLocation.coordinates": twohundredKm,
      });

      search = await invitationsSearch(
        myUser,
        party._id,
        coordsQueryZeroKm
      ).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(0);

      await User.patch(otherUser._id, {
        "settings.invitations.distanceTo": 201,
        "currentLocation.coordinates": twohundredKm,
      });

      search = await invitationsSearch(
        myUser,
        party._id,
        coordsQueryZeroKm
      ).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);

      await User.patch(otherUser._id, {
        "settings.invitations.distanceTo": 100,
        "currentLocation.coordinates": fiftyKm,
      });
      search = await invitationsSearch(
        myUser,
        party._id,
        coordsQueryZeroKm + "&distance_to=49"
      ).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(0);

      search = await invitationsSearch(
        myUser,
        party._id,
        coordsQueryZeroKm + "&distance_to=51"
      ).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
    });
    it("Cannot invite user if he is not within minimum distance", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await User.patch(otherUser._id, {
        "settings.invitations.distanceTo": 0,
        "settings.invitations.distanceFrom": 0,
        "currentLocation.coordinates": zeroKm,
      });
      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;

      let search = await invitationsSearch(
        myUser,
        party._id,
        coordsQueryZeroKm
      ).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
      await User.patch(otherUser._id, {
        "settings.invitations.distanceFrom": 51,
        "currentLocation.coordinates": fiftyKm,
      });

      search = await invitationsSearch(
        myUser,
        party._id,
        coordsQueryZeroKm
      ).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(0);

      await User.patch(otherUser._id, {
        "settings.invitations.distanceFrom": 49,
        "currentLocation.coordinates": fiftyKm,
      });

      search = await invitationsSearch(
        myUser,
        party._id,
        coordsQueryZeroKm
      ).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);

      await User.patch(otherUser._id, {
        "settings.invitations.distanceFrom": 1,
        "currentLocation.coordinates": fiftyKm,
      });
      search = await invitationsSearch(
        myUser,
        party._id,
        coordsQueryZeroKm + "&distance_from=51"
      ).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(0);

      search = await invitationsSearch(
        myUser,
        party._id,
        coordsQueryZeroKm + "&distance_from=49"
      ).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
    });
  });
  describe("Party Points for invitations", async () => {
    it("Invitation cost is 0 for friends", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;
      let search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
      expect(search.body.data[0].invitationCost).to.be.equal(8);
      await sendFriendRequest(myUser, otherUser);
      await acceptFriendRequest(otherUser, myUser);
      search = await invitationsSearch(myUser, party._id, COORDS).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
      expect(search.body.data[0].invitationCost).to.be.equal(0);
    });
    it("Invitation cost is 6 for partyKings", async () => {
      const myUser = await createUser({ isPartyKing: true });
      const otherUser = await createUser();
      const party = (
        await createParty(otherUser, {
          name: "Test Party",
          status: "published",
          capacity: 100,
          location: { type: "Point", coordinates: generateNearbyCoords() },
        }).expect(200)
      ).body;
      let search = await invitationsSearch(myUser, party._id, COORDS).expect(
        200
      );
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
      expect(search.body.data[0].invitationCost).to.be.equal(6);

      await followUser(myUser, otherUser);
      await followUser(otherUser, myUser);
      search = await invitationsSearch(myUser, party._id, COORDS).expect(200);
      console.log(search.body.data);
      expect(search.body.data).to.have.a.lengthOf(1);
      expect(search.body.data[0].invitationCost).to.be.equal(6);
    });
  });
});

after(async () => {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
