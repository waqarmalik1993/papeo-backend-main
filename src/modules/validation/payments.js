const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.PaymentSchema = {
  CHECKOUT: Joi.object().keys({
    priceId: Joi.string().required(),
    urlParams: Joi.object().keys({
      success: Joi.string().required(),
      cancel: Joi.string().required(),

    })
  }),
  PORTAL: Joi.object().keys({
    urlParams: Joi.object().keys({
      return: Joi.string().required(),
    })
  }),
};
