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
  createAdmin,
  patchAdmin,
  setVerificationVideo,
  voteForVerification,
  uploadVerificationVideo,
  uploadPartyPic,
  createPost,
  getUsersS3Uploads,
  mentionUser,
  deleteMention,
  lockUser,
  unlockUser,
  deleteRating,
  removeUpload,
  partiesSearch,
} = require("./helpers.js");
const h = require("./helpers");
const User = require("../../services/users/usersService.js");
const PartyGuest = require("../../services/partyGuests/partyGuestsService");
const Party = require("../../services/parties/partiesService");
const ImageMention = require("../../services/imageMention/imageMentionService");
const Uploads = require("../../services/uploads/uploadsService");
const AdminLog = require("../../services/adminlogs/adminLogsService");
const { UploadsSchema } = require("../../modules/validation/uploads.js");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
const defaultRights = h.defaultAdminRights;
describe("Admins", function () {
  before(async function() {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("Admin can remove imageMentions with right manageUserLinks", async function() {
    const myUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const otherUser = await createUser();
    const otherUser2 = await createUser();
    const otherUser3 = await createUser();
    await sendFriendRequest(otherUser2, otherUser3);
    await acceptFriendRequest(otherUser3, otherUser2);

    await createAdmin(myUser, otherUser).expect(200);
    await patchAdmin(myUser, otherUser, defaultRights);

    const partyId = (await createParty(myUser, { name: "test" })).body._id;
    const files = [await uploadPartyPic(otherUser2)];
    const res = await createPost(
      otherUser2,
      partyId,
      "description",
      files
    ).expect(200);

    const uploads = await getUsersS3Uploads(otherUser2);
    expect(uploads).to.have.a.lengthOf(1);

    await mentionUser(otherUser2, files[0], otherUser3).expect(200);
    expect(
      await ImageMention.MODEL.find({ mentionedUser: otherUser3._id })
    ).to.have.a.lengthOf(1);

    await deleteMention(otherUser, files[0], otherUser3).expect(403);
    await patchAdmin(myUser, otherUser, {
      ...defaultRights,
      manageUserLinks: true,
    });
    await deleteMention(otherUser, files[0], otherUser3).expect(200);
    expect(
      await ImageMention.MODEL.find({ mentionedUser: otherUser3._id })
    ).to.have.a.lengthOf(0);

    expect(
      await AdminLog.MODEL.find({ type: "removedImageMention" })
    ).to.have.a.lengthOf(1);
  });
  it("Admins can instantly verify a user", async function() {
    const myUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const adminUser = await createUser();
    await createAdmin(myUser, adminUser).expect(200);
    await patchAdmin(myUser, adminUser, {
      ...defaultRights,
      rateVideoIdent: true,
    });
    const userToVote = await createUser();

    const video = await uploadVerificationVideo(userToVote);
    await setVerificationVideo(userToVote, video).expect(200);

    await voteForVerification(adminUser, userToVote, true).expect(200);
    const databaseUserToVote = await User.get(userToVote._id.toString());
    expect(databaseUserToVote.verification.verified).to.be.true;

    expect(
      await AdminLog.MODEL.find({ type: "votedForUser" })
    ).to.have.a.lengthOf(1);
  });
  it("Admins can lock a user", async function() {
    const myUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const adminUser = await createUser();
    const otherUser = await createUser();
    await createAdmin(myUser, adminUser).expect(200);

    await lockUser(
      adminUser,
      otherUser,
      "ruifhaeourghoerftoeidrhgodtfgsrtgrt",
      "detgstf"
    ).expect(403);
    await patchAdmin(myUser, adminUser, {
      ...defaultRights,
      lockUser: true,
    });
    await lockUser(
      adminUser,
      otherUser,
      "ruifhaeourghoerftoeidrhgodtfgsrtgrt",
      "detgstf"
    ).expect(200);

    expect(
      await AdminLog.MODEL.find({ type: "lockedUser" })
    ).to.have.a.lengthOf(1);
  });
  it("Admins can unlock a user", async function() {
    const myUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const adminUser = await createUser();
    const otherUser = await createUser();
    await createAdmin(myUser, adminUser).expect(200);

    await unlockUser(
      adminUser,
      otherUser,
      "ruifhaeourghoerftoeidrhgodtfgsrtgrt",
      "detgstf"
    ).expect(403);
    await patchAdmin(myUser, adminUser, {
      ...defaultRights,
      lockUser: true,
    });
    await unlockUser(
      adminUser,
      otherUser,
      "ruifhaeourghoerftoeidrhgodtfgsrtgrt",
      "detgstf"
    ).expect(200);
    expect(
      await AdminLog.MODEL.find({ type: "unlockedUser" })
    ).to.have.a.lengthOf(1);
  });
  it("Admins can delete ratings", async function() {
    const myUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const adminUser = await createUser();
    const otherUser = await createUser();
    await createAdmin(myUser, adminUser).expect(200);

    const partyId = (await createParty(myUser, { name: "test" })).body._id;
    await joinParty(partyId, otherUser);
    const r = await rateParty(partyId, otherUser, 5).expect(200);

    await deleteRating(adminUser, partyId, r.body._id).expect(403);
    await patchAdmin(myUser, adminUser, {
      ...defaultRights,
      deleteRating: true,
    });
    await deleteRating(adminUser, partyId, r.body._id).expect(200);
    expect(
      await AdminLog.MODEL.find({ type: "deletedRating" })
    ).to.have.a.lengthOf(1);
  });
  it("Admins can delete media", async function() {
    const myUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const adminUser = await createUser();
    const otherUser = await createUser();
    await createAdmin(myUser, adminUser).expect(200);

    const file = await uploadPartyPic(otherUser);

    await removeUpload(adminUser, file._id).expect(403);
    await patchAdmin(myUser, adminUser, {
      ...defaultRights,
      manageMedia: true,
    });
    await removeUpload(adminUser, file._id).expect(200);
  });
  it("Admins can see secret parties", async function() {
    await Party.MODEL.deleteMany();
    const myUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const adminUser = await createUser({ isAdmin: true });
    const otherUser = await createUser();
    const party = await createParty(otherUser, {
      name: "Secret Party",
      privacyLevel: "secret",
    });
    let parties = (await partiesSearch(adminUser).expect(200)).body.data;
    console.log(parties);
    expect(parties).to.have.a.lengthOf(0);
    await patchAdmin(myUser, adminUser, {
      ...defaultRights,
      canSeeSecretParties: true,
    });
    parties = (await partiesSearch(adminUser).expect(200)).body.data;
    expect(parties).to.have.a.lengthOf(1);
  });
  it("Secret party search logic", async function() {
    await Party.MODEL.deleteMany();
    const myUser = await createUser({ isAdmin: true, isSuperAdmin: true });
    const adminUser = await createUser({ isAdmin: true });
    const otherUser = await createUser();
    const party = await createParty(otherUser, {
      name: "Secret Party",
      privacyLevel: "secret",
    });
    await patchAdmin(myUser, adminUser, {
      ...defaultRights,
      canSeeSecretParties: true,
    });
    let parties = (
      await partiesSearch(
        adminUser,
        "privacy_level=open&privacy_level=closed"
      ).expect(200)
    ).body.data;
    console.log(parties);
    expect(parties).to.have.a.lengthOf(0);

    parties = (
      await partiesSearch(
        adminUser,
        "privacy_level=secret&privacy_level=closed"
      ).expect(200)
    ).body.data;
    expect(parties).to.have.a.lengthOf(1);
    parties = (
      await partiesSearch(adminUser, "privacy_level=secret").expect(200)
    ).body.data;
    expect(parties).to.have.a.lengthOf(1);
    await patchAdmin(myUser, adminUser, {
      ...defaultRights,
      canSeeSecretParties: false,
    });
    parties = (
      await partiesSearch(adminUser, "privacy_level=secret").expect(200)
    ).body.data;
    expect(parties).to.have.a.lengthOf(0);
  });
  describe.skip("Creating profile banners", function () {
    it("can upload a profilebanner image if user is partyKing and sets upload.profileBannerFromUser to uploadId", async function() {
      const myUser = await createUser({ isPartyKing: true, isArtist: false });
      const adminUser = await createUser({ isAdmin: true });
      const banner = await uploadPartyPic(adminUser);

      const res = await h
        .changeProfileBanner(adminUser, myUser, {
          upload: banner._id.toString(),
          ...PROFILE_BANNER_MOCK
        })
        .expect(200);

      const uploads = await getUsersS3Uploads(adminUser);
      const uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);
      expect(uploadsUser).to.have.a.lengthOf(0);

      const myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner.upload.toString()).to.be.eq(
        banner._id.toString()
      );
    });
    it("can upload a profilebanner image if user is an artist and sets user.profileBanner.upload to uploadId and upload.profileBannerFromUser to userId", async function() {
      const myUser = await createUser({ isPartyKing: true, isArtist: true });
      const adminUser = await createUser({ isAdmin: true });
      const banner = await uploadPartyPic(adminUser);

      const res = await h
        .changeProfileBanner(adminUser, myUser, {
          upload: banner._id.toString(),
          ...PROFILE_BANNER_MOCK
        })
        .expect(200);

      const uploads = await getUsersS3Uploads(adminUser);
      const uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);
      expect(uploadsUser).to.have.a.lengthOf(0);

      const myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner.upload.toString()).to.be.eq(
        banner._id.toString()
      );
      const bannerUpload = await Uploads.get(banner._id);
      expect(bannerUpload.profileBannerFromUser.toString()).to.be.eq(
        myUser._id.toString()
      );
    });
    it("returns 403 if uploading user is not an admin", async function() {
      const myUser = await createUser({ isPartyKing: true, isArtist: false });
      const adminUser = await createUser({ isAdmin: false });
      //!
      const banner = await uploadPartyPic(myUser);

      const res = await h
        .changeProfileBanner(adminUser, myUser, {
          upload: banner._id.toString(),
          ...PROFILE_BANNER_MOCK
        })
        .expect(403);

      const uploads = await getUsersS3Uploads(adminUser);
      const uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(0);
      expect(uploadsUser).to.have.a.lengthOf(1);

      const myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner).to.be.eq(null);
    });
    it("returns 403 if the admin is not the owner of the upload", async function() {
      const myUser = await createUser({ isPartyKing: true, isArtist: false });
      const adminUser = await createUser({ isAdmin: false });
      const banner = await uploadPartyPic(adminUser);

      const res = await h
        .changeProfileBanner(adminUser, myUser, {
          upload: banner._id.toString(),
          ...PROFILE_BANNER_MOCK
        })
        .expect(403);

      const uploads = await getUsersS3Uploads(adminUser);
      const uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);
      expect(uploadsUser).to.have.a.lengthOf(0);

      const myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner).to.be.eq(null);
    });
    it("returns error if user to set the profilebanner is neither partyking or artist and throws USER_MUST_BE_PARTYKING_TO_CHANGE_BANNER error", async function() {
      const myUser = await createUser({ isPartyKing: false, isArtist: false });
      const adminUser = await createUser({ isAdmin: true });
      const banner = await uploadPartyPic(adminUser);

      const res = await h
        .changeProfileBanner(adminUser, myUser, {
          upload: banner._id.toString(),
          ...PROFILE_BANNER_MOCK
        })
        .expect(400);
      console.log(res);
      expect(res.body.data.code).to.be.equal(
        PAPEO_ERRORS.USER_MUST_BE_PARTYKING_TO_CHANGE_BANNER.code
      );
      const uploads = await getUsersS3Uploads(adminUser);
      const uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);
      expect(uploadsUser).to.have.a.lengthOf(0);

      const myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner).to.be.eq(null);
    });
    it("removes profile banner upload from s3 and db when user with profilebanner deletes himself", async function() {
      const myUser = await createUser({ isPartyKing: true, isArtist: true });
      const adminUser = await createUser({ isAdmin: true });
      const banner = await uploadPartyPic(adminUser);

      const res = await h
        .changeProfileBanner(adminUser, myUser, {
          upload: banner._id.toString(),
          ...PROFILE_BANNER_MOCK
        })
        .expect(200);

      let uploads = await getUsersS3Uploads(adminUser);
      let uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);
      expect(uploadsUser).to.have.a.lengthOf(0);

      const myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner.upload.toString()).to.be.eq(
        banner._id.toString()
      );

      await h.deleteUser(myUser, myUser);
      uploads = await getUsersS3Uploads(adminUser);
      uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(0);
      expect(uploadsUser).to.have.a.lengthOf(0);
    });
    it("removes profile banner upload from s3 and db when user downgrades his subscription", async function() {
      const myUser = await createUser({ isPartyKing: true, isArtist: true });
      const adminUser = await createUser({ isAdmin: true });
      const banner = await uploadPartyPic(adminUser);

      const res = await h
        .changeProfileBanner(adminUser, myUser, {
          upload: banner._id.toString(),
          ...PROFILE_BANNER_MOCK
        })
        .expect(200);

      let uploads = await getUsersS3Uploads(adminUser);
      let uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);
      expect(uploadsUser).to.have.a.lengthOf(0);

      const myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner.upload.toString()).to.be.eq(
        banner._id.toString()
      );

      await User.patch(myUser._id, { isPartyKing: false });
      uploads = await getUsersS3Uploads(adminUser);
      uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(0);
      expect(uploadsUser).to.have.a.lengthOf(0);
    });
    it("removes profile banner object to null when user downgrades his subscription", async function() {
      const myUser = await createUser({ isPartyKing: true, isArtist: true });
      const adminUser = await createUser({ isAdmin: true });
      const banner = await uploadPartyPic(adminUser);

      let uploads = await getUsersS3Uploads(adminUser);
      let uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);
      expect(uploadsUser).to.have.a.lengthOf(0);

      const res = await h
        .changeProfileBanner(adminUser, myUser, {
          upload: banner._id.toString(),
          ...PROFILE_BANNER_MOCK
        })
        .expect(200);

      const myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner.upload.toString()).to.be.eq(
        banner._id.toString()
      );

      await User.patch(myUser._id, { isPartyKing: false });
      const userDb = await User.get(myUser._id);
      expect(userDb.profileBanner).to.be.eq(null);
    });
    it("admins can delete a profilebanner", async function() {
      const myUser = await createUser({ isPartyKing: true, isArtist: false });
      const adminUser = await createUser({ isAdmin: true });
      const banner = await uploadPartyPic(adminUser);

      const res = await h
        .changeProfileBanner(adminUser, myUser, {
          upload: banner._id.toString(),
          ...PROFILE_BANNER_MOCK
        })
        .expect(200);

      let uploads = await getUsersS3Uploads(adminUser);
      let uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);
      expect(uploadsUser).to.have.a.lengthOf(0);

      let myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner.upload.toString()).to.be.eq(
        banner._id.toString()
      );
      let bannerUpload = await Uploads.get(banner._id);
      expect(bannerUpload.profileBannerFromUser.toString()).to.be.eq(
        myUser._id.toString()
      );

      await h.deleteProfileBanner(adminUser, myUser).expect(200);

      uploads = await getUsersS3Uploads(adminUser);
      uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(0);
      expect(uploadsUser).to.have.a.lengthOf(0);

      myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner).to.be.eq(null);
    });
    it("not admins cannot delete a profilebanner", async function() {
      const myUser = await createUser({ isPartyKing: true, isArtist: false });
      const adminUser = await createUser({ isAdmin: true });
      const notAdminUser = await createUser({ isAdmin: false });
      const banner = await uploadPartyPic(adminUser);
      
      const res = await h
        .changeProfileBanner(adminUser, myUser, {
          upload: banner._id.toString(),
          ...PROFILE_BANNER_MOCK
        })
        .expect(200);

      let uploads = await getUsersS3Uploads(adminUser);
      let uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);
      expect(uploadsUser).to.have.a.lengthOf(0);

      let myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner.upload.toString()).to.be.eq(
        banner._id.toString()
      );
      let bannerUpload = await Uploads.get(banner._id);
      expect(bannerUpload.profileBannerFromUser.toString()).to.be.eq(
        myUser._id.toString()
      );

      await h.deleteProfileBanner(notAdminUser, myUser).expect(403);

      uploads = await getUsersS3Uploads(adminUser);
      uploadsUser = await getUsersS3Uploads(myUser);
      expect(uploads).to.have.a.lengthOf(1);
      expect(uploadsUser).to.have.a.lengthOf(0);

      myUserDb = await User.get(myUser._id);
      expect(myUserDb.profileBanner.upload).to.be.eq(banner._id.toString());
    });
  });
});

after(async function() {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
