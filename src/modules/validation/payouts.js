const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.PayoutsSchema = {
  PATCH: Joi.object()
    .required()
    .keys({
      status: Joi.string().valid("pending", "enabled", "paid", "rejected"),
    }),
  POST: Joi.object().required().keys({
    email: Joi.string().email().required(),
    amount: Joi.number().min(500).required(),
    comment: Joi.string(),
  }),
};
