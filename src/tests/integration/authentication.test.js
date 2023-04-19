const User = require("../../services/users/usersService.js");
const EmailVerification = require("../../services/emailVerification/emailVerificationService.js");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const createUser = require("./helpers.js").createUser;
const wipeDatabaseAndEmptyS3Bucket =
  require("./helpers.js").wipeDatabaseAndEmptyS3Bucket;
const postAuthenticate = require("./helpers.js").postAuthenticate;
const startServer = require("../../app").startServer;
describe("Authentication", function () {
  before(async function() {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("route is accessable", async function() {
    await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      phoneNumber: "+4917643371318",
    }).expect(200);
  });
  it("can login", async function() {
    const res = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      verificationCode: "123456",
      phoneNumber: "+4917643371318",
      platform: "ios",
      fcmToken: "123456789",
    }).expect(200);
    expect(res.body.firebaseJwt).to.be.equal("FIREBASE_JWT");
    expect(res.body.jwt).to.be.not.undefined;
    expect(res.body.userId).to.be.not.undefined;
    expect(res.body.firstLogin).to.be.equal(true);
    expect(res.body.successfulLoginCount).to.be.equal(1);
  });
  it("can login twice and logincount increases and fcm token and jwt is saved", async function() {
    const res = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      verificationCode: "123456",
      phoneNumber: "+4917643371319",
      platform: "ios",
      fcmToken: "123456789",
    }).expect(200);
    expect(res.body.firebaseJwt).to.be.equal("FIREBASE_JWT");
    expect(res.body.jwt).to.be.not.undefined;
    expect(res.body.userId).to.be.not.undefined;
    expect(res.body.firstLogin).to.be.equal(true);
    expect(res.body.successfulLoginCount).to.be.equal(1);

    const user = await User.getRaw(res.body.userId.toString());

    expect(user.tokens[0].fcmToken).to.be.equal("123456789");
    expect(user.tokens[0].accessToken).to.be.equal(res.body.jwt);

    const res2 = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      verificationCode: "123456",
      phoneNumber: "+4917643371319",
      platform: "ios",
      fcmToken: "0000000000",
    }).expect(200);

    expect(res2.body.firebaseJwt).to.be.equal("FIREBASE_JWT");
    expect(res2.body.jwt).to.be.not.undefined;
    expect(res2.body.userId).to.be.not.undefined;

    expect(res2.body.firstLogin).to.be.equal(false);
    expect(res2.body.successfulLoginCount).to.be.equal(2);

    expect(res.body.userId.toString()).to.be.equal(res2.body.userId.toString());
    const user1 = await User.getRaw(res2.body.userId.toString());
    expect(user1.tokens[1].fcmToken).to.be.equal("0000000000");
    expect(user1.tokens[1].accessToken).to.be.equal(res2.body.jwt);
  });
  it("it creates an email verification if the user has an email", async function() {
    const myUser = await createUser({
      phoneNumber: "+4917610000000",
      email: "nico@neon.dev",
    });
    console.log(myUser.phoneNumber);
    const res = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      phoneNumber: myUser.phoneNumber,
    }).expect(200);
    expect(res.body.channel).to.be.string("email");
    const emailVerification = await EmailVerification.find({
      query: { user: myUser._id.toString() },
    });
    expect(emailVerification.data.length).to.be.equal(1);
  });
  it("it creates an email email verification if the user has an email and sends the same code for the second try", async function() {
    const myUser = await createUser({
      phoneNumber: "+4917610000001",
      email: "nico@neon.dev",
    });
    const res = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      phoneNumber: myUser.phoneNumber,
    }).expect(200);
    expect(res.body.channel).to.be.string("email");
    const emailVerification = await EmailVerification.find({
      query: { user: myUser._id.toString() },
    });

    expect(emailVerification.data.length).to.be.equal(1);
    const code = emailVerification.data[0].code;
    expect(code).to.not.be.undefined;

    const res2 = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      phoneNumber: myUser.phoneNumber,
    }).expect(200);
    expect(res2.body.channel).to.be.string("email");
    const emailVerification2 = await EmailVerification.find({
      query: { user: myUser._id.toString() },
    });

    expect(emailVerification2.data.length).to.be.equal(1);
    expect(emailVerification2.data[0].code).to.be.equal(code);
  });
  it("cannot login when the email code is wrong", async function() {
    const myUser = await createUser({
      phoneNumber: "+4917610000002",
      email: "nico@neon.dev",
    });
    const res = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      phoneNumber: myUser.phoneNumber,
    }).expect(200);
    expect(res.body.channel).to.be.string("email");
    const emailVerification = await EmailVerification.find({
      query: { user: myUser._id.toString() },
    });

    expect(emailVerification.data.length).to.be.equal(1);
    const code = emailVerification.data[0].code;

    const res2 = await postAuthenticate({
      type: "local",
      countryCode: "de",
      channel: "sms",
      verificationCode: "123456",
      phoneNumber: "+4917610000002",
      platform: "ios",
      fcmToken: "0000000000",
    }).expect(400);

    expect(res2.body.data.code).to.be.equal(
      PAPEO_ERRORS.EMAIL_VERIFICATION_CODE_NOT_VALID.code
    );
    expect(res2.body.jwt).to.be.undefined;
    expect(res2.body.userId).to.be.undefined;
    console.log(res.body);
  });
});

after(async function() {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
