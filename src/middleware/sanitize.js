const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;
const jwt = require("jsonwebtoken");
const User = require("../services/users/usersService.js");

exports.sanitize = async (req, res, next) => {
  try {
    if (req.query.$select) {
      throw papeoError(PAPEO_ERRORS.FORBIDDEN_PARAMETERS);
    }

    if (
      req.query.$populate &&
      typeof req.query.$populate !== "string" &&
      !Array.isArray(req.query.$populate)
    ) {
      throw papeoError(PAPEO_ERRORS.FORBIDDEN_PARAMETERS);
    }

    const blacklist = [
      "tokens",
      "phoneNumber",
      "currentLocation",
      "homeAddress",
      "homeLocation",
      "stripeCustomerId",
      "email",
      "partyPoints",
      "blockedUsers",
      "blockedByUsers",
      "adminRights",
      "restrictions",
      "address",
    ];
    const queryKeys = Object.keys(req.query);
    if (queryKeys.find((qk) => blacklist.find((bl) => qk.startsWith(bl)))) {
      throw papeoError(PAPEO_ERRORS.FORBIDDEN_PARAMETERS);
    }
    next();
  } catch (e) {
    next(e);
  }
};
