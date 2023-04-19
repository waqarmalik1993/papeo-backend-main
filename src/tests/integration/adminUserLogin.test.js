const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
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
const jwt = require("jsonwebtoken");
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
const defaultRights = h.defaultAdminRights;
const defaultUserSettings = {
  notifications: {
    parties: {
      push: true,
      email: false,
    },
    friends: {
      push: true,
      email: false,
    },
    following: {
      push: true,
      email: false,
    },
    followers: {
      push: true,
      email: false,
    },
    sharedContent: {
      push: true,
      email: false,
    },
    comments: {
      push: true,
      email: false,
    },
    myProfileActivity: {
      push: true,
      email: false,
    },
    membership: {
      push: true,
      email: false,
    },
    other: {
      push: true,
      email: false,
    },
  },
  invitations: {
    following: true,
    followers: true,
    partyFriends: true,
    others: true,
    distanceFrom: 0,
    distanceTo: 0,
  },
  allowAdminLogin: false,
};
describe("Admin User Login", function () {
  before(async function () {
    await startServer();
    await h.wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("Admin can get a valid jwt of user if he has the right loginAsUser and the user has the setting adminLoginAllowed enabled", async function () {
    const myUser = await h.createUser({
      settings: { ...defaultUserSettings, allowAdminLogin: true },
    });
    const admin = await h.createUser({
      isAdmin: true,
      isSuperAdmin: false,
      adminRights: { ...defaultRights, loginAsUser: true },
    });
    const res = await h
      .loginAsUser(admin, myUser, {
        reason: "dfgbdgtfbys t bdtg bhsytgfb tdrb dtb",
      })
      .expect(200);
    console.log(res.body);
    expect(res.body.jwt).to.be.not.undefined;
    expect(res.body.userId).to.be.eq(myUser._id.toString());
    const decodedToken = jwt.verify(
      res.body.jwt,
      process.env.JWT_SIGNING_SECRET
    );
    expect(decodedToken.userId).to.be.eq(myUser._id.toString());
  });
  it("Superadmin can get a valid jwt of user even if the user has the setting adminLoginAllowed disabled", async function () {
    const myUser = await h.createUser({
      settings: { ...defaultUserSettings, allowAdminLogin: false },
    });
    const admin = await h.createUser({
      isAdmin: true,
      isSuperAdmin: true,
      adminRights: { ...defaultRights, loginAsUser: true },
    });
    const res = await h
      .loginAsUser(admin, myUser, {
        reason: "dfgbdgtfbys t bdtg bhsytgfb tdrb dtb",
      })
      .expect(200);
    console.log(res.body);
    expect(res.body.jwt).to.be.not.undefined;
    expect(res.body.userId).to.be.eq(myUser._id.toString());
    const decodedToken = jwt.verify(
      res.body.jwt,
      process.env.JWT_SIGNING_SECRET
    );
    expect(decodedToken.userId).to.be.eq(myUser._id.toString());
  });
  it("Admin cannot login if user setting enableAdminLogin is turned off and he doesnt have the adminRight loginAsUSer", async function () {
    const myUser = await h.createUser({
      settings: { ...defaultUserSettings, allowAdminLogin: false },
    });
    const admin = await h.createUser({
      isAdmin: true,
      isSuperAdmin: false,
      adminRights: { ...defaultRights, loginAsUser: false },
    });
    const res = await h
      .loginAsUser(admin, myUser, {
        reason: "dfgbdgtfbys t bdtg bhsytgfb tdrb dtb",
      })
      .expect(403);
    console.log(res.body);
    expect(res.body.jwt).to.be.undefined;
  });
  it("Admin cannot login if user setting enableAdminLogin is turned off", async function () {
    const myUser = await h.createUser({
      settings: { ...defaultUserSettings, allowAdminLogin: false },
    });
    const admin = await h.createUser({
      isAdmin: true,
      isSuperAdmin: false,
      adminRights: { ...defaultRights, loginAsUser: true },
    });
    const res = await h
      .loginAsUser(admin, myUser, {
        reason: "dfgbdgtfbys t bdtg bhsytgfb tdrb dtb",
      })
      .expect(403);
    console.log(res.body);
    expect(res.body.data.code).to.be.equal(PAPEO_ERRORS.USER_DISABLED_ADMIN_LOGIN_IN_SETTINGS.code);
    expect(res.body.jwt).to.be.undefined;
  });
  it("Admin cannot login if user he doesnt have the adminRight loginAsUSer", async function () {
    const myUser = await h.createUser({
      settings: { ...defaultUserSettings, allowAdminLogin: true },
    });
    const admin = await h.createUser({
      isAdmin: true,
      isSuperAdmin: false,
      adminRights: { ...defaultRights, loginAsUser: false },
    });
    const res = await h
      .loginAsUser(admin, myUser, {
        reason: "dfgbdgtfbys t bdtg bhsytgfb tdrb dtb",
      })
      .expect(403);
    console.log(res.body);
    expect(res.body.jwt).to.be.undefined;
  });
  it("The adminLogin action creates an adminLog entry", async function () {
    const myUser = await h.createUser({
      settings: { ...defaultUserSettings, allowAdminLogin: true },
    });
    const admin = await h.createUser({
      isAdmin: true,
      isSuperAdmin: false,
      adminRights: { ...defaultRights, loginAsUser: true },
    });
    const res = await h
      .loginAsUser(admin, myUser, {
        reason: "dfgbdgtfbys t bdtg bhsytgfb tdrb dtb",
      })
      .expect(200);
    console.log(res.body);
    expect(res.body.jwt).to.be.not.undefined;
    expect(res.body.userId).to.be.eq(myUser._id.toString());
    const decodedToken = jwt.verify(
      res.body.jwt,
      process.env.JWT_SIGNING_SECRET
    );
    expect(decodedToken.userId).to.be.eq(myUser._id.toString());

    const adminLogs = await AdminLog.MODEL.find({ user: admin._id });
    expect(adminLogs).to.have.a.lengthOf(1);
    expect(adminLogs[0].affectedUser.toString()).to.be.eq(
      myUser._id.toString()
    );
    expect(adminLogs[0].adminRightUsed).to.be.eq("loginAsUser");
    expect(adminLogs[0].type).to.be.eq("loginAsUser");
  });
});

after(async function () {
  if (process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
