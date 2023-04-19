const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.NewsletterSchema = {
  PATCH: Joi.object()
    .required()
    .keys({
      title: Joi.string(),
      content: Joi.string(),
      upload: Joi.string(),
      audience: Joi.string().valid("all_users", "new_users", "existing_users"),
      isDraft: Joi.boolean(),
      isEdited: Joi.boolean(),
    }),
  POST: Joi.object()
    .required()
    .keys({
      title: Joi.string(),
      content: Joi.string(),
      audience: Joi.string()
        .valid("all_users", "new_users", "existing_users")
        .required(),
      isDraft: Joi.boolean(),
      isEdited: Joi.boolean(),
      upload: Joi.string(),
    }),
};
