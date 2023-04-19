const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.TicketingSchema = {
  tickets: {
    POST: Joi.object().keys({
      _id: Joi.any().strip(true),
      party: Joi.string().regex(MONGO_ID_REGEX).required(),
      name: Joi.string().required(),
      //availability: Joi.number().required(),
      totalAvailability: Joi.number().min(1).required(),
      sellingStartDate: Joi.date().iso().required(),
      sellingEndDate: Joi.date().iso().required(),
      paused: Joi.boolean().required(),
      visibility: Joi.object()
        .keys({
          hostOnly: Joi.boolean().required(),
          adminsOnly: Joi.boolean().required(),
          friendsOnly: Joi.boolean().required(),
          guestlistOnly: Joi.boolean().required(),
        })
        .required(),
      price: Joi.object()
        .keys({
          net: Joi.number().integer().min(0).required(),
          taxPerMille: Joi.number().integer().min(0).required(),
        })
        .required(),
    }),
    PATCH: Joi.object().keys({
      name: Joi.string(),
      //availability: Joi.number(),
      totalAvailability: Joi.number().min(1),
      sellingStartDate: Joi.date().iso(),
      sellingEndDate: Joi.date().iso(),
      paused: Joi.boolean(),
      visibility: Joi.object().keys({
        hostOnly: Joi.boolean(),
        adminsOnly: Joi.boolean(),
        friendsOnly: Joi.boolean(),
        guestlistOnly: Joi.boolean(),
      }),
      price: Joi.object().keys({
        net: Joi.number().integer().min(0),
        taxPerMille: Joi.number().integer().min(0),
      }),
    }),

    purchase: Joi.object().keys({
      orders: Joi.array()
        .items(
          Joi.object().keys({
            quantity: Joi.number().integer().min(1).required(),
            ticketId: Joi.string().regex(MONGO_ID_REGEX).required(),
          })
        )
        .min(1)
        .required(),
    }),
    calculatefees: Joi.object().keys({
      orders: Joi.array()
        .items(
          Joi.object().keys({
            quantity: Joi.number().integer().min(1).required(),
            ticketId: Joi.string().regex(MONGO_ID_REGEX).required(),
          })
        )
        .min(1)
        .required(),
    }),
    calculateTicketFees: Joi.object()
      .keys({
        net: Joi.number().min(0).required(),
        taxPerMille: Joi.number().min(0).required(),
      })
      .required(),
    cancelParty: Joi.object()
      .keys({
        party: Joi.string().regex(MONGO_ID_REGEX).required(),
        message: Joi.string(),
      })
      .required(),
  },
  userTickets: {
    PATCH: Joi.object().keys({
      sharedWith: Joi.string().regex(MONGO_ID_REGEX).allow(null),
      user: Joi.string().regex(MONGO_ID_REGEX),
    }),
    checkin: Joi.object().keys({
      qrCodeValue: Joi.string().required(),
      party: Joi.string().regex(MONGO_ID_REGEX).required(),
    }),
  },
};
