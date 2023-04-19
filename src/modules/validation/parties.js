const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.PartySchema = {
  POST: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string().max(4000),
    tags: Joi.array().items(Joi.string()),
    status: Joi.string().valid("draft", "ready_for_review", "published"),
    type: Joi.string().valid("private", "commercial"),
    privacyLevel: Joi.string().valid("closed", "open", "secret"),
    placeId: Joi.string(),
    location: Joi.object({
      type: Joi.string().valid("Point"),
      coordinates: Joi.array().items(
        Joi.number().precision(8).min(-180).max(180).required(), // long
        Joi.number().precision(8).min(-90).max(90).required() // lat
      ),
    }),
    ticketingSettings: Joi.object().keys({
      allowExternalSharing: Joi.boolean().required(),
      allowInternalSharing: Joi.boolean().required(),
      limitTicketPurchasesPerUser: Joi.boolean().required(),
      ticketPurchasesPerUser: Joi.number(),
      guestlistPurchaseOnly: Joi.boolean().required(),
      boxOffice: Joi.boolean().required(),
    }),
    entranceFeeText: Joi.string().max(4000),
    capacity: Joi.number().integer().min(1),
    informationForAcceptedGuests: Joi.string().max(4000),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref("startDate")),
    menuCard: Joi.string().regex(MONGO_ID_REGEX).allow(null),
  }),
  PATCH: Joi.object()
    .required()
    .keys({
      name: Joi.string(),
      description: Joi.string().max(4000),
      tags: Joi.array().items(Joi.string()),
      status: Joi.string().valid("draft", "ready_for_review", "published"),
      type: Joi.string().valid("private", "commercial"),
      privacyLevel: Joi.string().valid("closed", "open", "secret"),
      placeId: Joi.string(),
      location: Joi.object({
        type: Joi.string().valid("Point"),
        coordinates: Joi.array().items(
          Joi.number().precision(8).min(-180).max(180).required(), // long
          Joi.number().precision(8).min(-90).max(90).required() // lat
        ),
      }),
      entranceFeeText: Joi.string().max(4000),
      ticketingSettings: Joi.object().keys({
        allowExternalSharing: Joi.boolean().required(),
        allowInternalSharing: Joi.boolean().required(),
        limitTicketPurchasesPerUser: Joi.boolean().required(),
        ticketPurchasesPerUser: Joi.number(),
        guestlistPurchaseOnly: Joi.boolean().required(),
        boxOffice: Joi.boolean().required(),
      }),
      capacity: Joi.number().integer().min(1),
      informationForAcceptedGuests: Joi.string().max(4000),
      startDate: Joi.date().iso(),
      endDate: Joi.date().iso().greater(Joi.ref("startDate")),
      menuCard: Joi.string().regex(MONGO_ID_REGEX).allow(null),
    }),
  uploads: {
    POST: Joi.object().keys({
      file: Joi.string().regex(MONGO_ID_REGEX),
      thumbnail: Joi.string().regex(MONGO_ID_REGEX),
      mimetype: Joi.string(),
    }),
  },
  uploadOrder: Joi.array()
    .required()
    .unique()
    .items(Joi.string().regex(MONGO_ID_REGEX)),
  ratings: {
    POST: Joi.object().keys({
      value: Joi.number().integer().min(1).max(5).required(),
      comment: Joi.string(),
    }),
    PATCH: Joi.object().keys({
      value: Joi.number().integer().min(1).max(5),
      comment: Joi.string(),
    }),
    RATING: Joi.object().keys({
      party: Joi.string().regex(MONGO_ID_REGEX).required(),
      user: Joi.string().regex(MONGO_ID_REGEX).required(),
      value: Joi.number().integer().min(1).max(5).required(),
      comment: Joi.string(),
      partyOwner: Joi.string().regex(MONGO_ID_REGEX).required(),
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
    start_date: Joi.date(),
    guests: Joi.array().items(
      Joi.string().valid("following", "following_me", "friends")
    ),
    type: Joi.array().items(Joi.string().valid("private", "commercial")),
    privacy_level: Joi.array().items(
      Joi.string().valid("open", "closed", "secret")
    ),
    skip: Joi.number().min(0),
    limit: Joi.number().min(0),
    text_search: Joi.string(),
  }),
  onSiteCheck: Joi.object().keys({
    onSite: Joi.string().valid("yes", "no", "asked_owner").required(),
  }),
};
