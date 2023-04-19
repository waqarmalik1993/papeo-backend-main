const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.ShareSchema = {
  POST: Joi.object().keys({
    sharedParty: Joi.string().regex(MONGO_ID_REGEX),
    sharedPost: Joi.string().regex(MONGO_ID_REGEX),
    sharedUser: Joi.string().regex(MONGO_ID_REGEX),
    userIds: Joi.array().items(Joi.string().regex(MONGO_ID_REGEX).required()),
  }),
};
