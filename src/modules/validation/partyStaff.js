const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.PartyStaffSchema = {
  POST: Joi.array().items(
    Joi.object()
      .required()
      .keys({
        user: Joi.string().regex(MONGO_ID_REGEX).required(),
        responsibility: Joi.string().allow("").allow(null),
        rights: Joi.object().required().keys({
          canScanTickets: Joi.boolean().required(),
          canScanOrders: Joi.boolean().required(),
        }),
      })
  ),
  PATCH: Joi.object()
    .required()
    .keys({
      responsibility: Joi.string().allow("").allow(null),
      rights: Joi.object().keys({
        canScanTickets: Joi.boolean(),
        canScanOrders: Joi.boolean(),
      }),
    }),
  declineWork: Joi.object().required().keys({
    reason: Joi.string(),
  }),
};
