// users-models.js - A mongoose models
//
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
const mongoose = require("mongoose");
// users-models.js - A mongoose models
//
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.

let { Schema } = mongoose;

module.exports = function () {
  const modelName = "users";
  const schema = new mongoose.Schema(
    {
      email: {
        type: String,
        lowercase: true,
        trim: true,
        default: null,
        sparse: true,
        select: false,
      },
      firstName: { type: String, default: null },
      lastName: { type: String, default: null },
      fullName: { type: String, default: null },
      username: {
        type: String,
        trim: true,
        default: null,
        sparse: true,
      },
      languageSetting: { type: String, default: null },
      // migration: db.users.update({},[{"$set": {"usernameLowercase": { $toLower: "$username"}}}], { multi: true })
      usernameLowercase: {
        type: String,
        trim: true,
        default: null,
        sparse: true,
      },
      stripeCustomerId: {
        type: String,
        default: null,
        select: false,
      },
      phoneNumber: {
        type: String,
        lowercase: true,
        trim: true,
        default: null,
        sparse: true,
        select: false,
      },
      locked: { type: Boolean, default: false },
      deletedAt: { type: Date, default: null },
      roles: { type: Array, default: ["user"] },
      authPlatforms: {
        type: [
          {
            method: {
              type: String,
              enum: ["local", "apple", "google"],
              default: null,
            },
            externalUserId: { type: String, default: null },
          },
        ],
        select: false,
      },
      sex: {
        type: String,
        enum: ["male", "female", "diverse", null],
        default: null,
      },
      homeLocation: {
        type: {
          type: String, // Don't do `{ location: { type: String } }`
          enum: ["Point"], // 'location.type' must be 'Point'
          default: "Point",
        },
        coordinates: {
          type: [],
          default: null,
          index: { type: "2dsphere", sparse: false },
          select: false,
        },
      },
      obfuscatedHomeLocation: {
        type: {
          type: String, // Don't do `{ location: { type: String } }`
          enum: ["Point"], // 'location.type' must be 'Point'
          default: "Point",
        },
        coordinates: {
          type: [],
          default: null,
          index: { type: "2dsphere", sparse: false },
        },
      },
      obfuscatedCurrentLocation: {
        type: {
          type: String, // Don't do `{ location: { type: String } }`
          enum: ["Point"], // 'location.type' must be 'Point'
          default: "Point",
        },
        coordinates: {
          type: [],
          default: null,
          index: { type: "2dsphere", sparse: false },
        },
      },
      homeAddress: {
        type: {
          street: { type: String, default: null },
          houseNumber: { type: String, default: null },
          city: { type: String, default: null },
          postcode: { type: String, default: null },
          country: { type: String, default: null },
        },
        select: false,
      },
      currentLocation: {
        type: {
          type: String, // Don't do `{ location: { type: String } }`
          enum: ["Point"], // 'location.type' must be 'Point'
          default: "Point",
        },
        coordinates: {
          type: [],
          default: null,
          index: { type: "2dsphere", sparse: false },
          select: false,
        },
      },
      description: {
        type: String,
      },
      artistDescription: {
        type: String,
        default: null,
      },
      city: {
        type: String,
        default: null,
      },
      attendedCompetitionParty: {
        type: Schema.Types.ObjectId,
        ref: "parties",
        default: null,
      },
      partyFriends: {
        type: [
          {
            friend: {
              type: Schema.Types.ObjectId,
              ref: "users",
            },
            status: {
              type: String,
              enum: ["requested", "accepted", "requested_by_me"],
              default: "requested_by_me",
            },
            timestamp: {
              type: Date,
              default: Date.now,
            },
          },
        ],
      },
      parties: [
        {
          type: Schema.Types.ObjectId,
          ref: "parties",
        },
      ],
      profileTags: [
        {
          type: String,
        },
      ],
      profilePicture: {
        type: Schema.Types.ObjectId,
        ref: "uploads",
        default: null,
      },
      verification: {
        verified: { type: Boolean, default: false },
        deactivated: { type: Boolean, default: false },
        upload: {
          type: Schema.Types.ObjectId,
          ref: "uploads",
          default: null,
        },
        votes: [
          {
            from: {
              type: Schema.Types.ObjectId,
              ref: "users",
            },
            outcome: { type: Boolean },
            isCounted: { type: Boolean },
          },
        ],
        voted: {
          votesAreCounted: { type: Boolean, default: false },
          correct: { type: Number, default: 0 },
          incorrect: { type: Number, default: 0 },
        },
        uploadTimestamp: {
          type: Date,
          default: null,
        },
      },
      settings: {
        type: {
          notifications: {
            parties: {
              push: { type: Boolean, default: true },
              email: { type: Boolean, default: false },
            },
            friends: {
              push: { type: Boolean, default: true },
              email: { type: Boolean, default: false },
            },
            following: {
              push: { type: Boolean, default: true },
              email: { type: Boolean, default: false },
            },
            followers: {
              push: { type: Boolean, default: true },
              email: { type: Boolean, default: false },
            },
            sharedContent: {
              push: { type: Boolean, default: true },
              email: { type: Boolean, default: false },
            },
            comments: {
              push: { type: Boolean, default: true },
              email: { type: Boolean, default: false },
            },
            myProfileActivity: {
              push: { type: Boolean, default: true },
              email: { type: Boolean, default: false },
            },
            membership: {
              push: { type: Boolean, default: true },
              email: { type: Boolean, default: false },
            },
            other: {
              push: { type: Boolean, default: true },
              email: { type: Boolean, default: false },
            },
            referringTransactions: { type: Boolean, default: true },
          },
          invitations: {
            following: { type: Boolean, default: true },
            followers: { type: Boolean, default: true },
            partyFriends: { type: Boolean, default: true },
            others: { type: Boolean, default: true },
            distanceFrom: { type: Number, default: 0 },
            distanceTo: { type: Number, default: 0 },
          },
          allowAdminLogin: { type: Boolean, default: false },
        },

        default: {
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
          allowAdminLogin: false,
        },
      },

      tokens: {
        type: [
          {
            accessToken: { type: String },
            fcmToken: { type: String, default: null },
            platform: { type: String, default: null },
          },
        ],
        select: false,
      },
      firstLogin: {
        type: Boolean,
        default: true,
      },
      firstLoginAt: {
        type: Date,
        default: null,
      },
      lastLoginAt: {
        type: Date,
        default: null,
      },
      lastActivityAt: {
        type: Date,
        default: null,
      },
      birthday: {
        type: Date,
        default: null,
      },
      failedLoginAttempts: {
        type: Number,
        default: 0,
      },
      successfulLoginCount: {
        type: Number,
        default: 0,
      },
      rating: {
        avg: {
          type: Number,
          default: null,
        },
        count: {
          type: Number,
          default: 0,
        },
      },
      subscription: {
        type: {
          isPartyKing: {
            type: Boolean,
            default: false,
          },
          expiresDate: {
            type: Date,
            default: null,
          },
          store: {
            type: String,
            default: null,
          },
        },
        select: false,
      },
      isPartyKing: {
        type: Boolean,
        default: false,
      },
      isArtist: {
        type: Boolean,
        default: false,
      },
      isArtistUpdatedDate: {
        type: Date,
        default: null,
      },
      partyPoints: {
        type: Number,
        default: 0,
        select: false,
      },
      createdByAdmin: {
        type: Boolean,
        default: false,
      },
      referredBy: {
        type: String,
        default: null,
      },
      referredByEditableUntil: {
        type: Date,
        default: null,
      },
      referralCodes: {
        type: [
          {
            code: String,
            createdAt: Date,
          },
        ],
        default: [],
      },
      blockedUsers: {
        type: [
          {
            type: Schema.Types.ObjectId,
            ref: "users",
          },
        ],
        select: false,
      },
      blockedByUsers: {
        type: [
          {
            type: Schema.Types.ObjectId,
            ref: "users",
          },
        ],
        select: false,
      },
      isAdmin: { type: Boolean, default: false },
      isSuperAdmin: { type: Boolean, default: false },
      adminRights: {
        type: {
          manageUserProfiles: { type: Boolean, default: false },
          manageUserLinks: { type: Boolean, default: false },
          muteUser: { type: Boolean, default: false },
          lockUser: { type: Boolean, default: false },
          advancedMemberSearch: { type: Boolean, default: false },
          deleteRating: { type: Boolean, default: false },
          deleteUserFinally: { type: Boolean, default: false },
          manageMedia: { type: Boolean, default: false },
          manageComments: { type: Boolean, default: false },
          manageParties: { type: Boolean, default: false },
          inviteGuestsToParties: { type: Boolean, default: false },
          managePartyPoints: { type: Boolean, default: false },
          manageMembership: { type: Boolean, default: false },
          editTranslation: { type: Boolean, default: false },
          changeTC: { type: Boolean, default: false },
          manageMainMenu: { type: Boolean, default: false },
          rateVideoIdent: { type: Boolean, default: false },
          manageViolationReports: { type: Boolean, default: false },
          viewStatistics: { type: Boolean, default: false },
          viewAdminLog: { type: Boolean, default: false },
          manageAdmins: { type: Boolean, default: false },
          canSeeSecretParties: { type: Boolean, default: false },
          loginAsUser: { type: Boolean, default: false },
          enablePayouts: { type: Boolean, default: false },
          payoutPayouts: { type: Boolean, default: false },
          editNewsletter: { type: Boolean, default: false },
          createNewsletter: { type: Boolean, default: false },
          createUserProfiles: { type: Boolean, default: false },
        },
        select: false,
      },
      restrictions: {
        type: {
          reportMedia: {
            type: Boolean,
            default: false,
          },
          createParties: {
            type: Boolean,
            default: false,
          },
          uploadMedia: {
            type: Boolean,
            default: false,
          },
          commentMedia: {
            type: Boolean,
            default: false,
          },
          participateInParties: {
            type: Boolean,
            default: false,
          },
          login: {
            type: Boolean,
            default: false,
          },
        },
        select: false,
      },
      reports: {
        total: {
          type: Number,
          default: 0,
        },
        approved: {
          type: Number,
          default: 0,
        },
        declined: {
          type: Number,
          default: 0,
        },
      },
      profileBanner: {
        type: {},
        default: null,
      },
      billingAddress: {
        type: {
          firstName: { type: String, default: null },
          lastName: { type: String, default: null },
          companyName: { type: String, default: null },
          lat: { type: Number, default: 0 },
          long: { type: Number, default: 0 },
          street: { type: String, default: null },
          houseNumber: { type: String, default: null },
          city: { type: String, default: null },
          postCode: { type: String, default: null },
          country: { type: String, default: null },
        },
        select: false,
      },
    },
    {
      timestamps: true,
    }
  );
  schema.index({ locked: 1 });
  schema.index({ lastActivityAt: 1 });
  schema.index({
    usernameLowercase: "text",
    description: "text",
    artistDescription: "text",
    city: "text",
    profileTags: "text",
  });
  // This is necessary to avoid models compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongoose.modelNames().includes(modelName)) {
    mongoose.deleteModel(modelName);
  }
  return mongoose.model(modelName, schema);
};
