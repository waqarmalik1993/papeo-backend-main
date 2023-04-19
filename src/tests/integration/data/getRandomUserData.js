const faker = require("faker");
const mongoose = require("mongoose");
faker.locale = "de";
function generateNearbyReversedCoords() {
  const coords = faker.address
    .nearbyGPSCoordinate(["52.5411171", "13.3509304"])
    .map((c) => parseFloat(c));
  return [coords[1], coords[0]];
}
module.exports.generateNearbyReversedCoords = generateNearbyReversedCoords;
function generateNearbyCoords() {
  return generateNearbyReversedCoords();
}
module.exports.generateNearbyCoords = generateNearbyCoords;

module.exports.generateUser = (data) => {
  const birthday = new Date();
  birthday.setFullYear(
    birthday.getFullYear() - parseInt(Math.random(50) * 100 + 16)
  );
  return {
    _id: mongoose.Types.ObjectId(),
    email: faker.internet.email().toLowerCase(),
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    //fullName: faker.name.,
    username: faker.internet.userName().toLowerCase(),
    phoneNumber: faker.phone.phoneNumber(),
    locked: false,
    roles: ["user"],
    authPlatforms: [
      {
        method: "local",
        externalUserId: "srtghbdfxhndghzdf",
      },
    ],
    sex: Math.random() > 0.5 ? "male" : "female",
    homeLocation: {
      type: "Point",
      coordinates: this.generateNearbyReversedCoords(),
    },
    currentLocation: {
      type: "Point",
      coordinates: this.generateNearbyReversedCoords(),
    },
    obfuscatedHomeLocation: {
      type: "Point",
      coordinates: this.generateNearbyReversedCoords(),
    },
    description: faker.lorem.words(20),
    city: faker.address.city(),
    partyFriends: [],
    parties: [],
    profileTags: [],
    verification: {
      verified: false,
      upload: null,
      votes: [],
      voted: {
        votesAreCounted: false,
        correct: 0,
        incorrect: 0,
      },
    },

    tokens: [],
    firstLogin: true,
    firstLoginAt: faker.date.past(),
    lastLoginAt: faker.date.past(),
    birthday: birthday.toISOString(),
    failedLoginAttempts: 0,
    successfulLoginCount: 0,
    updatedAt: faker.date.past(),
    createdAt: faker.date.past(),
    settings: {
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
        referringTransactions: true,
      },
      invitations: {
        following: true,
        followers: true,
        partyFriends: true,
        others: true,
        distanceFrom: 0,
        distanceTo: 0,
      },
    },
    subscription: {
      isPartyKing: false,
      expiresDate: null,
      store: null,
    },
    rating: {
      avg: null,
      count: 0,
    },
    isPartyKing: false,
    isArtist: false,
    partyPoints: 1000,
    referralCodes: [],
    referredBy: null,
    artistDescription: null,
    blockedUsers: [],
    blockedByUsers: [],
    adminRights: {
      manageUserProfiles: false,
      manageUserLinks: false,
      muteUser: false,
      lockUser: false,
      advancedMemberSearch: false,
      deleteRating: false,
      deleteUserFinally: false,
      manageMedia: false,
      manageComments: false,
      manageParties: false,
      inviteGuestsToParties: false,
      managePartyPoints: false,
      manageMembership: false,
      editTranslation: false,
      changeTC: false,
      manageMainMenu: false,
      rateVideoIdent: false,
      manageViolationReports: false,
      viewStatistics: false,
      viewAdminLog: false,
      manageAdmins: false,
      canSeeSecretParties: false,
      loginAsUser: false,
      enablePayouts: false,
      payoutPayouts: false,
      editNewsletter: false,
      createNewsletter: false,
      createUserProfiles: false,
    },
    restrictions: {
      reportMedia: false,
      createParties: false,
      uploadMedia: false,
      commentMedia: false,
      participateInParties: false,
      login: false,
    },
    ...data,
  };
};
