const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.ImageMentionsSchema = {
  POST: Joi.object().keys({
    location: Joi.object().keys({
      xPercent: Joi.number().min(0).max(100),
      yPercent: Joi.number().min(0).max(100),
    }),
  }),
};
