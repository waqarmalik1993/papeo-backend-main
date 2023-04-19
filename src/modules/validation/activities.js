const Joi = require("joi");

exports.ActivitySchema = {
  FEED: Joi.object().keys({
    categories: Joi.array().items(Joi.string()),
  }),
  READ: Joi.object().keys({
    read: Joi.boolean().required()
  }),
};
