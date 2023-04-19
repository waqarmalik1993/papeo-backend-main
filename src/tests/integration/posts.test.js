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
  createParty,
  getUsersS3Uploads,
  removeUpload,
  removePost,
  uploadFilesToParty,
  uploadProfilePicture,
  uploadVerificationFile,
  getPostComments,
  createPost,
  deletePostComment,
  createPostComment,
  wipeDatabaseAndEmptyS3Bucket,
  checkForSensitiveData,
  uploadPartyPic,
} = require("./helpers.js");
const User = require("../../services/users/usersService.js");
const Upload = require("../../services/uploads/uploadsService.js");
const Party = require("../../services/parties/partiesService.js");
const Post = require("../../services/posts/postsService.js");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
describe("/uploads", function () {
  before(async () => {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  describe.skip("Comments", function () {
    it("can create and get comments", async () => {
      const myUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;

      const files = [
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
      ];
      const res = await createPost(
        myUser,
        partyId,
        "description",
        files
      ).expect(200);
      checkForSensitiveData(res.body);
      await createPostComment(myUser, res.body._id, "ok cool").expect(200);
      await createPostComment(myUser, res.body._id, "ok nicht so cool").expect(
        200
      );
      const comments = await getPostComments(myUser, res.body._id).expect(200);
      expect(comments.body.data).to.have.a.lengthOf(2);
    });
    it("can not create a comment for a not existing post", async () => {
      const myUser = await createUser();
      const nonExistingPostId = "00dcb3d68f2108155f953780";
      const res = await createPostComment(
        myUser,
        nonExistingPostId,
        "ok cool"
      ).expect(404);
      console.log(res.body);
      expect(res.body.data.code).to.equal(
        PAPEO_ERRORS.POST_DOES_NOT_EXIST.code
      );

      const comments = await getPostComments(myUser, nonExistingPostId).expect(
        200
      );
      expect(comments.body.data).to.have.a.lengthOf(0);
    });
    it("I can delete my own comments", async () => {
      const myUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;

      const files = [
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
      ];
      const res = await createPost(
        myUser,
        partyId,
        "description",
        files
      ).expect(200);
      const comment1 = (
        await createPostComment(myUser, res.body._id, "ok cool").expect(200)
      ).body;
      const comment2 = (
        await createPostComment(
          myUser,
          res.body._id,
          "ok nicht so cool"
        ).expect(200)
      ).body;
      const res2 = await deletePostComment(
        myUser,
        res.body._id,
        comment1._id
      ).expect(200);
      checkForSensitiveData(res2.body);
      await deletePostComment(myUser, res.body._id, comment2._id).expect(200);
      const comments = await getPostComments(myUser, res.body._id).expect(200);
      expect(comments.body.data).to.have.a.lengthOf(0);
    });
    it("I cannot delete comments from other users", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;

      const files = [
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
      ];
      const res = await createPost(
        myUser,
        partyId,
        "description",
        files
      ).expect(200);
      const comment1 = (
        await createPostComment(otherUser, res.body._id, "ok cool").expect(200)
      ).body;

      const res2 = await deletePostComment(
        myUser,
        res.body._id,
        comment1._id
      ).expect(403);
      expect(res2.body.data.code).to.equal(PAPEO_ERRORS.WRONG_USER_ROLE.code);
      const comments = await getPostComments(myUser, res.body._id).expect(200);
      expect(comments.body.data).to.have.a.lengthOf(1);
    });
  });
});

after(async () => {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
