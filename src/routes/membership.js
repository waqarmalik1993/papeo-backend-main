const User = require("../services/users/usersService");
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;
const UserSchema = require("../modules/validation/users.js").UserSchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;

module.exports = async (app) => {
  app.get(
    "/users/:id/membership/availablepartycount",
    auth,
    async (req, res, next) => {
      try {
        let { id } = req.params;
        if (id !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        res.send(
          await User.membership.getNumberOfAvailableParties(req.user)
        );
      } catch (e) {
        next(e);
      }
    }
  );
};
