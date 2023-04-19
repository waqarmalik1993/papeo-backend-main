const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.UploadsSchema = {
  profilePicture: Joi.object().keys({
    upload: Joi.string().regex(MONGO_ID_REGEX).required(),
  }),
  verification: Joi.object().keys({
    upload: Joi.string().regex(MONGO_ID_REGEX).required(),
  }),
  party: Joi.object().keys({
    uploads: Joi.array()
      .items(Joi.string().pattern(MONGO_ID_REGEX))
      .min(1)
      .unique()
      .required(),
  }),
  post: Joi.object().keys({
    uploads: Joi.array()
      .items(Joi.string().pattern(MONGO_ID_REGEX))
      .min(1)
      .unique()
      .required(),
    party: Joi.string().regex(MONGO_ID_REGEX),
    description: Joi.string().max(4000),
    location: Joi.object({
      type: Joi.string().valid("Point"),
      coordinates: Joi.array().items(
        Joi.number().precision(8).min(-180).max(180).required(), // long
        Joi.number().precision(8).min(-90).max(90).required() // lat
      ),
    }),
  }),
  message: Joi.object().keys({
    upload: Joi.string().regex(MONGO_ID_REGEX).required(),
    conversation: Joi.string().max(100).required(),
    message: Joi.string().max(100).required(),
  }),
  report: Joi.object()
    .keys({
      uploads: Joi.array()
        .items(Joi.string().pattern(MONGO_ID_REGEX))
        .min(1)
        .unique()
        .required(),
      reportedParty: Joi.string().regex(MONGO_ID_REGEX),
      reportedUser: Joi.string().regex(MONGO_ID_REGEX),
      reportedPost: Joi.string().regex(MONGO_ID_REGEX),
      reportedRating: Joi.string().regex(MONGO_ID_REGEX),
      reportedComment: Joi.string().regex(MONGO_ID_REGEX),
      comment: Joi.string().max(4000),
    })
    .or(
      "reportedParty",
      "reportedUser",
      "reportedPost",
      "reportedRating",
      "reportedComment"
    ),
};
