const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.MenuCardsSchema = {
  POST: Joi.object()
    .required()
    .keys({
      name: Joi.string().allow("").allow(null).required(),
      info: Joi.string().allow("").allow(null).required(),
      cashPaymentAllowed: Joi.boolean().required(),
      ppPaymentAllowed: Joi.boolean().required(),
      isDraft: Joi.boolean().required(),
      ppPaymentLimited: Joi.boolean().required(),
      ppPaymentLimit: Joi.number(),
      categories: Joi.array()
        .items(
          Joi.object().keys({
            name: Joi.string().required(),
            description: Joi.string(),
            upload: Joi.string().regex(MONGO_ID_REGEX).allow(null),
            articles: Joi.array()
              .items(
                Joi.object().keys({
                  name: Joi.string().required(),
                  description: Joi.string(),
                  upload: Joi.string().regex(MONGO_ID_REGEX).allow(null),

                  pricePP: Joi.number(),
                  price: Joi.object().keys({
                    net: Joi.number().integer().min(0),
                    taxPerMille: Joi.number().integer().min(0),
                  }),
                })
              )
              .required(),
          })
        )
        .required(),
    }),
  PUT: Joi.object()
    .required()
    .keys({
      name: Joi.string().allow("").allow(null).required(),
      info: Joi.string().allow("").allow(null).required(),
      cashPaymentAllowed: Joi.boolean().required(),
      ppPaymentAllowed: Joi.boolean().required(),
      isDraft: Joi.boolean().required(),
      ppPaymentLimit: Joi.number(),
      ppPaymentLimited: Joi.boolean().required(),
      categories: Joi.array()
        .items(
          Joi.object().keys({
            _id: Joi.string().regex(MONGO_ID_REGEX),
            name: Joi.string().required(),
            description: Joi.string(),
            upload: Joi.string().regex(MONGO_ID_REGEX).allow(null),
            articles: Joi.array()
              .items(
                Joi.object().keys({
                  _id: Joi.string().regex(MONGO_ID_REGEX),
                  name: Joi.string().required(),
                  description: Joi.string(),
                  upload: Joi.string().regex(MONGO_ID_REGEX).allow(null),

                  pricePP: Joi.number(),
                  price: Joi.object().keys({
                    net: Joi.number().integer().min(0),
                    taxPerMille: Joi.number().integer().min(0),
                  }),
                })
              )
              .required(),
          })
        )
        .required(),
    }),
  order: Joi.object().keys({
    party: Joi.string().regex(MONGO_ID_REGEX).required(),
    paymentMethod: Joi.string().allow("cash", "partyPoints", "card"),
    note: Joi.string().allow("").allow(null),
    orders: Joi.array()
      .items(
        Joi.object().keys({
          articleId: Joi.string().regex(MONGO_ID_REGEX).required(),
          quantity: Joi.number().integer().min(1).required(),
        })
      )
      .min(1)
      .required(),
  }),
  calculateFees: Joi.object()
    .keys({
      net: Joi.number().min(0).required(),
      taxPerMille: Joi.number().min(0).required(),
    })
    .required(),
  scan: Joi.object().keys({
    qrCodeValue: Joi.string().required(),
    party: Joi.string().regex(MONGO_ID_REGEX).required(),
  }),
  orders: {
    PATCH_status: Joi.object().keys({
      status: Joi.string().allow("successful", "declined"),
    }),
    PATCH: Joi.object().keys({
      favorite: Joi.boolean().required(),
    }),
  },
};
