const Joi = require("joi");

exports.PlacesSchema = {
  search: {
    ADDRESS: Joi.object().keys({
      searchValue: Joi.string().required(),
      countryCode: Joi.string().required(),
    }),
    LATLONG: Joi.object().keys({
      long: Joi.number().required(),
      lat: Joi.number().required(),
      countryCode: Joi.string().required(),
    }),
  },
  GET_QUERY: Joi.object().keys({
    placeId: Joi.string().required(),
    countryCode: Joi.string().required(),
  }),
};
