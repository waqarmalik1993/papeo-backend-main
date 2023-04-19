const request = require("supertest");
const app = require("../../app.js").app;
const mongoose = require("mongoose");
const faker = require("faker");
const {
  getPartyGuests,
  getMyBookmarks,
  bookmarkParty,
  joinParty,
  rateParty,
  patchRating,
  createParty,
  createUser,
  deleteBookmark,
  getRatings,
  wipeDatabaseAndEmptyS3Bucket,
  deleteParty,
  deletePartyAdmin,
  checkForSensitiveData,
  uploadProfilePic,
  setProfilePicture,
  uploadPartyHeader,
  uploadFilesToParty,
  createPartyAdmin,
  createPost,
  createPostComment,
  uploadPartyPic,
} = require("./helpers.js");
const { parties } = require("./data/parties");
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
describe.skip("SEEDING", function () {
  this.timeout(10000000000);
  before(async () => {
    await startServer();
    //await wipeDatabaseAndEmptyS3Bucket();
    //setDisableFirebase(true);
  });
  it("seeding", async () => {
    for (const partyName of parties) {
      console.log(partyName);
      const owner = await seedUser();
      const party = await seedParty(owner, { name: partyName });

      const [u1, u2, u3, u4, u5] = await Promise.all([
        seedUser(),
        seedUser(),
        seedUser(),
        seedUser(),
        seedUser(),
      ]);
      // Partyguests
      await Promise.all([
        joinParty(party._id, u1),
        joinParty(party._id, u2),
        joinParty(party._id, u3),
        joinParty(party._id, u4),
        joinParty(party._id, u5),
      ]);
      const rights = {
        canManageParty: true,
        canManageGuestlist: true,
        canManagePartyPhotos: true,
        canBroadcastMessages: true,
        canSeeAdminHistory: true,
      };
      await createPartyAdmin(owner, party._id, u1, { rights });
      await createPartyAdmin(owner, party._id, u2, { rights });

      // Ratings
      await Promise.all([
        rateParty(party._id, u1, 5),
        rateParty(party._id, u2, 1),
        rateParty(party._id, u3, 3),
        rateParty(party._id, u4, 4),
        rateParty(party._id, u5, 5),
      ]);
      const files = await Promise.all([
        uploadPartyPic(u4),
        uploadPartyPic(u4),
        uploadPartyPic(u4),
      ]);
      const post = (
        await createPost(u4, party._id, faker.lorem.words(20), files)
      ).body;
      await createPostComment(u5, post._id, faker.lorem.words(10));
    }
  });
});
after(async () => {
  if(process.env.TEST_WATCH_MODE === "TRUE") return;
  setTimeout(() => {
    process.exit(1);
  }, 50);
});

const seedUser = async () => {
  const user = await createUser();
  const pic = await uploadProfilePic(user);
  const res = await setProfilePicture(user, pic).expect(200);
  return user;
};
const seedParty = async (owner, partyData) => {
  const header = await uploadPartyHeader(owner);
  const party = (await createParty(owner, partyData).expect(200)).body;
  const res = await uploadFilesToParty(owner, party._id, [header]).expect(200);
  return party;
};
