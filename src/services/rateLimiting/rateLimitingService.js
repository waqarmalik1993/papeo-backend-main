const service = require("feathers-mongoose");
const usersService = require("../users/usersService.js");
const Model = require("../../models/rateLimiting.model.js");
const sendEmailVerificationCode =
  require("../../modules/notifications/emails/sendUserNotifications.js").sendEmailVerificationCode;
const papeoError = require("../../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const options = {
  Model: Model(),
  paginate: {
    default: 10,
    max: 1000,
  },
  multi: ["patch"],
  whitelist: [
    "$populate",
    "$regex",
    "$options",
    "$geoWithin",
    "$centerSphere",
    "$geometry",
    "$near",
    "$maxDistance",
    "$minDistance",
    "$nearSphere",
    "$geoNear",
  ],
};
exports.MODEL = options.Model;

const isRateLimited = async (bucket, method, requestsPerMinute) => {
  const rateLimit = await options.Model.findOneAndUpdate(
    {
      bucket: bucket,
      method: method,
      minute: Math.floor(Date.now() / 1000 / 60),
    },
    { $inc: { requests: 1 } },
    { upsert: true }
  );
  if (rateLimit === null) return false;
  return rateLimit.requests > requestsPerMinute;
};
exports.isRateLimited = isRateLimited;
