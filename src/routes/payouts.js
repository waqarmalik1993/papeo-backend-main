const User = require("../services/users/usersService.js");

const Payout = require("../services/payouts/payoutsService");

const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const { PayoutsSchema } = require("../modules/validation/payouts");
const { BadRequest } = require("@feathersjs/errors");
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;

module.exports = async (app) => {
  app.post("/payouts", auth, async (req, res, next) => {
    try {
      validate(PayoutsSchema.POST, req.body);
      if (req.body.amount > req.user.partyPoints) {
        throw new BadRequest("not enough party points");
      }
      if (!req.user.verification?.verified) {
        throw papeoError(PAPEO_ERRORS.ONLY_VERIFIED_USERS_CAN_REQUEST_A_PAYOUT);
      }
      return res.send(
        await Payout.create({
          ...req.body,
          user: req.user._id,
          status: "pending",
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.patch("/payouts/:payoutId", auth, async (req, res, next) => {
    try {
      const { payoutId } = req.params;
      validate(PayoutsSchema.PATCH, req.body);
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.enablePayouts) &&
        !User.hasAdminRightsTo(req.user, User.adminRights.payoutPayouts)
      ) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }

      if (
        req.body.status === "paid" &&
        !User.hasAdminRightsTo(req.user, User.adminRights.payoutPayouts)
      ) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      const payout = await Payout.get(payoutId);
      if (payout.status === "paid") {
        //Payout can be patched from Status == rejected to Status == enabled
        //|| payout.status === "rejected"
        throw new BadRequest("this payout is already processed");
      }
      const user = await User.get(payout.user);
      return res.send({
        ...(await Payout.patch(
          payoutId,
          {
            ...req.body,
            admin: req.user._id,
          },
          { admin: req.user }
        )),
        user: { _id: user._id, username: user.username },
        admin: { _id: req.user._id, username: req.user.username },
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/payouts", auth, async (req, res, next) => {
    try {
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.enablePayouts) &&
        !User.hasAdminRightsTo(req.user, User.adminRights.payoutPayouts)
      ) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      req.query.$populate = [
        {
          path: "user",
          select: { _id: 1, username: 1 },
        },
        {
          path: "admin",
          select: { _id: 1, username: 1 },
        },
      ];
      return res.send(await Payout.find({ query: req.query }));
    } catch (e) {
      next(e);
    }
  });
  app.get("/payouts/count", auth, async (req, res, next) => {
    try {
      const count = await Payout.MODEL.countDocuments({
        user: req.user._id,
        status: { $ne: "rejected" },
      });
      const pendingAndEnabledPayouts = await Payout.MODEL.countDocuments({
        user: req.user._id,
        status: { $in: ["pending", "enabled"] },
      });
      return res.send({
        count: count,
        payoutEnabled: pendingAndEnabledPayouts === 0,
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/payouts/stats", auth, async (req, res, next) => {
    try {
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.enablePayouts) &&
        !User.hasAdminRightsTo(req.user, User.adminRights.payoutPayouts)
      ) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      const stats = await Payout.MODEL.aggregate([
        {
          $group: {
            _id: "$status",
            sum: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]);
      const [pending] = stats.filter((x) => x._id === "pending");
      const [enabled] = stats.filter((x) => x._id === "enabled");
      const [paid] = stats.filter((x) => x._id === "paid");
      const [rejected] = stats.filter((x) => x._id === "rejected");
      return res.send({
        pending: {
          sum: pending ? pending.sum / 100 : 0,
          count: pending ? pending.count : 0,
        },
        enabled: {
          sum: enabled ? enabled.sum / 100 : 0,
          count: enabled ? enabled.count : 0,
        },
        paid: { sum: paid ? paid.sum / 100 : 0, count: paid ? paid.count : 0 },
        rejected: {
          sum: rejected ? rejected.sum / 100 : 0,
          count: rejected ? rejected.count : 0,
        },
      });
    } catch (e) {
      next(e);
    }
  });
};
