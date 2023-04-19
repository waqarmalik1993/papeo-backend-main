const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.MyPartyGuestsSchema = {
  PATCH: Joi.object().required().keys({
    isDeleted: Joi.boolean(),
  }),
  POST: Joi.object()
    .required()
    .keys({
      guest: Joi.string().regex(MONGO_ID_REGEX),
    }),
};
