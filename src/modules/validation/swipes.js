const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.SwipeSchema = {
  POST: Joi.alternatives().try(
    Joi.object().keys({
      swipedUser: Joi.string().regex(MONGO_ID_REGEX).required(),
      swipe: Joi.boolean().required(),
    }),
    Joi.object().keys({
      swipedParty: Joi.string().regex(MONGO_ID_REGEX).required(),
      swipe: Joi.boolean().required(),
    })
  ),
};
