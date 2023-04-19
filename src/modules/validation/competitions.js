const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.CompetitionsSchema = {
  POST: Joi.object().keys({
    name: Joi.string().required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().greater(Joi.ref("startDate")).required(),
  }),
  join: Joi.object().keys({
    party: Joi.string().pattern(MONGO_ID_REGEX).required(),
  }),
  remove: Joi.object().keys({
    party: Joi.string().pattern(MONGO_ID_REGEX).required(),
    reason: Joi.string().min(30).required(),
    messageToOwner: Joi.string(),
  }),
};
