const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.MessagesSchema = {
  POST: Joi.object().keys({
    message: Joi.string().required(),
  }),
};
