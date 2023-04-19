const Joi = require("joi");
const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const MONGO_IDS_COMMA_SEPARATED__REGEX = /^([0-9a-fA-F]{24},)+[0-9a-fA-F]{24}$/;
exports.FeedSchema = {
  POST: Joi.object().keys({
    exclude: Joi.array().items(Joi.string().pattern(MONGO_ID_REGEX)),
  }),
  unauthenticated: {
    POST: Joi.object().keys({
      exclude: Joi.array().items(Joi.string().pattern(MONGO_ID_REGEX)),
    }),
    POST_QUERY: Joi.object().keys({
      lat: Joi.number().precision(8).min(-180).max(180).required(), // long
      long: Joi.number().precision(8).min(-90).max(90).required(), // lat
    }),
  },
};
