const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const h = require("./helpers");
const User = require("../../services/users/usersService.js");
const Payout = require("../../services/payouts/payoutsService");
const Party = require("../../services/parties/partiesService");
const ImageMention = require("../../services/imageMention/imageMentionService");
const Uploads = require("../../services/uploads/uploadsService");
const AdminLog = require("../../services/adminlogs/adminLogsService");
const Transaction = require("../../services/transactions/transactionsService");
const ReferralTree = require("../../services/referralTree/referralTreeService");
const { UploadsSchema } = require("../../modules/validation/uploads.js");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const jwt = require("jsonwebtoken");
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
const chai = require("chai");
chai.use(require("chai-shallow-deep-equal"));
const defaultRights = h.defaultAdminRights;
describe("Payouts", function () {
  before(async function () {
    await startServer();
    await h.wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  it("I can create a payout request", async function () {
    const myUser = await h.createUser({
      partyPoints: 500,
      verification: { verified: true },
    });
    await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(200);
    const payouts = await Payout.MODEL.find({ user: myUser._id });
    expect(payouts).to.have.a.lengthOf(1);
    expect(payouts[0].amount).to.be.equal(500);
    expect(payouts[0].status).to.be.equal("pending");
    expect(payouts[0].email).to.be.equal("test@test.com");
  });
  it("I cannot create the same payout concurrently", async function () {
    const myUser = await h.createUser({
      partyPoints: 500000,
      verification: { verified: true },
    });
    await Promise.all([
      h.createPayout(myUser, { amount: 500, email: "test@test.com" }),
      h.createPayout(myUser, { amount: 500, email: "test@test.com" }),
      h.createPayout(myUser, { amount: 500, email: "test@test.com" }),
      h.createPayout(myUser, { amount: 500, email: "test@test.com" }),
      h.createPayout(myUser, { amount: 500, email: "test@test.com" }),
      h.createPayout(myUser, { amount: 500, email: "test@test.com" }),
      h.createPayout(myUser, { amount: 500, email: "test@test.com" }),
      h.createPayout(myUser, { amount: 500, email: "test@test.com" }),
    ]);
    /*await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(200);*/
    const payouts = await Payout.MODEL.find({ user: myUser._id });
    expect(payouts).to.have.a.lengthOf(1);
    expect(payouts[0].amount).to.be.equal(500);
    expect(payouts[0].status).to.be.equal("pending");
    expect(payouts[0].email).to.be.equal("test@test.com");
    expect(payouts[0].minute).to.be.equal(
      Math.round(new Date().getTime() / 60000)
    );
  });
  it("I cannot create a payout request when I dont have enough PP balance", async function () {
    const myUser = await h.createUser({
      partyPoints: 499,
      verification: { verified: true },
    });
    await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(400);
    const payouts = await Payout.MODEL.find({ user: myUser._id });
    expect(payouts).to.have.a.lengthOf(0);
  });
  it("I cannot create a payout request with an amount under 500", async function () {
    const myUser = await h.createUser({
      partyPoints: 1000,
      verification: { verified: true },
    });
    await h
      .createPayout(myUser, { amount: 400, email: "test@test.com" })
      .expect(400);
    const payouts = await Payout.MODEL.find({ user: myUser._id });
    expect(payouts).to.have.a.lengthOf(0);
  });
  it("My first payout must have an amount of 500", async function () {
    const myUser = await h.createUser({
      partyPoints: 5000,
      verification: { verified: true },
    });
    await h
      .createPayout(myUser, { amount: 5000, email: "test@test.com" })
      .expect(400);
    await h
      .createPayout(myUser, { amount: 501, email: "test@test.com" })
      .expect(400);
    let payouts = await Payout.MODEL.find({ user: myUser._id });
    expect(payouts).to.have.a.lengthOf(0);

    await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(200);
    payouts = await Payout.MODEL.find({ user: myUser._id });
    expect(payouts).to.have.a.lengthOf(1);
    expect(payouts[0].amount).to.be.equal(500);
    expect(payouts[0].status).to.be.equal("pending");
    expect(payouts[0].email).to.be.equal("test@test.com");
  });
  it("My second payout must have an amount of 5000", async function () {
    const myUser = await h.createUser({
      partyPoints: 5500,
      verification: { verified: true },
    });
    await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(200);

    await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(400);
    await h
      .createPayout(myUser, { amount: 25000, email: "test@test.com" })
      .expect(400);
    await h
      .createPayout(myUser, { amount: 5001, email: "test@test.com" })
      .expect(400);
    let payouts = await Payout.MODEL.find({ user: myUser._id });
    expect(payouts).to.have.a.lengthOf(1);

    await h
      .createPayout(myUser, { amount: 5000, email: "test@test.com" })
      .expect(200);
    payouts = await Payout.MODEL.find({ user: myUser._id });
    expect(payouts).to.have.a.lengthOf(2);
    expect(payouts[1].amount).to.be.equal(5000);
    expect(payouts[1].status).to.be.equal("pending");
    expect(payouts[1].email).to.be.equal("test@test.com");
  });
  it("My third payout must have an amount of 25000", async function () {
    const myUser = await h.createUser({
      partyPoints: 50000,
      verification: { verified: true },
    });
    await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(200);

    await h
      .createPayout(myUser, { amount: 5000, email: "test@test.com" })
      .expect(200);
    await h
      .createPayout(myUser, { amount: 26000, email: "test@test.com" })
      .expect(400);
    await h
      .createPayout(myUser, { amount: 5001, email: "test@test.com" })
      .expect(400);
    let payouts = await Payout.MODEL.find({ user: myUser._id });
    expect(payouts).to.have.a.lengthOf(2);

    await h
      .createPayout(myUser, { amount: 25000, email: "test@test.com" })
      .expect(200);
    payouts = await Payout.MODEL.find({ user: myUser._id });
    expect(payouts).to.have.a.lengthOf(3);
    expect(payouts[2].amount).to.be.equal(25000);
    expect(payouts[2].status).to.be.equal("pending");
    expect(payouts[2].email).to.be.equal("test@test.com");
  });
  it.skip("My fourth payout and all consecutive payouts can have an amount of 25000 or more", async function () {
    const myUser = await h.createUser({
      partyPoints: 10000000,
      verification: { verified: true },
    });
    await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(200);

    await h
      .createPayout(myUser, { amount: 5000, email: "test@test.com" })
      .expect(200);
    await h
      .createPayout(myUser, { amount: 25000, email: "test@test.com" })
      .expect(200);
    await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(400);
    await h
      .createPayout(myUser, { amount: 24000, email: "test@test.com" })
      .expect(400);
    await h
      .createPayout(myUser, { amount: 25000, email: "test@test.com" })
      .expect(200);
    await h
      .createPayout(myUser, { amount: 50000, email: "test@test.com" })
      .expect(200);
    await h
      .createPayout(myUser, { amount: 25000, email: "test@test.com" })
      .expect(200);
    let payouts = await Payout.MODEL.find({ user: myUser._id });
    expect(payouts).to.have.a.lengthOf(6);
  });
  it("A payoutRequested transaction is created when creating a payout request", async function () {
    const myUser = await h.createUser({
      partyPoints: 50000,
      verification: { verified: true },
    });
    await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(200);
    const transactions = await Transaction.MODEL.find({ user: myUser._id });
    expect(transactions).to.have.a.lengthOf(1);
    expect(transactions[0].type).to.be.equal("payoutRequested");
    expect(transactions[0].amount).to.be.equal(-500);
    expect(transactions[0].direction).to.be.equal("debit");
  });
  it("Only admins with the right enablePayouts or payoutPayouts can patch a payout status to rejected", async function () {
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });
    const myUser = await h.createUser({
      partyPoints: 50000,
      verification: { verified: true },
    });
    const otherUser = await h.createUser({
      partyPoints: 50000,
      verification: { verified: true },
    });
    const payout = await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(200);
    await h
      .patchPayout(otherUser, payout.body, { status: "rejected" })
      .expect(403);
    await h.createAdmin(adminUser, otherUser).expect(200);
    await h
      .patchAdmin(adminUser, otherUser, {
        ...defaultRights,
        enablePayouts: true,
      })
      .expect(200);

    await h
      .patchPayout(otherUser, payout.body, { status: "rejected" })
      .expect(200);

    expect((await Payout.MODEL.findById(payout.body._id)).status).to.be.equal(
      "rejected"
    );
  });
  it("Only admins with the right payoutPayouts can patch a payout status to paid", async function () {
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });
    const myUser = await h.createUser({
      partyPoints: 50000,
      verification: { verified: true },
    });
    const otherUser = await h.createUser({
      partyPoints: 50000,
      verification: { verified: true },
    });
    const payout = await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(200);
    expect((await User.getRaw(myUser._id)).partyPoints).to.be.equal(49500);
    await h.patchPayout(otherUser, payout.body, { status: "paid" }).expect(403);
    await h.createAdmin(adminUser, otherUser).expect(200);
    await h
      .patchAdmin(adminUser, otherUser, {
        ...defaultRights,
        enablePayouts: true,
      })
      .expect(200);

    await h.patchPayout(otherUser, payout.body, { status: "paid" }).expect(403);
    await h
      .patchAdmin(adminUser, otherUser, {
        ...defaultRights,
        payoutPayouts: true,
      })
      .expect(200);
    await h.patchPayout(otherUser, payout.body, { status: "paid" }).expect(200);
    expect((await User.getRaw(myUser._id)).partyPoints).to.be.equal(49500);
    expect((await Payout.MODEL.findById(payout.body._id)).status).to.be.equal(
      "paid"
    );
  });
  it("A payoutRejected transaction is created when rejecting a payout request and PP in user object are updated", async function () {
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });
    const myUser = await h.createUser({
      partyPoints: 50000,
      verification: { verified: true },
    });
    const payout = await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(200);
    expect((await User.getRaw(myUser._id)).partyPoints).to.be.equal(49500);
    await h
      .patchPayout(adminUser, payout.body, { status: "rejected" })
      .expect(200);
    expect((await User.getRaw(myUser._id)).partyPoints).to.be.equal(50000);
    expect((await Payout.MODEL.findById(payout.body._id)).status).to.be.equal(
      "rejected"
    );
    const transactions = await Transaction.MODEL.find({ user: myUser._id });
    expect(transactions).to.have.a.lengthOf(2);
    expect(transactions[1].type).to.be.equal("payoutRejected");
    expect(transactions[1].amount).to.be.equal(500);
    expect(transactions[1].direction).to.be.equal("credit");
  });
  it("I cannot create a payout if one of my requests has the status rejected", async function () {
    const myUser = await h.createUser({
      partyPoints: 50000,
      verification: { verified: true },
    });
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });
    const payout = await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(200);
    await h
      .patchPayout(adminUser, payout.body, { status: "rejected" })
      .expect(200);

    await h
      .createPayout(myUser, { amount: 500, email: "test@test.com" })
      .expect(400);
    await h
      .createPayout(myUser, { amount: 5000, email: "test@test.com" })
      .expect(400);

    await h
      .patchPayout(adminUser, payout.body, { status: "enabled" })
      .expect(200);

    await h
      .createPayout(myUser, { amount: 5000, email: "test@test.com" })
      .expect(200);
  });
});

after(async function () {
  if (process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
