const request = require("supertest");
const app = require("../../app.js").app;
const startServer = require("../../app").startServer;
const mongoose = require("mongoose");
const User = require("../../services/users/usersService.js");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const createUser = require("./helpers.js").createUser;
const wipeDatabaseAndEmptyS3Bucket =
  require("./helpers.js").wipeDatabaseAndEmptyS3Bucket;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
describe("/errors", function () {
  before(async () => {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("is accessible without a token and has the right structure", async () => {
    const errors = (
      await request(app)
        .get(`/errors`)
        .expect("Content-Type", /json/)
        .expect(200)
    ).body;

    expect(Object.keys(errors).length).to.be.a.above(1);
    for (const key in errors) {
      expect(errors[key]).to.have.property("en");
      expect(errors[key]).to.have.property("de");
    }
  });
  it("is accessible with a token and has the right structure", async () => {
    const myUser = await createUser();
    const errors = (
      await request(app)
        .get(`/errors`)
        .set("Authorization", myUser.TOKEN)
        .expect("Content-Type", /json/)
        .expect(200)
    ).body;

    expect(Object.keys(errors).length).to.be.a.above(1);
    for (const key in errors) {
      expect(errors[key]).to.have.property("en");
      expect(errors[key]).to.have.property("de");
    }
  });
});

after(async () => {
  if (process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
