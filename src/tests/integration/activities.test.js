/* eslint-disable no-unused-vars */
const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const h = require("./helpers");
const User = require("../../services/users/usersService.js");
const Activiy = require("../../services/activities/activitiesService");
const Upload = require("../../services/uploads/uploadsService");
const Party = require("../../services/parties/partiesService");
const Competition = require("../../services/competitions/competitionsService");
const PartyGuest = require("../../services/partyGuests/partyGuestsService");
const Restriction = require("../../services/restrictions/restrictionsService");
const AdminLog = require("../../services/adminlogs/adminLogsService");
const expect = require("chai").expect;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const setDisableFirebase =
  require("../../services/users/modules/firebase/users.js").setDisableFirebase;
const startServer = require("../../app").startServer;
describe("Activities", function () {
  this.timeout(10000);
  before(async function () {
    await startServer();
    await h.wipeDatabaseAndEmptyS3Bucket();
    setDisableFirebase(true);
  });

  it("157 Benachrichtigung an Veranstalter versenden wenn ein Benutzer seine Anfrage zur Teilnahme an eine geschlossene Party zurückgezogen hat.", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const party = (
      await h.createParty(myUser, {
        name: "test",
        capacity: 10,
        privacyLevel: "closed",
      })
    ).body;
    const r = (await h.joinParty(party._id, otherUser).expect(200)).body;
    expect(r.status).to.be.string("requested");
    await h.deletePartyGuest(otherUser, party._id);

    const activities = await Activiy.MODEL.find({});
    console.log(activities);
    expect(activities.find((a) => a.type === "partyGuestRemovedHimself")).not.to
      .be.undefined;
  });
  it("256 Der Benutzer, dessen Rating gelöscht wurde, erhält eine Notification, dass seine Bewertung für die Party (Partyname) von einem Administrator entfernt wurde. (Notification 05.01 - Notification category All about Parties)", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });
    const party = (
      await h.createParty(myUser, {
        name: "test",
        capacity: 10,
        privacyLevel: "open",
      })
    ).body;
    const r = (await h.joinParty(party._id, otherUser).expect(200)).body;
    const r2 = await h.rateParty(party._id, otherUser, 5).expect(200);
    await h.deleteRating(adminUser, party._id, r2.body._id).expect(200);

    const activities = await Activiy.MODEL.find({});
    console.log(activities);
    expect(
      activities.filter((a) => a.type === "adminDeletedPartyRating")
    ).to.have.a.lengthOf(2);
  });
  it("301 Es wird eine Notification an die Benutzer auf der Gästeliste/ Bookmarks versandt, wenn die Party am Partywettbewerb teilnimmt", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });
    const party = (
      await h.createParty(myUser, {
        name: "test",
        capacity: 10,
        privacyLevel: "open",
      })
    ).body;
    const r = (await h.joinParty(party._id, otherUser).expect(200)).body;
    await h.joinParty(party._id, await h.createUser()).expect(200);
    await h.joinParty(party._id, await h.createUser()).expect(200);
    await h.joinParty(party._id, await h.createUser()).expect(200);
    await h.joinParty(party._id, await h.createUser()).expect(200);

    await h.bookmarkParty(party._id, await h.createUser());
    await h.bookmarkParty(party._id, await h.createUser());
    const competition = (
      await h
        .createCompetition(adminUser, {
          name: "Competition name",
          startDate: "2020-01-01T20:00:00.000",
          endDate: "2129-01-01T23:00:00.000",
        })
        .expect(200)
    ).body;
    console.log(competition);
    console.log(
      (await h.joinCompetition(myUser, party._id, competition._id).expect(200))
        .body
    );

    const activities = await Activiy.MODEL.find({});
    console.log(activities);
    expect(
      activities.filter((a) => a.type === "partyParticipatesOnCompetition")
    ).to.have.a.lengthOf(7);
  });
  it("175 Wenn ein Identvideo als echt bestätigt wurde, ist der Benutzer ab sofort verifiziertes Mitglied und es wird hierzu eine Benachrichtigung versandt an: Freunde, Follower, himself", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const otherUser4 = await h.createUser();
    const otherUser5 = await h.createUser();
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });

    await h.sendFriendRequest(otherUser, myUser);
    await h.acceptFriendRequest(myUser, otherUser);
    await h.sendFriendRequest(otherUser2, myUser);
    await h.acceptFriendRequest(myUser, otherUser2);

    await h.followUser(otherUser3, myUser);
    const video = await h.uploadVerificationVideo(myUser);
    await h.setVerificationVideo(myUser, video).expect(200);

    // verify user
    await h.voteForVerification(adminUser, myUser, true).expect(200);

    const activities = await Activiy.MODEL.find({});
    console.log(activities.filter((a) => a.type === "userIsNowVerified"));
    expect(
      activities.filter((a) => a.type === "userIsNowVerified")
    ).to.have.a.lengthOf(4);
  });
  it("175 Wenn ein Identvideo als unecht bestätigt wurde, wird hierzu eine Benachrichtigung an den Benutzer selbst (Notification 05.07) versandt. ", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });

    const video = await h.uploadVerificationVideo(myUser);
    await h.setVerificationVideo(myUser, video).expect(200);

    // verify user
    await h.voteForVerification(adminUser, myUser, false).expect(200);

    const activities = await Activiy.MODEL.find({});
    console.log(activities.filter((a) => a.type === "identVideoWasDeclined"));
    expect(
      activities.filter((a) => a.type === "identVideoWasDeclined")
    ).to.have.a.lengthOf(1);
  });
  it("246 Wenn der Benutzer sein Profil auf ein ACT-Profil umstellt/ zurück umstellt, wird eine Benachrichtigung versandt an: himself", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser({ isPartyKing: true });
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });

    await h.sendFriendRequest(otherUser, myUser);
    await h.acceptFriendRequest(myUser, otherUser);
    await h.sendFriendRequest(otherUser2, myUser);
    await h.acceptFriendRequest(myUser, otherUser2);

    await h.followUser(otherUser3, myUser);

    await User.patch(myUser._id, { isArtist: true });
    let activities = await Activiy.MODEL.find({});
    //    console.log(activities.filter((a) => a.type === "artistActive"));
    expect(
      activities.filter((a) => a.type === "artistActive")
    ).to.have.a.lengthOf(4);

    await User.patch(myUser._id, { isArtist: false });
    activities = await Activiy.MODEL.find({});
    //  console.log(activities.filter((a) => a.type === "artistInactive"));
    expect(
      activities.filter((a) => a.type === "artistInactive")
    ).to.have.a.lengthOf(1);
  });
  it("285 Wenn ein Benutzer neu Verlinkt wurde, wird eine Benachrichtigung versandt an: Benutzer, der das Bild hochgeladen hat (Notification 05.05)", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser({ isPartyKing: true });
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();

    const partyId = (await h.createParty(myUser, { name: "test" })).body._id;
    const files = [await h.uploadPartyPic(otherUser2)];
    const res = await h
      .createPost(otherUser2, partyId, "description", files)
      .expect(200);

    const uploads = await h.getUsersS3Uploads(otherUser2);
    expect(uploads).to.have.a.lengthOf(1);

    await h.sendFriendRequest(otherUser, otherUser3);
    await h.acceptFriendRequest(otherUser3, otherUser);
    console.log("#1");
    await h.mentionUser(otherUser, files[0], otherUser3).expect(200);
    console.log("#2");

    let activities = await Activiy.MODEL.find({});
    //    console.log(activities.filter((a) => a.type === "artistActive"));
    expect(
      activities.filter((a) => a.type === "userWasMentionedInYourUpload")
    ).to.have.a.lengthOf(1);
    expect(
      activities.filter((a) => a.type === "userMentionWasDeletedInYourUpload")
    ).to.have.a.lengthOf(0);
    await h.deleteMention(otherUser, files[0], otherUser3).expect(200);
    activities = await Activiy.MODEL.find({});
    //  console.log(activities.filter((a) => a.type === "artistInactive"));
    expect(
      activities.filter((a) => a.type === "userMentionWasDeletedInYourUpload")
    ).to.have.a.lengthOf(1);
  });
  it("137 Wenn der Benutzer eine neue Party veröffentlicht hat (nicht als Entwurf), wird eine Benachrichtigung versendet an: Freunde, Follower", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const otherUser4 = await h.createUser();
    const otherUser5 = await h.createUser();
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });

    await h.sendFriendRequest(otherUser, myUser);
    await h.acceptFriendRequest(myUser, otherUser);
    await h.sendFriendRequest(otherUser2, myUser);
    await h.acceptFriendRequest(myUser, otherUser2);

    await h.followUser(otherUser3, myUser);

    await h.createParty(myUser, { name: "testparty", status: "published" });

    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "partyWasPublished")
    ).to.have.a.lengthOf(3);

    const party = (
      await h.createParty(myUser, { name: "testparty2", status: "draft" })
    ).body;

    activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "partyWasPublished")
    ).to.have.a.lengthOf(3);

    await h.patchParty(myUser, party._id, { status: "published" });
    activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "partyWasPublished")
    ).to.have.a.lengthOf(6);

    const party2 = (
      await h.createParty(myUser, {
        name: "testparty3",
        status: "draft",
        privacyLevel: "secret",
      })
    ).body;
    const party3 = (
      await h.createParty(myUser, {
        name: "testparty4",
        status: "published",
        privacyLevel: "secret",
      })
    ).body;
    await h.patchParty(myUser, party2._id, { status: "published" });
    activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "partyWasPublished")
    ).to.have.a.lengthOf(6);
  });
  it("159 Hat der Benutzer eine Bewertung abgegeben, wird eine Notification an den Veranstalter versandt, wie seine Party bewertet wurde (Notification 05.05).; Ebenso wird eine Notification an alle Gäste der Gästeliste versandt, dass die Party vom Benutzer mit einer x Sterne Bewertung bewertet wurde", async function () {
    //partyRatingCreated
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const otherUser4 = await h.createUser();
    const otherUser5 = await h.createUser();
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });

    const r = await h.createParty(myUser, { name: "Test Party" }).expect(200);
    const partyId = r.body._id;
    await h.joinParty(partyId, otherUser);
    await h.joinParty(partyId, otherUser2);
    await h.joinParty(partyId, otherUser3);
    await h.joinParty(partyId, otherUser4);
    const r2 = await h.rateParty(partyId, otherUser, 3).expect(200);

    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter(
        (a) =>
          a.type === "partyRatingCreated" &&
          a.user.toString() === myUser._id.toString()
      )
    ).to.have.a.lengthOf(1);
    expect(
      activities.filter(
        (a) =>
          a.type === "partyRatingCreated" &&
          a.user.toString() !== myUser._id.toString()
      )
    ).to.have.a.lengthOf(3);
  });
  it("163 Wenn der Inhalt mit dem Benutzer geteilt wurde, dann erhält dieser eine Benachrichtigung, wer mit ihm den Inhalt geteilt hat und was er geteilt hat. (Notification 05.06)", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const otherUser4 = await h.createUser();
    const otherUser5 = await h.createUser();
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });

    const r = await h
      .createParty(otherUser, { name: "Test Party" })
      .expect(200);
    const partyId = r.body._id;
    await h.sendFriendRequest(myUser, otherUser2);
    await h.acceptFriendRequest(otherUser2, myUser);
    await h.sendFriendRequest(otherUser2, otherUser4);
    await h.acceptFriendRequest(otherUser4, otherUser2);
    await h
      .share(otherUser2, [myUser, otherUser4], { sharedParty: partyId })
      .expect(200);

    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter(
        (a) =>
          a.type === "sharedParty" &&
          a.user.toString() === myUser._id.toString()
      )
    ).to.have.a.lengthOf(1);
    expect(
      activities.filter(
        (a) =>
          a.type === "sharedParty" &&
          a.user.toString() !== myUser._id.toString()
      )
    ).to.have.a.lengthOf(1);

    const files = [await h.uploadPartyPic(otherUser)];
    const post = (
      await h.createPost(otherUser, partyId, "description", files).expect(200)
    ).body;
    await h.share(myUser, [otherUser2], { sharedPost: post._id });
    activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "sharedPost")
    ).to.have.a.lengthOf(1);

    await h.share(myUser, [otherUser2], {
      sharedUser: otherUser3._id.toString(),
    });
    activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "sharedUser")
    ).to.have.a.lengthOf(1);
  });
  it("263 Wenn ein Kommentar durch einen Admin gelöscht wurde, wird eine Benachrichtigung mit dem Grund versandt an: Benutzer der den Kommentar erstellt hat (Notification 05.05), Benutzer dem das Medium gehört, in welchem der Kommentar gelöscht wurde (Notification 05.05)", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const otherUser4 = await h.createUser();
    const otherUser5 = await h.createUser();
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });

    const files = [await h.uploadPartyPic(otherUser)];
    const post = (
      await h.createUserPost(otherUser, "description", files).expect(200)
    ).body;

    const comment = (
      await h.createPostComment(myUser, post._id, "Du Pimmelberger").expect(200)
    ).body;
    await h.deletePostCommentAdmin(
      adminUser,
      comment._id,
      "Reason blub blub blub blub blub blub blub blub blub blub"
    );
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "deletedPostCommentByAdmin")
    ).to.have.a.lengthOf(2);
  });
  it("286 Wenn ein Profilbild durch den Administrator gelöscht wurde, wird eine Benachrichtigung an den Inhaber des Profils mit der Begründung des Administrators für die Löschung des Bildes und einer Aufforderung, ein neues Profilbild hochzuladen verschickt (Party heisst sehen und gesehen werden, Profilbilder sind daher Pflicht und Profile ohne Profilbild können gelöscht werden). (Notification 05.07).", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser();
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const otherUser4 = await h.createUser();
    const otherUser5 = await h.createUser();
    const adminUser = await h.createUser({
      isAdmin: true,
      isSuperAdmin: true,
      adminRights: { manageUserProfiles: true },
    });

    const pic = await h.uploadProfilePic(myUser);
    const res = await h.setProfilePicture(myUser, pic).expect(200);

    await h.deleteUploadAdmin(
      adminUser,
      pic._id,
      "Reason blub blub blub blub blub blub blub blub blub blub"
    );
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "deletedProfilePictureByAdmin")
    ).to.have.a.lengthOf(1);
  });
  it("286 Wenn ein Künstlertext durch den Administrator gelöscht wurde, wird eine Benachrichtigung an den Inhaber des Profils mit der Begründung des Administrators für die Löschung des Textes und einer Aufforderung, einen neuen Künstlertext zu formulieren verschickt. (Notification 05.07).", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser({
      isPartyKing: true,
      isArtist: true,
      artistDescription: "blub",
    });
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const otherUser4 = await h.createUser();
    const otherUser5 = await h.createUser();
    const adminUser = await h.createUser({
      isAdmin: true,
      isSuperAdmin: true,
      adminRights: { manageUserProfiles: true },
    });

    await h.deleteArtistDescriptionAdmin(
      adminUser,
      myUser,
      "Reason blub blub blub blub blub blub blub blub blub blub"
    );
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "deletedArtistDescriptionByAdmin")
    ).to.have.a.lengthOf(1);
  });
  it("2 - 286 Wenn ein Künstlertext durch den Administrator gelöscht wurde, wird eine Benachrichtigung an den Inhaber des Profils mit der Begründung des Administrators für die Löschung des Textes und einer Aufforderung, einen neuen Künstlertext zu formulieren verschickt. (Notification 05.07).", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser({
      isPartyKing: true,
      isArtist: true,
      artistDescription: "blub",
    });
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const otherUser4 = await h.createUser();
    const otherUser5 = await h.createUser();
    const adminUser = await h.createUser({
      isAdmin: true,
      isSuperAdmin: true,
      adminRights: { manageUserProfiles: true },
    });

    await h.deleteUserDescriptionAdmin(
      adminUser,
      myUser,
      "Reason blub blub blub blub blub blub blub blub blub blub"
    );
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "deletedProfileDescriptionByAdmin")
    ).to.have.a.lengthOf(1);
  });
  it("261 Wenn ein Medium durch den Administrator ausgeblendet wurde, wird eine Benachrichtigung mit dem Grund versandt an: Benutzer der das Medium hochgeladen hat (Notification 05.05), Benutzer dem das Profil oder die Party gehört, in welchem das Medium ausgeblendet wurde (Notification 05.05)", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser({
      isPartyKing: true,
      isArtist: true,
      artistDescription: "blub",
    });
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const otherUser4 = await h.createUser();
    const otherUser5 = await h.createUser();
    const adminUser = await h.createUser({
      isAdmin: true,
      isSuperAdmin: true,
      adminRights: { manageUserProfiles: true },
    });

    const files = [await h.uploadPartyPic(otherUser)];
    const post = (
      await h.createUserPost(otherUser, "description", files).expect(200)
    ).body;
    await h.hidePostAdmin(
      adminUser,
      post,
      "Reason blub blub blub blub blub blub blub blub blub blub"
    );
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "hiddenPostByAdmin")
    ).to.have.a.lengthOf(1);
  });
  it("261 Wenn ein Medium gelöscht wurde, welches vorher nicht bereits durch den Administrator ausgeblendet war, wird eine Benachrichtigung mit dem Grund versandt an: Benutzer der das Medium hochgeladen hat (Notification 05.05), Benutzer dem das Profil oder die Party gehört, in welchem das Medium gelöscht wurde (Notification 05.05)", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser({
      isPartyKing: true,
      isArtist: true,
      artistDescription: "blub",
    });
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const otherUser4 = await h.createUser();
    const otherUser5 = await h.createUser();
    const adminUser = await h.createUser({
      isAdmin: true,
      isSuperAdmin: true,
      adminRights: { manageUserProfiles: true },
    });
    const party = (
      await h.createParty(myUser, {
        name: "test",
        capacity: 10,
        privacyLevel: "closed",
      })
    ).body;
    const files = [await h.uploadPartyPic(otherUser)];
    const post = (
      await h.createPost(otherUser, party._id, "description", files).expect(200)
    ).body;
    await h.hidePostAdmin(
      adminUser,
      post,
      "Reason blub blub blub blub blub blub blub blub blub blub"
    );
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "hiddenPostByAdmin")
    ).to.have.a.lengthOf(2);
  });
  it("1 - 261 Wenn ein Medium gelöscht wurde, welches vorher nicht bereits durch den Administrator ausgeblendet war, wird eine Benachrichtigung mit dem Grund versandt an: Benutzer der das Medium hochgeladen hat (Notification 05.05), Benutzer dem das Profil oder die Party gehört, in welchem das Medium gelöscht wurde (Notification 05.05)", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser({
      isPartyKing: true,
      isArtist: true,
      artistDescription: "blub",
    });
    const otherUser = await h.createUser();
    const otherUser2 = await h.createUser();
    const otherUser3 = await h.createUser();
    const otherUser4 = await h.createUser();
    const otherUser5 = await h.createUser();
    const adminUser = await h.createUser({
      isAdmin: true,
      isSuperAdmin: true,
      adminRights: { manageUserProfiles: true },
    });
    const party = (
      await h.createParty(myUser, {
        name: "test",
        capacity: 10,
        privacyLevel: "closed",
      })
    ).body;
    const files = [await h.uploadPartyPic(otherUser)];
    const post = (
      await h.createPost(otherUser, party._id, "description", files).expect(200)
    ).body;
    await h.deletePostAdmin(
      adminUser,
      post,
      "Reason blub blub blub blub blub blub blub blub blub blub"
    );
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "deletedPostByAdmin")
    ).to.have.a.lengthOf(2);
  });
  it.skip("2 - 261 Wenn ein Medium gelöscht wurde, welches vorher nicht bereits durch den Administrator ausgeblendet war, wird eine Benachrichtigung mit dem Grund versandt an: Benutzer der das Medium hochgeladen hat (Notification 05.05), Benutzer dem das Profil oder die Party gehört, in welchem das Medium gelöscht wurde (Notification 05.05)", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser({
      username: "myUser",
      isPartyKing: true,
    });
    const partyAdmin1 = await h.createUser({ username: "partyAdmin1" });
    const partyAdmin2 = await h.createUser({ username: "partyAdmin2" });
    const otherUser = await h.createUser({ username: "otherUser" });
    const otherUser2 = await h.createUser({ username: "otherUser2" });
    const otherUser3 = await h.createUser({ username: "otherUser3" });
    const otherUser4 = await h.createUser({ username: "otherUser4" });
    const otherUser5 = await h.createUser({ username: "otherUser5" });
    const adminUser = await h.createUser({
      isAdmin: true,
      isSuperAdmin: true,
      adminRights: { manageUserProfiles: true },
    });
    const party = (
      await h.createParty(myUser, {
        name: "test",
        capacity: 10,
        privacyLevel: "closed",
      })
    ).body;
    await h.joinParty(party._id, partyAdmin1).expect(200);
    +(await h.joinParty(party._id, partyAdmin2).expect(200));
    await h.joinParty(party._id, otherUser).expect(200);
    await h
      .patchPartyGuest(myUser, partyAdmin1, party._id, {
        status: "attending",
      })
      .expect(200);
    await h.joinParty(party._id, otherUser2).expect(200);
    await h.joinParty(party._id, otherUser3).expect(200);
    await h
      .createPartyAdmin(myUser, party._id, partyAdmin1, {
        rights: {
          canManageParty: false,
          canManageGuestlist: true,
          canManagePartyPhotos: false,
          canBroadcastMessages: false,
          canSeeAdminHistory: false,
        },
      })
      .expect(200);

    await h
      .patchPartyGuest(partyAdmin1, otherUser2, party._id, {
        status: "attending",
      })
      .expect(200);
    await h
      .patchPartyGuest(partyAdmin1, partyAdmin2, party._id, {
        status: "attending",
      })
      .expect(200);

    await h
      .createPartyAdmin(myUser, party._id, partyAdmin2, {
        rights: {
          canManageParty: false,
          canManageGuestlist: true,
          canManagePartyPhotos: false,
          canBroadcastMessages: false,
          canSeeAdminHistory: false,
        },
      })
      .expect(200);
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "deletedPostByAdmin")
    ).to.have.a.lengthOf(2);
  });
  it("165 Wenn einem Administrator Rechte zugeteilt oder entzogen werden, wird eine Benachrichtigung versandt an: Benutzer der als Administrator hinzugefügt wurde (Notification 05.09)., alle anderen Administratoren der Party (Notification 05.09).", async function () {
    await Activiy.MODEL.deleteMany();
    const myUser = await h.createUser({
      username: "myUser",
      isPartyKing: true,
    });
    const partyAdmin1 = await h.createUser({ username: "partyAdmin1" });
    const partyAdmin2 = await h.createUser({ username: "partyAdmin2" });
    const party = (
      await h.createParty(myUser, {
        name: "test",
        capacity: 10,
        privacyLevel: "closed",
      })
    ).body;
    await h.joinParty(party._id, partyAdmin1).expect(200);
    await h.joinParty(party._id, partyAdmin2).expect(200);

    await h.patchPartyGuest(myUser, partyAdmin1, party._id, {
      status: "attending",
    });
    await h.patchPartyGuest(myUser, partyAdmin2, party._id, {
      status: "attending",
    });

    await h.createPartyAdmin(myUser, party._id, partyAdmin1).expect(200);
    await h.createPartyAdmin(myUser, party._id, partyAdmin2).expect(200);

    const newRights = {
      canManageParty: false,
      canManageGuestlist: true,
      canManagePartyPhotos: false,
      canBroadcastMessages: false,
      canSeeAdminHistory: false,
    };
    await h
      .patchPartyAdmin(myUser, party._id, partyAdmin1, {
        rights: newRights,
      })
      .expect(200);

    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "editedPartyAdminRights")
    ).to.have.a.lengthOf(2);
  });
  it("165 Wenn ein Administrator Gäste für die Gästeliste freigibt oder diese entfernt, erhält der Veranstalter eine Benachrichtigung, welcher Administrator welchen Gast für welche Party freigegeben oder entfernt hat (Notification 05.01).", async function () {
    await Activiy.MODEL.deleteMany();
    await User.MODEL.deleteMany();
    const myUser = await h.createUser({
      username: "myUser",
      isPartyKing: true,
    });
    const otherUser = await h.createUser({
      username: "otherUser",
    });
    const partyAdmin1 = await h.createUser({ username: "partyAdmin1" });
    const party = (
      await h.createParty(myUser, {
        name: "test",
        capacity: 10,
        privacyLevel: "closed",
      })
    ).body;
    await h.joinParty(party._id, partyAdmin1).expect(200);
    await h.joinParty(party._id, otherUser).expect(200);

    await h.patchPartyGuest(myUser, partyAdmin1, party._id, {
      status: "attending",
    });

    await h.createPartyAdmin(myUser, party._id, partyAdmin1).expect(200);

    await h.patchPartyGuest(partyAdmin1, otherUser, party._id, {
      status: "attending",
    });
    await h.patchPartyGuest(partyAdmin1, otherUser, party._id, {
      status: "declined",
    });

    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "partyGuestAcceptedByPartyAdmin")
    ).to.have.a.lengthOf(1);
    expect(
      activities.filter((a) => a.type === "partyGuestRemovedByPartyAdmin")
    ).to.have.a.lengthOf(1);
  });
  it("170 Wenn Änderungen durch den Profilbesitzer an den Stammdaten des Profils vorgenommen wurden (z.B. Profilbild, Über-Mich Text geändert, Name geändert etc.), so wird eine Benachrichtigung versandt an: Benutzer die mit dem Profilinhaber befreundet sind (Notification 05.02), Benutzer die dem Profilinhaber folgen (Notification 05.03)", async function () {
    await Activiy.MODEL.deleteMany();
    await User.MODEL.deleteMany();
    const myUser = await h.createUser({
      username: "myUser",
    });
    const otherUser = await h.createUser({
      username: "otherUser",
    });
    const otherUser2 = await h.createUser({
      username: "otherUser2",
    });
    await h.sendFriendRequest(myUser, otherUser);
    await h.acceptFriendRequest(otherUser, myUser);

    await h.followUser(myUser, otherUser2);

    const pic = await h.uploadProfilePic(otherUser);
    await h.setProfilePicture(otherUser, pic).expect(200);
    const pic2 = await h.uploadProfilePic(otherUser2);
    await h.setProfilePicture(otherUser2, pic2).expect(200);

    await h.patchUser(otherUser, otherUser, { description: "blub" });
    await h.patchUser(otherUser2, otherUser2, { description: "blub" });

    await h.patchUser(otherUser, otherUser, { username: "blub" });
    await h.patchUser(otherUser2, otherUser2, { username: "blub2" });
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "userHasChangedHisProfilePicture")
    ).to.have.a.lengthOf(2);

    expect(
      activities.filter((a) => a.type === "userHasChangedHisProfileDescription")
    ).to.have.a.lengthOf(2);
    expect(
      activities.filter((a) => a.type === "userHasChangedHisUsername")
    ).to.have.a.lengthOf(2);
  });
  it("301 Am Ende des Partywettbewerbs wird eine Notification an die Benutzer auf der Gästeliste und den Veranstalter versandt, welchen Platz die Party im Wettbewerb belegt hat.", async function () {
    await Activiy.MODEL.deleteMany();
    await User.MODEL.deleteMany();
    const myUser = await h.createUser({
      username: "myUser",
    });
    const myUser2 = await h.createUser({
      username: "myUser2",
    });
    const otherUser = await h.createUser({
      username: "otherUser",
      verification: { verified: true },
    });
    const otherUser2 = await h.createUser({
      username: "otherUser2",
      verification: { verified: true },
    });
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });
    const startDate = new Date();
    const endDate = new Date();
    endDate.setHours(endDate.getHours() + 2);
    const party = (
      await h.createParty(myUser, {
        name: "PARTY1",
        capacity: 10,
        privacyLevel: "open",
        startDate,
        endDate,
      })
    ).body;
    const party2 = (
      await h.createParty(myUser2, {
        name: "PARTY2",
        capacity: 10,
        privacyLevel: "open",
        startDate,
        endDate,
      })
    ).body;
    await h.joinParty(party2._id, otherUser).expect(200);
    await h.joinParty(party2._id, otherUser2).expect(200);

    const competition = (
      await h
        .createCompetition(adminUser, {
          name: "Competition 1",
          startDate,
          endDate,
        })
        .expect(200)
    ).body;
    await h.joinCompetition(myUser, party._id, competition._id);
    await h.joinCompetition(myUser2, party2._id, competition._id);

    await h.patchPartyGuest(myUser2, otherUser, party2._id, { onSite: "yes" });
    await h.patchPartyGuest(myUser2, otherUser2, party2._id, { onSite: "yes" });
    console.log(competition);
    await Competition.closeCompetition(competition);
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "competitionClosedPartyRanked")
    ).to.have.a.lengthOf(4);
  });
  it("301 Es wird eine Notification an die Benutzer die sich die Party gemerkt haben, die Benutzer auf der Gästeliste und den Veranstalter versandt, 2 Stunden vor dem Auswertungszeitpunkt des Wettbewerbs, mit dem Hinweis, dass der Wettbewerb zu diesem Zeitpunkt ausgewertet wird und nur die Anwesenheit vor Ort zählt, der Benutzer soll daher rechtzeitig auf der Party sein.", async function () {
    await Activiy.MODEL.deleteMany();
    await User.MODEL.deleteMany();
    const myUser = await h.createUser({
      username: "myUser",
    });
    const myUser2 = await h.createUser({
      username: "myUser2",
    });
    const otherUser = await h.createUser({
      username: "otherUser",
      verification: { verified: true },
    });
    const otherUser2 = await h.createUser({
      username: "otherUser2",
      verification: { verified: true },
    });
    const otherUser3 = await h.createUser({
      username: "otherUser3",
      verification: { verified: true },
    });
    const adminUser = await h.createUser({ isAdmin: true, isSuperAdmin: true });
    const startDate = new Date();
    const endDate = new Date();
    endDate.setHours(endDate.getHours() + 2);
    const party = (
      await h.createParty(myUser, {
        name: "PARTY1",
        capacity: 10,
        privacyLevel: "open",
        startDate,
        endDate,
      })
    ).body;
    const party2 = (
      await h.createParty(myUser2, {
        name: "PARTY2",
        capacity: 10,
        privacyLevel: "open",
        startDate,
        endDate,
      })
    ).body;
    await h.joinParty(party2._id, otherUser).expect(200);
    await h.joinParty(party2._id, otherUser2).expect(200);

    await h.bookmarkParty(party._id, otherUser3);
    const competition = (
      await h
        .createCompetition(adminUser, {
          name: "Competition 1",
          startDate,
          endDate,
        })
        .expect(200)
    ).body;
    await h.joinCompetition(myUser, party._id, competition._id);
    await h.joinCompetition(myUser2, party2._id, competition._id);

    await h.patchPartyGuest(myUser2, otherUser, party2._id, { onSite: "yes" });
    await h.patchPartyGuest(myUser2, otherUser2, party2._id, { onSite: "yes" });
    console.log(competition);
    await Competition.sendOnSiteReminder(competition);
    // check that competitionOnSiteReminder flag was set
    await Competition.sendOnSiteReminder(
      await Competition.get(competition._id)
    );
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "competitionOnSiteReminder")
    ).to.have.a.lengthOf(5);
  });
  it("139 Wenn bei geschlossenen Partys der letzte Gästelistenplatz vergeben wurde, erhalten alle Benutzer die noch nicht akzeptiert wurden und noch auf der Warteliste stehen eine Notification, dass die Gästeliste der Party voll ist, Sie aber weiterhin auf der Warteliste stehen und noch zur Gästeliste hinzugefügt werden können, wenn ein anderer Gast absagt. An : Benutzer der sich zu einer geschlossenen Party angemeldet hat und noch nicht freigegeben wurde - Warteliste (Notification 05.01)", async function () {
    await Activiy.MODEL.deleteMany();
    await User.MODEL.deleteMany();
    const myUser = await h.createUser({
      username: "myUser",
    });
    const otherUser = await h.createUser({
      username: "otherUser",
      verification: { verified: true },
    });
    const otherUser2 = await h.createUser({
      username: "otherUser2",
      verification: { verified: true },
    });
    const otherUser3 = await h.createUser({
      username: "otherUser3",
      verification: { verified: true },
    });

    const party = (
      await h.createParty(myUser, {
        name: "PARTY1",
        capacity: 1,
        privacyLevel: "closed",
      })
    ).body;
    await h.joinParty(party._id, otherUser).expect(200);
    await h.joinParty(party._id, otherUser2).expect(200);
    await h.joinParty(party._id, otherUser3).expect(200);

    await h.patchPartyGuest(myUser, otherUser, party._id, {
      status: "attending",
    });

    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "guestListIsFullClosedParty")
    ).to.have.a.lengthOf(2);
  });
  it("158 Notification einmal innerhalb von 24 Stunden (einstellbar im Backend) das xx neue Anmeldungen auf die Party sind versenden an: Gäste der Party (Notification 05.01)", async function () {
    await Activiy.MODEL.deleteMany();
    await User.MODEL.deleteMany();
    await PartyGuest.MODEL.deleteMany();
    await Party.MODEL.deleteMany();
    const myUser = await h.createUser({
      username: "myUser",
    });
    const otherUser = await h.createUser({
      username: "otherUser",
    });
    const otherUser2 = await h.createUser({
      username: "otherUser2",
    });
    const otherUser3 = await h.createUser({
      username: "otherUser3",
    });
    const otherUser4 = await h.createUser({
      username: "otherUser4",
    });

    const party = (
      await h.createParty(myUser, {
        name: "PARTY1",
        capacity: 100,
        privacyLevel: "open",
      })
    ).body;

    await h.joinParty(party._id, otherUser).expect(200);
    await h.joinParty(party._id, otherUser2).expect(200);

    await PartyGuest.sendNewPartyGuestsNotificationToPartyGuests();
    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "newPartyGuests")
    ).to.have.a.lengthOf(2);

    await h.joinParty(party._id, otherUser3).expect(200);

    activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "newPartyGuests")
    ).to.have.a.lengthOf(2);

    await PartyGuest.sendNewPartyGuestsNotificationToPartyGuests();
    activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "newPartyGuests")
    ).to.have.a.lengthOf(5);

    await PartyGuest.sendNewPartyGuestsNotificationToPartyGuests();
    activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "newPartyGuests")
    ).to.have.a.lengthOf(5);

    const party2 = (
      await h.createParty(myUser, {
        name: "PARTY2",
        capacity: 100,
        privacyLevel: "closed",
      })
    ).body;
    await h.joinParty(party2._id, otherUser).expect(200);
    await h.joinParty(party2._id, otherUser2).expect(200);
    await h.patchPartyGuest(myUser, otherUser, party2._id, {
      status: "attending",
    });
    await h.patchPartyGuest(myUser, otherUser2, party2._id, {
      status: "attending",
    });

    await PartyGuest.sendNewPartyGuestsNotificationToPartyGuests();
    await PartyGuest.sendNewPartyGuestsNotificationToPartyGuests();
    await PartyGuest.sendNewPartyGuestsNotificationToPartyGuests();
    activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "newPartyGuests")
    ).to.have.a.lengthOf(5);
  });
  it("211 Wurde der Account eines Benutzer entsperrt, erhält der Benutzer eine Notification, dass sein Account vom Startdatum bis Enddatum gesperrt war und nun wieder freigeschaltet wurde. Er wird auf die Einhaltung der AGB hingewiesen und die AGB werden in der Notification verlinkt.", async function () {
    await Activiy.MODEL.deleteMany();
    await User.MODEL.deleteMany();
    await PartyGuest.MODEL.deleteMany();
    await Party.MODEL.deleteMany();
    await Restriction.MODEL.deleteMany({});
    const myUser = await h.createUser({
      username: "myUser",
      languageSetting: "en",
    });
    const adminUser = await h.createUser({
      username: "adminUser",
      isAdmin: true,
      isSuperAdmin: true,
    });

    await h.muteUser(adminUser, myUser, ["login"]);
    const [restriction] = await Restriction.MODEL.find({});
    console.log(restriction);
    await h.unmuteUser(adminUser, myUser, [restriction._id]);

    let activities = await Activiy.MODEL.find({});
    expect(
      activities.filter((a) => a.type === "restrictionRemoved_login")
    ).to.have.a.lengthOf(1);
  });
});

after(async function () {
  if (process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});
