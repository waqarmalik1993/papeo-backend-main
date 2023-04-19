const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;
const jwt = require("jsonwebtoken");
const User = require("../services/users/usersService.js");

exports.optionalAuth = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    if (!token) {
      if (req.params.authtoken) token = req.params.authtoken;
    }
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SIGNING_SECRET);
      const user = await User.getRaw(decodedToken.userId);
      if (user.restrictions.login) {
        throw papeoError(PAPEO_ERRORS.NOT_AUTHENTICATED);
      }
      if (decodedToken.conversationId) {
        req.conversationId = decodedToken.conversationId;
      }
      if (user) req.user = user;
    } catch (error) {}

    next();
  } catch (e) {
    next(e);
  }
};
