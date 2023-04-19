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
  createPostWith3Pictures,
  uploadFilesToParty,
  uploadProfilePicture,
  uploadVerificationFile,
  createReport,
  deleteReport,
  listReports,
  wipeDatabaseAndEmptyS3Bucket,
  uploadPartyPic,
} = require("./helpers.js");
const User = require("../../services/users/usersService.js");
const Upload = require("../../services/uploads/uploadsService.js");
const Party = require("../../services/parties/partiesService.js");
const Post = require("../../services/posts/postsService.js");
const Report = require("../../services/reports/reportsService.js");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
describe("/reports", function () {
  before(async () => {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });

  describe.skip("Creating reports", function () {
    it("creates a report for a party", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      const partyId = (await createParty(otherUser, { name: "test" })).body._id;

      const files = [await uploadPartyPic(myUser)];
      const res = await createReport(
        myUser,
        partyId,
        undefined,
        undefined,
        "party nicht gut",
        files
      ).expect(200);

      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);

      const databaseReport = await Report.get(res.body._id);
      expect(databaseReport.uploads).to.have.a.lengthOf(1);
      expect(databaseReport.reportedParty.toString()).to.be.string(
        partyId.toString()
      );
    });
    it("creates a report for a user", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();

      const files = [await uploadPartyPic(myUser)];
      const res = await createReport(
        myUser,
        undefined,
        otherUser._id,
        undefined,
        "user mag kein techno",
        files
      ).expect(200);

      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);

      const databaseReport = await Report.get(res.body._id);
      expect(databaseReport.uploads).to.have.a.lengthOf(1);
      expect(databaseReport.reportedUser.toString()).to.be.string(
        otherUser._id.toString()
      );
    });
    it("removing all uploads if report is deleted", async () => {
      const myUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;
      const files = [await uploadPartyPic(myUser)];
      const res = await createReport(
        myUser,
        partyId,
        undefined,
        undefined,
        "party nicht gut",
        files
      ).expect(200);
      await deleteReport(myUser, res.body._id).expect(200);
      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(0);
    });
    it("cannot remove reports from other users", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;
      const files = [await uploadPartyPic(otherUser)];
      const res = await createReport(
        otherUser,
        partyId,
        undefined,
        undefined,
        "party nicht gut",
        files
      ).expect(200);
      const uploads = await getUsersS3Uploads(otherUser);
      expect(uploads).to.have.a.lengthOf(1);
      const res2 = await deleteReport(myUser, res.body._id).expect(403);
      expect(res2.body.data.code).to.be.equal(
        PAPEO_ERRORS.WRONG_USER_ROLE.code
      );
    });
    it("cannot create a report for a user if I already created one", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      await createReport(
        myUser,
        undefined,
        myUser._id,
        undefined,
        "user mag kein techno",
        [await uploadPartyPic(myUser)]
      ).expect(200);
      await createReport(
        myUser,
        undefined,
        otherUser._id,
        undefined,
        "user mag kein techno",
        [await uploadPartyPic(myUser)]
      ).expect(200);
      const res = await createReport(
        myUser,
        undefined,
        otherUser._id,
        undefined,
        "user mag kein techno",
        [await uploadPartyPic(myUser)]
      ).expect(400);
      expect(res.body.data.code).to.be.equal(
        PAPEO_ERRORS.USER_ALREADY_REPORTED.code
      );
      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(3);
    });
    it("cannot create a report for a party if I already created one", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;

      await createReport(
        otherUser,
        partyId,
        undefined,
        undefined,
        "party nicht gut",
        [await uploadPartyPic(otherUser)]
      ).expect(200);
      await createReport(
        myUser,
        partyId,
        undefined,
        undefined,
        "party nicht gut",
        [await uploadPartyPic(myUser)]
      ).expect(200);
      const res = await createReport(
        myUser,
        partyId,
        undefined,
        undefined,
        "party nicht gut",
        [await uploadPartyPic(myUser)]
      ).expect(400);
      expect(res.body.data.code).to.be.equal(
        PAPEO_ERRORS.PARTY_ALREADY_REPORTED.code
      );
      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(2);
    });
    it("I can get all my reports", async () => {
      const myUser = await createUser();
      const otherUser = await createUser();
      const partyId = (await createParty(myUser, { name: "test" })).body._id;
      const partyId2 = (await createParty(myUser, { name: "test" })).body._id;

      // report from otherUser
      await createReport(
        otherUser,
        partyId,
        undefined,
        undefined,
        "party nicht gut",
        [await uploadPartyPic(otherUser)]
      ).expect(200);
      
      // my reports
      await createReport(
        myUser,
        partyId,
        undefined,
        undefined,
        "party nicht gut",
        [await uploadPartyPic(myUser)]
      ).expect(200);
      await createReport(
        myUser,
        undefined,
        otherUser._id,
        undefined,
        "user mag kein techno",
        [await uploadPartyPic(myUser)]
      ).expect(200);
      await createReport(
        myUser,
        partyId2,
        undefined,
        undefined,
        "party nicht gut",
        [await uploadPartyPic(myUser)]
      ).expect(200);
      const reports = await listReports(myUser).expect(200);
      expect(reports.body.data).to.have.a.lengthOf(3);
      const uploads = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(3);
    });
  });
  describe("TODO User uploads", function () {});
});

after(async () => {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
