const User = require("../services/users/usersService");
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;
const UserSchema = require("../modules/validation/users.js").UserSchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;

module.exports = async (app) => {
  app.post("/users/:id/verification/vote", auth, async (req, res, next) => {
    try {
      validate(UserSchema.verification.POST, req.body);
      let { id } = req.params;
      let { vote } = req.body;
      const votedUser = await User.get(id);
      if (!votedUser) throw papeoError(PAPEO_ERRORS.USER_DOES_NOT_EXIST);

      await User.verification.voteForUser(req.user, votedUser, vote);
      res.send({ vote });
    } catch (e) {
      next(e);
    }
  });
  app.post("/users/verification", auth, async (req, res, next) => {
    try {
      validate(UserSchema.verification.search, req.body);
      const excludeIds = req.body.exclude || [];
      excludeIds.push(
        ...req.user.blockedUsers.map((u) => u.toString()),
        ...req.user.blockedByUsers.map((u) => u.toString())
      );
      res.send(
        await User.verification.getUsersToVerify(
          req.user,
          excludeIds,
          req.body.firstUser
        )
      );
    } catch (e) {
      next(e);
    }
  });
  app.patch("/users/verification", auth, async (req, res, next) => {
    try {
      validate(UserSchema.verification.PATCH, req.body);
      const deactivated = req.body.deactivated;
      res.send(
        await User.patch(req.user._id, {
          $set: {
            "verification.deactivated": deactivated,
          },
        })
      );
    } catch (e) {
      next(e);
    }
  });
};
