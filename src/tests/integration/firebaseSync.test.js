/* const createUser = require("./helpers.js").createUser;
const wipeDatabaseAndEmptyS3Bucket =
  require("./helpers.js").wipeDatabaseAndEmptyS3Bucket;
const postAuthenticate = require("./helpers.js").postAuthenticate;
const patchUser = require("./helpers.js").patchUser;
const {
  setProfilePicture,
  uploadProfilePic,
  blockUser,
  unblockUser,
} = require("./helpers.js");
const User = require("../../services/users/usersService.js");
const EmailVerification = require("../../services/emailVerification/emailVerificationService.js");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const admin = require("firebase-admin");
const startServer = require("../../app").startServer;
const DB = admin.firestore();

describe.skip("Firebase database sync", function () {
  this.timeout(10000);
  before(async () => {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(false);
  });
  it("firebase user is created on first login with fcm token", async () => {
    const res = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      verificationCode: "123456",
      phoneNumber: "+4917643371318",
      platform: "ios",
      fcmToken: "123456789",
    }).expect(200);
    expect(res.body.firebaseJwt).to.be.a.string;
    expect(res.body.jwt).to.be.not.undefined;
    expect(res.body.userId).to.be.not.undefined;
    expect(res.body.firstLogin).to.be.equal(true);
    expect(res.body.successfulLoginCount).to.be.equal(1);

    const user = await (
      await DB.collection("users").doc(res.body.userId).get()
    ).data();
    expect(user.fcmTokens).to.have.a.lengthOf(1);
    expect(user.fcmTokens[0]).to.be.equal("123456789");
    expect(user.username).to.be.null;
  });
  it("fcm token is added on second login", async () => {
    await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      verificationCode: "123456",
      phoneNumber: "+4917610000001",
      platform: "ios",
      fcmToken: "123456789",
    }).expect(200);
    const res = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      verificationCode: "123456",
      phoneNumber: "+4917610000001",
      platform: "ios",
      fcmToken: "9876543210",
    }).expect(200);
    expect(res.body.firstLogin).to.be.equal(false);
    expect(res.body.successfulLoginCount).to.be.equal(2);

    const user = await (
      await DB.collection("users").doc(res.body.userId).get()
    ).data();

    expect(user.fcmTokens).to.have.a.lengthOf(2);
    expect(user.username).to.be.null;
  });
  it("username is synced", async () => {
    const res = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      verificationCode: "123456",
      phoneNumber: "+4917610000002",
      platform: "ios",
      fcmToken: "123456789",
    }).expect(200);
    const myUser = await User.getRaw(res.body.userId);
    myUser.TOKEN = myUser.tokens[0].accessToken;
    await patchUser(myUser, myUser, {
      username: "allesmango",
    }).expect(200);
    const user = await (
      await DB.collection("users").doc(res.body.userId).get()
    ).data();
    expect(user.fcmTokens).to.have.a.lengthOf(1);
    expect(user.username).to.be.equal("allesmango");
  });
  it("profilePhoto is synced", async () => {
    const res = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      verificationCode: "123456",
      phoneNumber: "+4917610000003",
      platform: "ios",
      fcmToken: "123456789",
    }).expect(200);
    let myUser = await User.getRaw(res.body.userId);
    myUser.TOKEN = myUser.tokens[0].accessToken;
    await setProfilePicture(myUser, await uploadProfilePic(myUser)).expect(200);
    const user = await (
      await DB.collection("users").doc(res.body.userId).get()
    ).data();
    myUser = await User.get(res.body.userId);
    expect(user.profilePicture.toString()).to.equal(
      myUser.profilePicture.toString()
    );
  });
  it("blockedUsers are Synced", async () => {
    const res = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      verificationCode: "123456",
      phoneNumber: "+4917610000003",
      platform: "ios",
      fcmToken: "123456789",
    }).expect(200);
    let myUser = await User.getRaw(res.body.userId);
    myUser.TOKEN = myUser.tokens[0].accessToken;
    const res2 = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      verificationCode: "123456",
      phoneNumber: "+4917610000002",
      platform: "ios",
      fcmToken: "123456789",
    }).expect(200);
    let otherUser = await User.getRaw(res2.body.userId);
    otherUser.TOKEN = otherUser.tokens[0].accessToken;
    await blockUser(myUser, otherUser).expect(200);
    let user = await (
      await DB.collection("users").doc(res.body.userId).get()
    ).data();
    expect(user.blockedUsers).to.have.a.lengthOf(1);
    let otherUserFireBase = await (
      await DB.collection("users").doc(res2.body.userId).get()
    ).data();
    expect(otherUserFireBase.blockedUsers).to.have.a.lengthOf(0);
    expect(otherUserFireBase.blockedByUsers).to.have.a.lengthOf(1);
    expect(user.blockedByUsers).to.have.a.lengthOf(0);
    await unblockUser(myUser, otherUser).expect(200);
    user = await (
      await DB.collection("users").doc(res.body.userId).get()
    ).data();
    otherUserFireBase = await (
      await DB.collection("users").doc(res2.body.userId).get()
    ).data();
    expect(user.blockedUsers).to.have.a.lengthOf(0);
    expect(user.blockedByUsers).to.have.a.lengthOf(0);
    expect(otherUserFireBase.blockedUsers).to.have.a.lengthOf(0);
    expect(otherUserFireBase.blockedByUsers).to.have.a.lengthOf(0);
  });
});

after(async () => {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
*/
