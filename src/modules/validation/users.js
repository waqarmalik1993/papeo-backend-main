const Joi = require("joi");
const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;

exports.UserSchema = {
  PATCH: Joi.object().keys({
    // email: Joi.string().email(), // email muss verified werden
    firstName: Joi.string().min(1).max(40),
    lastName: Joi.string().min(1).max(40),
    fullName: Joi.string().min(3).max(40),
    languageSetting: Joi.string().valid("de", "en", "fr", "es", "it"),
    username: Joi.string()
      .min(3)
      .max(40)
      .pattern(/^[a-z0-9 ,.'-_]+$/i)
      .trim(),
    // phoneNumber: Joi.string(), // phoneNumber muss verified werden
    // authPlatforms: Joi.string().valid("local", "apple", "google"),
    sex: Joi.string().valid("male", "female", "diverse"),
    referredBy: Joi.string(),
    homeLocation: Joi.object({
      type: Joi.string().valid("Point"),
      coordinates: Joi.array().items(
        Joi.number().precision(8).min(-180).max(180).required(), // long
        Joi.number().precision(8).min(-90).max(90).required() // lat
      ),
    }),
    currentLocation: Joi.object({
      type: Joi.string().valid("Point"),
      coordinates: Joi.array().items(
        Joi.number().precision(8).min(-180).max(180).required(), // long
        Joi.number().precision(8).min(-90).max(90).required() // lat
      ),
    }),
    description: Joi.string().max(4000),
    city: Joi.string(),
    profileTags: Joi.array().items(Joi.string()),
    birthday: Joi.date().iso(),
    isArtist: Joi.boolean(),
    artistDescription: Joi.string(),
    billingAddress: Joi.object().keys({
      firstName: Joi.string(),
      lastName: Joi.string(),
      companyName: Joi.string(),
      lat: Joi.number(),
      long: Joi.number(),
      street: Joi.string(),
      houseNumber: Joi.string(),
      city: Joi.string(),
      postCode: Joi.string(),
      country: Joi.string(),
    }),
  }),
  PATCH_phonenumber: Joi.object().keys({
    // email: Joi.string().email(), // email muss verified werden
    phoneNumber: Joi.string().required(),
  }),
  localAuthentication: {
    POST: Joi.object().keys({
      type: Joi.string().required().valid("local"),
      countryCode: Joi.string().required(),
      channel: Joi.string().valid("call", "sms").required(),
      phoneNumber: Joi.string().required(),
      referredBy: Joi.string().allow(null),
      platform: Joi.string().valid("ios", "android", "web"),
    }),
  },
  appleAuthentication: {
    POST: Joi.object().keys({
      type: Joi.string().required().valid("apple"),
      countryCode: Joi.string().required(),
      platform: Joi.string().valid("ios", "android", "web"),
      fcmToken: Joi.string().allow(null),
      email: Joi.string().email(),
      token: Joi.string().required(),
      referredBy: Joi.string().allow(null),
    }),
  },
  googleAuthentication: {
    POST: Joi.object().keys({
      type: Joi.string().required().valid("google"),
      countryCode: Joi.string().required(),
      platform: Joi.string().valid("ios", "android", "web"),
      fcmToken: Joi.string().allow(null),
      email: Joi.string().email(),
      token: Joi.string().required(),
      referredBy: Joi.string().allow(null),
    }),
  },
  localAuthenticationVerification: {
    POST: Joi.object().keys({
      type: Joi.string().required().valid("local"),
      countryCode: Joi.string().required(),
      channel: Joi.string().valid("call", "sms", "email").required(),
      phoneNumber: Joi.string().required(),
      verificationCode: Joi.string().required(),
      platform: Joi.string().valid("ios", "android", "web"),
      fcmToken: Joi.string().allow(null),
      referredBy: Joi.string().allow(null),
    }),
  },
  availableValidation: {
    username: Joi.object().keys({
      username: Joi.string()
        .min(3)
        .max(40)
        .pattern(/^[a-z0-9 ,.'-_]+$/i)
        .trim(),
      type: Joi.string().required(),
    }),
    email: Joi.object().keys({
      email: Joi.string().email().required(),
      type: Joi.string().required(),
    }),
    phoneNumber: Joi.object().keys({
      phoneNumber: Joi.string().required(),
      type: Joi.string().required(),
    }),
  },
  verifyValidation: {
    email: Joi.object().keys({
      email: Joi.string().email().required(),
      type: Joi.string().required(),
      verificationCode: Joi.number(),
    }),
    phoneNumber: Joi.object().keys({
      phoneNumber: Joi.string().required(),
      countryCode: Joi.string().required(),
      type: Joi.string().required(),
      verificationCode: Joi.number(),
      platform: Joi.string().valid("ios", "android", "web"),
    }),
  },
  search: Joi.object().keys({
    distance_from: Joi.number().min(0).max(200),
    distance_to: Joi.number()
      .min(0)
      .max(200)
      .when("distance_from", {
        is: Joi.exist(),
        then: Joi.number().min(0).max(200).greater(Joi.ref("distance_from")),
      }),
    long: Joi.number().precision(8).min(-180).max(180), // long
    lat: Joi.number().precision(8).min(-90).max(90), // lat
    sex: Joi.array().items(
      Joi.string().valid("male", "female", "other", "diverse")
    ),
    include: Joi.array().items(
      Joi.string().valid(
        "following",
        "following_me",
        "friends",
        "authenticated_users",
        "party_king_members",
        "artists"
      )
    ),
    age_from: Joi.number().min(16).max(99),
    age_to: Joi.number().min(16).max(99),
    skip: Joi.number().min(0),
    limit: Joi.number().min(0),
    last_activity_at: Joi.date().less("now"),
    text_search: Joi.string(),
  }),
  adminSearch: Joi.object().keys({
    distance_from: Joi.number().min(0).max(200),
    distance_to: Joi.number()
      .min(0)
      .max(200)
      .when("distance_from", {
        is: Joi.exist(),
        then: Joi.number().min(0).max(200).greater(Joi.ref("distance_from")),
      }),
    long: Joi.number().precision(8).min(-180).max(180), // long
    lat: Joi.number().precision(8).min(-90).max(90), // lat
    sex: Joi.array().items(
      Joi.string().valid("male", "female", "other", "diverse")
    ),
    include: Joi.array().items(
      Joi.string().valid(
        "following",
        "following_me",
        "friends",
        "authenticated_users",
        "party_king_members",
        "artists",
        "locked",
        "muted"
      )
    ),
    age_from: Joi.number().min(16).max(99),
    age_to: Joi.number().min(16).max(99),
    skip: Joi.number().min(0),
    limit: Joi.number().min(0),
    last_activity_at: Joi.date().less("now"),
    text_search: Joi.string(),
  }),
  settings: {
    UPDATE: Joi.object().keys({
      notifications: Joi.object()
        .keys({
          parties: Joi.object()
            .keys({
              push: Joi.boolean().required(),
              email: Joi.boolean().required(),
            })
            .required(),
          friends: Joi.object()
            .keys({
              push: Joi.boolean().required(),
              email: Joi.boolean().required(),
            })
            .required(),
          following: Joi.object()
            .keys({
              push: Joi.boolean().required(),
              email: Joi.boolean().required(),
            })
            .required(),
          followers: Joi.object()
            .keys({
              push: Joi.boolean().required(),
              email: Joi.boolean().required(),
            })
            .required(),
          sharedContent: Joi.object()
            .keys({
              push: Joi.boolean().required(),
              email: Joi.boolean().required(),
            })
            .required(),
          comments: Joi.object()
            .keys({
              push: Joi.boolean().required(),
              email: Joi.boolean().required(),
            })
            .required(),
          myProfileActivity: Joi.object()
            .keys({
              push: Joi.boolean().required(),
              email: Joi.boolean().required(),
            })
            .required(),
          membership: Joi.object()
            .keys({
              push: Joi.boolean().required(),
              email: Joi.boolean().required(),
            })
            .required(),
          referringTransactions: Joi.object().keys({
            push: Joi.boolean().required(),
            email: Joi.boolean().required(),
          }),
          other: Joi.object()
            .keys({
              push: Joi.boolean().required(),
              email: Joi.boolean().required(),
            })
            .required(),
        })
        .required(),
      invitations: Joi.object()
        .keys({
          following: Joi.boolean().required(),
          followers: Joi.boolean().required(),
          partyFriends: Joi.boolean(),
          others: Joi.boolean().required(),
          distanceFrom: Joi.number().min(0).max(200).required(),
          distanceTo: Joi.number().min(0).max(200).required(),
        })
        .required(),
      allowAdminLogin: Joi.boolean(),
    }),
  },
  verification: {
    POST: Joi.object()
      .keys({
        vote: Joi.boolean().required(),
      })
      .required(),
    search: Joi.object().keys({
      exclude: Joi.array().items(Joi.string().pattern(MONGO_ID_REGEX)),
      firstUser: Joi.string().pattern(MONGO_ID_REGEX),
    }),
    PATCH: Joi.object().keys({
      deactivated: Joi.boolean().required(),
    }),
  },
  listArtists: Joi.object().keys({
    $skip: Joi.number(),
    $limit: Joi.number(),
    text_search: Joi.string(),
  }),
  putProfileBanner: Joi.object().keys({
    upload: Joi.string().regex(MONGO_ID_REGEX).allow(null),
    description: Joi.string().allow(null),
    backgroundInfo: Joi.object()
      .required()
      .keys({
        hexColor: Joi.string().allow(null),
        colorSliderPosition: Joi.number().allow(null),
        shadeSliderPosition: Joi.number().allow(null),
        useBackgroundColor: Joi.boolean().allow(null),
      }),
    fontInfo: Joi.object()
      .required()
      .keys({
        hexColor: Joi.string().allow(null),
        colorSliderPosition: Joi.number().allow(null),
        shadeSliderPosition: Joi.number().allow(null),
        font: Joi.string().allow(null),
        useFontColor: Joi.boolean().allow(null),
      }),
    sliderWidth: Joi.number().allow(null),
    hideName: Joi.boolean().allow(null),
    hideGender: Joi.boolean().allow(null),
    hideAge: Joi.boolean().allow(null),
  }),
};
