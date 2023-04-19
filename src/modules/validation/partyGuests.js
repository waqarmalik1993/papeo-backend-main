const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.PartyGuestsSchema = {
  PATCH: Joi.object()
    .required()
    .keys({
      onSite: Joi.string().valid("yes", "no", "asked_owner"),
      hasPaid: Joi.boolean(),
      reminder: Joi.boolean(),
      isDeleted: Joi.boolean(),
      colorGroup: Joi.string().valid(
        "default",
        "primary",
        "yellow",
        "green",
        "blue",
        "purple",
        "pink"
      ),
      status: Joi.string().valid("attending", "declined"),
    }),
};
