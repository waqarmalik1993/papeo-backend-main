const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const h = require("./helpers");
const User = require("../../services/users/usersService.js");
const Follower = require("../../services/followers/followersService");
const PartyGuest = require("../../services/partyGuests/partyGuestsService");
const Party = require("../../services/parties/partiesService");
const ImageMention = require("../../services/imageMention/imageMentionService");
const Uploads = require("../../services/uploads/uploadsService");
const AdminLog = require("../../services/adminlogs/adminLogsService");
const Transaction = require("../../services/transactions/transactionsService");
const ReferralTree = require("../../services/referralTree/referralTreeService");
const Newsletter = require("../../services/newsletter/newsletterService");
const Activities = require("../../services/activities/activitiesService");
const { UploadsSchema } = require("../../modules/validation/uploads.js");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const jwt = require("jsonwebtoken");
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
const chai = require("chai");
chai.use(require("chai-shallow-deep-equal"));
describe("Newsletter", function () {
  before(async function () {
    await startServer();
    await h.wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  beforeEach(async function () {
    await Newsletter.MODEL.deleteMany({});
  });
  it("I cannot create a newsletter without the adminRight createNewsletter", async function () {
    const myUser = await h.createUser({ isAdmin: false });
    const adminUser = await h.createUser({
      isAdmin: true,
      adminRights: {
        ...h.defaultAdminRights,
        createNewsletter: false,
        editNewsletter: true,
      },
    });
    await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "all_users",
        isDraft: true,
      })
      .expect(403);
    await h
      .createNewsletter(adminUser, {
        title: "title",
        content: "content",
        audience: "all_users",
        isDraft: true,
      })
      .expect(403);
  });
  it("I can create a newsletter with the adminRight createNewsletter", async function () {
    const adminUser2 = await h.createUser({
      isAdmin: true,
      adminRights: {
        ...h.defaultAdminRights,
        createNewsletter: true,
        editNewsletter: false,
      },
    });
    await h
      .createNewsletter(adminUser2, {
        title: "title",
        content: "content",
        audience: "all_users",
        isDraft: true,
      })
      .expect(200);
  });
  it("I cannot publish a newsletter whis isDraft equals true", async function () {
    const adminUser2 = await h.createUser({
      isAdmin: true,
      adminRights: {
        ...h.defaultAdminRights,
        createNewsletter: true,
        editNewsletter: false,
      },
    });
    const newsletter = await h
      .createNewsletter(adminUser2, {
        title: "title",
        content: "content",
        audience: "all_users",
        isDraft: true,
      })
      .expect(200);
    await h.publishNewsletter(adminUser2, newsletter.body).expect(400);
  });
  it("I can publish a newsletter", async function () {
    const adminUser2 = await h.createUser({
      isAdmin: true,
      adminRights: {
        ...h.defaultAdminRights,
        createNewsletter: true,
        editNewsletter: false,
      },
    });
    const newsletter = await h
      .createNewsletter(adminUser2, {
        title: "title",
        content: "content",
        audience: "all_users",
        isDraft: false,
      })
      .expect(200);
    await h.publishNewsletter(adminUser2, newsletter.body).expect(200);
  });
  async function getNewsletterNotifications(user) {
    return await Activities.MODEL.find({ user: user._id, type: "newsletter" });
  }
  async function checkNewsletterLength(user, length) {
    expect(await getNewsletterNotifications(user)).to.have.a.lengthOf(length);
  }
  it("I can publish a newsletter for existing_users", async function () {
    const myUser = await h.createUser({
      isAdmin: true,
      adminRights: {
        ...h.defaultAdminRights,
        createNewsletter: true,
      },
    });
    const existingUser1 = await h.createUser();
    const existingUser2 = await h.createUser();
    const newsletter = await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "existing_users",
        isDraft: false,
      })
      .expect(200);
    await h.publishNewsletter(myUser, newsletter.body).expect(200);
    await Newsletter.sendNotifications(newsletter.body._id.toString());

    const newUser1 = await h.createUser();

    await checkNewsletterLength(myUser, 1);
    await checkNewsletterLength(existingUser1, 1);
    await checkNewsletterLength(existingUser2, 1);
    await checkNewsletterLength(newUser1, 0);
  });
  it("I can publish a newsletter for new_users", async function () {
    const myUser = await h.createUser({
      isAdmin: true,
      adminRights: {
        ...h.defaultAdminRights,
        createNewsletter: true,
      },
    });
    const existingUser1 = await h.createUser();
    const existingUser2 = await h.createUser();
    const newsletter = await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "new_users",
        isDraft: false,
      })
      .expect(200);
    await h.publishNewsletter(myUser, newsletter.body).expect(200);
    await Newsletter.sendNotifications(newsletter.body._id.toString());

    const newUser1 = await h.createUser();

    await checkNewsletterLength(myUser, 0);
    await checkNewsletterLength(existingUser1, 0);
    await checkNewsletterLength(existingUser2, 0);
    await checkNewsletterLength(newUser1, 1);
  });
  it("I can publish a newsletter for all_users", async function () {
    const myUser = await h.createUser({
      isAdmin: true,
      adminRights: {
        ...h.defaultAdminRights,
        createNewsletter: true,
      },
    });
    const existingUser1 = await h.createUser();
    const existingUser2 = await h.createUser();
    const newsletter = await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "all_users",
        isDraft: false,
      })
      .expect(200);
    await h.publishNewsletter(myUser, newsletter.body).expect(200);
    await Newsletter.sendNotifications(newsletter.body._id.toString());

    const newUser1 = await h.createUser();

    await checkNewsletterLength(myUser, 1);
    await checkNewsletterLength(existingUser1, 1);
    await checkNewsletterLength(existingUser2, 1);
    await checkNewsletterLength(newUser1, 1);
  });
  it("When one newsletter for all_users and one for new_users is published, new users have two newsletters in their feed", async function () {
    const myUser = await h.createUser({
      isAdmin: true,
      adminRights: {
        ...h.defaultAdminRights,
        createNewsletter: true,
      },
    });
    const existingUser1 = await h.createUser();
    const existingUser2 = await h.createUser();
    const newsletter = await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "all_users",
        isDraft: false,
      })
      .expect(200);
    await h.publishNewsletter(myUser, newsletter.body).expect(200);
    await Newsletter.sendNotifications(newsletter.body._id.toString());
    const newUser1 = await h.createUser();
    const newsletter2 = await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "new_users",
        isDraft: false,
      })
      .expect(200);
    const newUser2 = await h.createUser();
    await h.publishNewsletter(myUser, newsletter2.body).expect(200);
    await Newsletter.sendNotifications(newsletter2.body._id.toString());

    await checkNewsletterLength(myUser, 1);
    await checkNewsletterLength(existingUser1, 1);
    await checkNewsletterLength(existingUser2, 1);
    await checkNewsletterLength(newUser1, 1);
    await checkNewsletterLength(newUser2, 2);
  });
  it("When one newsletter for existing_users and one for new_users is published, new users have only one newsletters in their feed", async function () {
    const myUser = await h.createUser({
      isAdmin: true,
      adminRights: {
        ...h.defaultAdminRights,
        createNewsletter: true,
      },
    });
    const existingUser1 = await h.createUser();
    const existingUser2 = await h.createUser();
    const newsletter = await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "existing_users",
        isDraft: false,
      })
      .expect(200);
    await h.publishNewsletter(myUser, newsletter.body).expect(200);
    await Newsletter.sendNotifications(newsletter.body._id.toString());
    const newUser1 = await h.createUser();
    const newsletter2 = await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "new_users",
        isDraft: false,
      })
      .expect(200);
    // creating drafts which should not trigger an activity
    await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "new_users",
        isDraft: true,
      })
      .expect(200);
    await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "existing_users",
        isDraft: true,
      })
      .expect(200);
    await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "all_users",
        isDraft: true,
      })
      .expect(200);
    const newsletter3 = await h
      .createNewsletter(myUser, {
        title: "title",
        content: "content",
        audience: "new_users",
        isDraft: true,
      })
      .expect(200);
    const newUser2 = await h.createUser();
    await h.publishNewsletter(myUser, newsletter2.body).expect(200);
    await Newsletter.sendNotifications(newsletter2.body._id.toString());

    await checkNewsletterLength(myUser, 1);
    await checkNewsletterLength(existingUser1, 1);
    await checkNewsletterLength(existingUser2, 1);
    await checkNewsletterLength(newUser1, 0);
    await checkNewsletterLength(newUser2, 1);
  });
});

after(async function () {
  if (process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
