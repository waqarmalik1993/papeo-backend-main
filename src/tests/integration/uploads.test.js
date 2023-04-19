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
  createPost,
  uploadFilesToParty,
  setProfilePicture,
  wipeDatabaseAndEmptyS3Bucket,
  changePartyUploadOrder,
  updateMessage,
  getPresignedUploadUrl,
  setVerificationVideo,
  uploadProfilePic,
  uploadPartyPic,
  uploadVerificationVideo,
} = require("./helpers");
const h = require("./helpers");
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
  this.timeout(10000);
  before(async () => {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  describe("New Upload", function () {
    it("can get a presigned upload link", async () => {
      const myUser = await createUser();
      const res = await getPresignedUploadUrl(myUser).expect(200);
      expect(res.body.url).to.be.a.string;
    });
  });
  describe("Profile picture", function () {
    it("can upload a profile pictured", async () => {
      const myUser = await createUser();
      const pic = await uploadProfilePic(myUser);
      const res = await setProfilePicture(myUser, pic).expect(200);
      expect(res.body._id).to.be.equal(pic._id.toString());

      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);

      const databaseUser = await User.get(myUser._id);
      expect(databaseUser.profilePicture.toString()).to.equal(
        res.body._id.toString()
      );
    });
    it("a second upload deletes my old profile picture", async () => {
      const myUser = await createUser();
      const pic = await uploadProfilePic(myUser);
      const res = await setProfilePicture(myUser, pic).expect(200);

      const pic2 = await uploadProfilePic(myUser);
      const res2 = await setProfilePicture(myUser, pic2).expect(200);
      console.log(res2.body);
      const uploads = await getUsersS3Uploads(myUser);

      const oldFileKey = res.body.key;
      const newFileKey = res2.body.key;

      expect(uploads).to.have.a.lengthOf(1);
      expect(uploads.filter((u) => u.Key === oldFileKey)).to.have.a.lengthOf(0);
      expect(uploads.filter((u) => u.Key === newFileKey)).to.have.a.lengthOf(1);

      const databaseUser = await User.get(myUser._id.toString());
      const dbProfilePics = (
        await Upload.find({
          query: {
            profilePictureFromUser: myUser._id.toString(),
          },
        })
      ).data;
      const dbPic = dbProfilePics[0];

      expect(databaseUser.profilePicture.toString()).to.equal(
        dbPic._id.toString()
      );
    });
    it("deletion of profile picture is reflected in users object", async () => {
      const myUser = await createUser();
      const pic = await uploadProfilePic(myUser);
      const res = await setProfilePicture(myUser, pic).expect(200);
      const databaseUser1 = await User.get(myUser._id.toString());
      expect(databaseUser1.profilePicture).to.be.not.null;

      await removeUpload(myUser, res.body._id).expect(200);
      const databaseUser = await User.get(myUser._id.toString());
      expect(databaseUser.profilePicture).to.be.null;
    });
  });
  describe("Upload files to a party", function () {
    it("can upload a party picture and a thumbnail is created", async () => {
      const myUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;

      const files = [
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
      ];
      const res = await uploadFilesToParty(myUser, partyId, files).expect(200);
      expect(res.body).to.have.a.lengthOf(3);

      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(3);

      const databaseParty = await Party.get(partyId);
      expect(databaseParty.uploads).to.have.a.lengthOf(3);
    });
    it("cannot upload a party picture if I am not the owner of the party", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      const partyId = (await createParty(otherUser, { name: "test" })).body._id;

      const files = [await uploadPartyPic(myUser)];
      const res = await uploadFilesToParty(myUser, partyId, files).expect(403);
      expect(res.body.data.code).to.be.equal(
        PAPEO_ERRORS.YOU_ARE_NOT_THE_OWNER_OF_THIS_PARTY.code
      );

      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);

      const databaseParty = await Party.get(partyId);
      expect(databaseParty.uploads).to.have.a.lengthOf(0);
    });
    it("removes uploads in party object when upload is deleted", async () => {
      const myUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;

      const files = [
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
      ];
      const res = await uploadFilesToParty(myUser, partyId, files).expect(200);
      expect(res.body).to.have.a.lengthOf(3);

      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(3);

      const databaseParty = await Party.get(partyId);
      expect(databaseParty.uploads).to.have.a.lengthOf(3);

      await removeUpload(myUser, res.body[0]._id).expect(200);
      await removeUpload(myUser, res.body[1]._id).expect(200);
      await removeUpload(myUser, res.body[2]._id).expect(200);
      expect(await getUsersS3Uploads(myUser)).to.have.a.lengthOf(0);
      const databaseParty2 = await Party.get(partyId);
      expect(databaseParty2.uploads).to.have.a.lengthOf(0);
    });
  });
  describe("Creating posts", function () {
    it("creates a post and a thumbnail", async () => {
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

      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(3);

      const databasePost = await Post.get(res.body._id);
      expect(databasePost.uploads).to.have.a.lengthOf(3);
    });
    it("removes all uploads from a post if the post is deleted", async () => {
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
      await removePost(myUser, res.body._id).expect(200);
      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(0);
    });
  });
  describe("Party uploads order", function () {
    it("can change upload order", async () => {
      const myUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;

      const files = [
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
      ];

      await uploadFilesToParty(myUser, partyId, files).expect(200);

      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(5);

      const databaseParty = await Party.get(partyId);
      expect(databaseParty.uploads).to.have.a.lengthOf(5);
      const newOrder = [
        databaseParty.uploads[2].toString(),
        databaseParty.uploads[0].toString(),
        databaseParty.uploads[1].toString(),
        databaseParty.uploads[4].toString(),
        databaseParty.uploads[3].toString(),
      ];
      const res = await changePartyUploadOrder(
        myUser,
        partyId,
        newOrder
      ).expect(200);
      expect(res.body.uploads).to.deep.equal(newOrder);
      const databaseParty2 = await Party.get(partyId);
      expect(databaseParty2.uploads).to.have.a.lengthOf(5);
      expect(databaseParty2.uploads.map((u) => u.toString())).to.deep.equal(
        newOrder
      );
    });
    it("ignores not existing uploadIds", async () => {
      const myUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;

      const files = [
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
      ];

      await uploadFilesToParty(myUser, partyId, files).expect(200);

      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(5);

      const databaseParty = await Party.get(partyId);
      expect(databaseParty.uploads).to.have.a.lengthOf(5);
      const falseOrder = [
        databaseParty.uploads[2].toString(),
        partyId,
        databaseParty.uploads[0].toString(),
        databaseParty.uploads[1].toString(),
        databaseParty.uploads[4].toString(),
        databaseParty.uploads[3].toString(),
        myUser._id.toString(),
      ];
      const rightOrder = [
        databaseParty.uploads[2].toString(),
        databaseParty.uploads[0].toString(),
        databaseParty.uploads[1].toString(),
        databaseParty.uploads[4].toString(),
        databaseParty.uploads[3].toString(),
      ];
      const res = await changePartyUploadOrder(
        myUser,
        partyId,
        falseOrder
      ).expect(200);
      expect(res.body.uploads).to.deep.equal(rightOrder);
      const databaseParty2 = await Party.get(partyId);
      expect(databaseParty2.uploads).to.have.a.lengthOf(5);
      expect(databaseParty2.uploads.map((u) => u.toString())).to.deep.equal(
        rightOrder
      );
    });
    it("deletes missing objects from database and s3", async () => {
      const myUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;

      const files = [
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
        await uploadPartyPic(myUser),
      ];

      await uploadFilesToParty(myUser, partyId, files).expect(200);

      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(5);

      const databaseParty = await Party.get(partyId);
      expect(databaseParty.uploads).to.have.a.lengthOf(5);
      const newOrder = [
        databaseParty.uploads[2].toString(),
        databaseParty.uploads[0].toString(),
        // databaseParty.uploads[1].toString(),
        databaseParty.uploads[4].toString(),
        databaseParty.uploads[3].toString(),
      ];
      const res = await changePartyUploadOrder(
        myUser,
        partyId,
        newOrder
      ).expect(200);

      const uploads2 = await getUsersS3Uploads(myUser);
      expect(uploads2).to.have.a.lengthOf(4);
      expect(res.body.uploads).to.deep.equal(newOrder);
      const databaseParty2 = await Party.get(partyId);
      expect(databaseParty2.uploads).to.have.a.lengthOf(4);
      expect(databaseParty2.uploads.map((u) => u.toString())).to.deep.equal(
        newOrder
      );
    });
  });
  describe("Message uploads", function () {
    it.skip("creates a upload and a thumbnail", async () => {
      const myUser = await createUser();
      const file = await uploadPartyPic(myUser);
      const res = await updateMessage(
        myUser,
        "rthsrzhdtzhndtzhdtz",
        "fgfdgzhdgzhfdgzv",
        file
      ).expect(200);

      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);
    });
    it("TODO", async () => {});
  });
  describe("TODO User uploads", function () {});
});

after(async () => {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
