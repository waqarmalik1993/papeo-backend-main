const User = require("../services/users/usersService.js");
const auth = require("../middleware/auth.js").auth;
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;

module.exports = async (app) => {
  app.get("/users/referrals/validate/:referralCode",/* NOT AUTH */ async (req, res, next) => {
    try {
      const { referralCode } = req.params;
      const result = {
        result: !!(await User.referral.isReferralCodeUsed(referralCode)),
      };
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.get(
    "/users/:userId/referrals/:referralCode/stats",
    auth,
    async (req, res, next) => {
      try {
        const { userId, referralCode } = req.params;
        if (req.user._id.toString() !== userId) {
          if (
            !User.hasAdminRightsTo(req.user, User.adminRights.viewStatistics)
          ) {
            throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
          }
        }
        const user = await User.getRaw(userId);
        if (!user.referralCodes.find((rc) => rc.code === referralCode)) {
          throw papeoError(PAPEO_ERRORS.NOT_FOUND);
        }
        res.send(
          await User.referral.getReferralStatsForReferralCode(referralCode)
        );
      } catch (e) {
        next(e);
      }
    }
  );
  app.post("/users/:userId/referrals/codes", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (userId !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      const result = await User.referral.addRandomReferralCodeToUser(userId);
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
};
