const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const getPartyGuests = require("./helpers.js").getPartyGuests;
const getMyBookmarks = require("./helpers.js").getMyBookmarks;
const bookmarkParty = require("./helpers.js").bookmarkParty;
const joinParty = require("./helpers.js").joinParty;
const rateParty = require("./helpers.js").rateParty;
const patchRating = require("./helpers.js").patchRating;
const createParty = require("./helpers.js").createParty;
const createUser = require("./helpers.js").createUser;
const deleteBookmark = require("./helpers.js").deleteBookmark;
const getRatings = require("./helpers.js").getRatings;
const wipeDatabaseAndEmptyS3Bucket =
  require("./helpers.js").wipeDatabaseAndEmptyS3Bucket;
const deleteParty = require("./helpers.js").deleteParty;
const deletePartyAdmin = require("./helpers.js").deletePartyAdmin;
const checkForSensitiveData = require("./helpers.js").checkForSensitiveData;
const createJWToken =
  require("../../services/users/usersService.js").createJWToken;
const User = require("../../services/users/usersService.js");
const Party = require("../../services/parties/partiesService.js");
const PartyGuest = require("../../services/partyGuests/partyGuestsService.js");
const Rating = require("../../services/ratings/ratingsService.js");
const generateUser = require("./data/getRandomUserData.js").generateUser;
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
const { handleOnSiteCheck } = require("../../modules/onSiteCheck/onsideCheck");
describe("OnSite Notifications", function () {
  before(async () => {
    await startServer();
    await wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });
  function getDatePlusHours(hours) {
    const date = new Date();
    date.setTime(date.getTime() + hours * 60 * 60 * 1000);
    return date;
  }
  function getDatePlusMinutes(minutes) {
    const date = new Date();
    date.setTime(date.getTime() + minutes * 60 * 1000);
    return date;
  }
  const now = new Date();
  it("my onsite status is unknown by default", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (
      await createParty(otherUser, { name: "test", capacity: 10 })
    ).body._id;
    await joinParty(partyId, myUser).expect(200);

    const dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");
  });
  it("onsite is set false if the party is over", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (
      await createParty(otherUser, { name: "test", capacity: 10 })
    ).body._id;
    await joinParty(partyId, myUser).expect(200);

    let dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");

    await Party.patch(partyId, {
      startDate: getDatePlusHours(-24),
      endDate: getDatePlusHours(-5),
    });

    await handleOnSiteCheck();

    dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("no");
  });
  it("onsite is set false if the startDate is 2 hours ago and no enddate is defined", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const otherUser2 = await createUser();
    const partyId = (
      await createParty(otherUser, { name: "test", capacity: 10 })
    ).body._id;
    await joinParty(partyId, myUser).expect(200);
    await joinParty(partyId, otherUser2).expect(200);

    let dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");

    await Party.patch(partyId, {
      startDate: getDatePlusHours(-1),
      endDate: null,
    });

    await handleOnSiteCheck();

    dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");

    await Party.patch(partyId, {
      startDate: getDatePlusHours(-2),
      endDate: null,
    });

    await handleOnSiteCheck();

    dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("no");

    let dbPartyGuest2 = await PartyGuest.MODEL.find({ user: otherUser2._id });
    expect(dbPartyGuest2[0].onSite).to.be.equal("no");
  });
  it("onsite is not set to false when it was previusly set to true", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const otherUser2 = await createUser();
    const partyId = (
      await createParty(otherUser, { name: "test", capacity: 10 })
    ).body._id;
    await joinParty(partyId, myUser).expect(200);
    await joinParty(partyId, otherUser2).expect(200);

    let dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");

    let dbPartyGuest2 = await PartyGuest.MODEL.find({ user: otherUser2._id });
    expect(dbPartyGuest2[0].onSite).to.be.equal("unknown");

    await PartyGuest.patch(dbPartyGuest2[0]._id, { onSite: "yes" });
    await Party.patch(partyId, {
      startDate: getDatePlusHours(-24),
      endDate: null,
    });

    await handleOnSiteCheck();

    dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("no");

    dbPartyGuest2 = await PartyGuest.MODEL.find({ user: otherUser2._id });
    expect(dbPartyGuest2[0].onSite).to.be.equal("yes");
  });
  it("push notification is sent", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (
      await createParty(otherUser, {
        name: "test",
        capacity: 10,
        startDate: getDatePlusHours(-8),
        endDate: getDatePlusHours(5),
      })
    ).body._id;
    await joinParty(partyId, myUser).expect(200);

    let dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");
    expect(dbPartyGuest[0].showedOnSiteNotification).to.be.null;

    await handleOnSiteCheck();

    dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");
    expect(dbPartyGuest[0].showedOnSiteNotification).to.be.not.null;
  });
  it("push notification is sent again after 60 minutes", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (
      await createParty(otherUser, {
        name: "test",
        capacity: 10,
        startDate: getDatePlusMinutes(-120),
        endDate: getDatePlusMinutes(60 * 10),
      })
    ).body._id;
    await joinParty(partyId, myUser).expect(200);

    let dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");
    expect(dbPartyGuest[0].showedOnSiteNotification).to.be.null;

    await handleOnSiteCheck();

    dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");
    expect(dbPartyGuest[0].showedOnSiteNotification).to.be.not.null;
    const showedOnSiteNotification = getDatePlusMinutes(-30);

    await PartyGuest.patch(dbPartyGuest[0]._id, {
      showedOnSiteNotification: showedOnSiteNotification,
    });
    await handleOnSiteCheck();

    dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");
    expect(dbPartyGuest[0].showedOnSiteNotification.toISOString()).to.be.equal(
      showedOnSiteNotification.toISOString()
    );

    await PartyGuest.patch(dbPartyGuest[0]._id, {
      showedOnSiteNotification: getDatePlusMinutes(-30),
    });
    await handleOnSiteCheck();

    dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");
    expect(
      dbPartyGuest[0].showedOnSiteNotification.toISOString()
    ).to.be.not.equal(showedOnSiteNotification.toISOString());

    const timeNow = getDatePlusMinutes(0);
    await PartyGuest.patch(dbPartyGuest[0]._id, {
      showedOnSiteNotification: timeNow,
    });
    await handleOnSiteCheck();

    dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");
    expect(dbPartyGuest[0].showedOnSiteNotification.toISOString()).to.be.equal(
      timeNow.toISOString()
    );
  });
  it("push notification is not sent after party has ended", async () => {
    const myUser = await createUser();
    const otherUser = await createUser();
    const partyId = (
      await createParty(otherUser, {
        name: "test",
        capacity: 10,
        startDate: getDatePlusMinutes(-120),
        endDate: getDatePlusMinutes(-1),
      })
    ).body._id;
    await joinParty(partyId, myUser).expect(200);

    let dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("unknown");
    expect(dbPartyGuest[0].showedOnSiteNotification).to.be.null;

    await handleOnSiteCheck();

    dbPartyGuest = await PartyGuest.MODEL.find({ user: myUser._id });
    expect(dbPartyGuest[0].onSite).to.be.equal("no");
    expect(dbPartyGuest[0].showedOnSiteNotification).to.be.null;
  });
});

after(async () => {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
