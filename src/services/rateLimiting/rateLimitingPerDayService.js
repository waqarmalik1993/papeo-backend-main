const service = require("feathers-mongoose");
const usersService = require("../users/usersService.js");
const Model = require("../../models/rateLimitingPerDay.model");
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

const isRateLimited = async (bucket, method, requestsPerDay) => {
  const rateLimit = await options.Model.findOneAndUpdate(
    {
      bucket: bucket,
      method: method,
      day: Math.floor(new Date() / 86400 / 1000),
    },
    { $inc: { requests: 1 } },
    { upsert: true }
  );
  if (rateLimit === null) return false;
  return rateLimit.requests > requestsPerDay;
};
exports.isRateLimited = isRateLimited;
