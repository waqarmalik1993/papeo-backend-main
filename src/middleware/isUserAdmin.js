const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;
exports.auth = async (req, res, next) => {
  try {
    if (!req?.user?.roles?.includes("admin")) {
      throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
    }
    next();
  } catch (e) {
    next(e);
  }
};
