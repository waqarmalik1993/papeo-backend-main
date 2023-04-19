const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const getUser = require("./helpers.js").getUser;
const followUser = require("./helpers.js").followUser;
const sendFriendRequest = require("./helpers.js").sendFriendRequest;
const deleteFriend = require("./helpers.js").deleteFriend;
const acceptFriendRequest = require("./helpers.js").acceptFriendRequest;
const getFriends = require("./helpers.js").getFriends;
const unfollowUser = require("./helpers.js").unfollowUser;
const getFollowers = require("./helpers.js").getFollowers;
const checkAvailability = require("./helpers.js").checkAvailability;
const patchUser = require("./helpers.js").patchUser;
const deleteUser = require("./helpers.js").deleteUser;
const createUser = require("./helpers.js").createUser;
const createParty = require("./helpers.js").createParty;
const getUsersS3Uploads = require("./helpers.js").getUsersS3Uploads;
const removeUpload = require("./helpers.js").removeUpload;
const removePost = require("./helpers.js").removePost;
const createPostWith3Pictures = require("./helpers.js").createPostWith3Pictures;
const uploadFilesToParty = require("./helpers.js").uploadFilesToParty;
const uploadProfilePicture = require("./helpers.js").uploadProfilePicture;
const createSwipe = require("./helpers.js").createSwipe;
const uploadVerificationFile = require("./helpers.js").uploadVerificationFile;
const wipeDatabaseAndEmptyS3Bucket =
  require("./helpers.js").wipeDatabaseAndEmptyS3Bucket;
const User = require("../../services/users/usersService.js");
const Upload = require("../../services/uploads/uploadsService.js");
const Party = require("../../services/parties/partiesService.js");
const Swipe = require("../../services/swipes/swipesService.js");
const Bookmark = require("../../services/bookmarks/bookmarksService.js");
const Post = require("../../services/posts/postsService.js");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
describe("/swipes", function () {
  before(async () => {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });

  it("can swipe a party left and no bookmark is created", async () => {
    const myUser = await createUser();
    const partyId = (await createParty(myUser, { name: "test" })).body._id;

    const res = await createSwipe(myUser, {
      swipedParty: partyId,
      swipe: false,
    }).expect(200);

    const swipes = await Swipe.find({
      query: {
        user: myUser._id.toString(),
        swipedParty: partyId,
        swipe: false,
      },
    });
    expect(swipes.data).to.have.a.lengthOf(1);
    const bookmarks = await Bookmark.find({
      query: {
        user: myUser._id.toString(),
        party: partyId,
      },
    });
    expect(bookmarks.data).to.have.a.lengthOf(0);
  });
  it("can swipe a party right and a bookmark is created", async () => {
    const myUser = await createUser();
    const partyId = (await createParty(myUser, { name: "test" })).body._id;

    const res = await createSwipe(myUser, {
      swipedParty: partyId,
      swipe: true,
    }).expect(200);

    const swipes = await Swipe.find({
      query: {
        user: myUser._id.toString(),
        swipedParty: partyId,
        swipe: true,
      },
    });
    expect(swipes.data).to.have.a.lengthOf(1);
    const bookmarks = await Bookmark.find({
      query: {
        user: myUser._id.toString(),
        party: partyId,
      },
    });
    expect(bookmarks.data).to.have.a.lengthOf(1);
  });
  it("can swipe a user left and no friend request is sent", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();

    const res = await createSwipe(myUser, {
      swipedUser: otherUser._id.toString(),
      swipe: false,
    }).expect(200);

    const swipes = await Swipe.find({
      query: {
        user: myUser._id.toString(),
        swipedUser: otherUser._id.toString(),
        swipe: false,
      },
    });
    expect(swipes.data).to.have.a.lengthOf(1);
    const myFriends = await (
      await getFriends(myUser, myUser).expect(200)
    ).body.data;
    expect(myFriends).to.have.lengthOf(0);
  });
  it("can swipe a user right and a friend request is sent", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();

    const res = await createSwipe(myUser, {
      swipedUser: otherUser._id.toString(),
      swipe: true,
    }).expect(200);

    const swipes = await Swipe.find({
      query: {
        user: myUser._id.toString(),
        swipedUser: otherUser._id.toString(),
        swipe: true,
      },
    });
    console.log(swipes.data);
    expect(swipes.data).to.have.a.lengthOf(1);
    const myFollowers = await (
      await getFollowers(myUser, otherUser).expect(200)
    ).body.data;
    expect(myFollowers).to.have.lengthOf(1);
  });
});

after(async () => {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
