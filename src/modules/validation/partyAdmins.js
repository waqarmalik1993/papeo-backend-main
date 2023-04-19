const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.PartyAdminSchema = {
  POST: Joi.object()
    .required()
    .keys({
      rights: Joi.object().required().keys({
        canManageParty: Joi.boolean().required(),
        canManageGuestlist: Joi.boolean().required(),
        canManagePartyPhotos: Joi.boolean().required(),
        canBroadcastMessages: Joi.boolean().required(),
        canSeeAdminHistory: Joi.boolean().required(),
      }),
    }),
  PATCH: Joi.object()
    .required()
    .keys({
      rights: Joi.object().required().keys({
        canManageParty: Joi.boolean(),
        canManageGuestlist: Joi.boolean(),
        canManagePartyPhotos: Joi.boolean(),
        canBroadcastMessages: Joi.boolean(),
        canSeeAdminHistory: Joi.boolean(),
      }),
    }),
  broadcastMessage: {
    POST: Joi.object()
      .required()
      .keys({
        message: Joi.string().required(),
        colorGroups: Joi.array()
          .required()
          .items(
            Joi.string().valid(
              "default",
              "primary",
              "yellow",
              "green",
              "blue",
              "purple",
              "pink"
            )
          ),
        filter: Joi.array().items(
          Joi.string().valid(
            "without_ticket",
            "with_ticket",
            "on_site",
            "all",
            "paid"
          )
        ),

        genders: Joi.array()
          .required()
          .items(Joi.string().valid("male", "female", "diverse")),
      }),
    cost_POST: Joi.object()
      .required()
      .keys({
        message: Joi.string(),
        colorGroups: Joi.array()
          .required()
          .items(
            Joi.string().valid(
              "default",
              "primary",
              "yellow",
              "green",
              "blue",
              "purple",
              "pink"
            )
          ),
        filter: Joi.array().items(
          Joi.string().valid(
            "without_ticket",
            "with_ticket",
            "on_site",
            "all",
            "paid"
          )
        ),
        genders: Joi.array()
          .required()
          .items(Joi.string().valid("male", "female", "diverse")),
      }),
  },
};
