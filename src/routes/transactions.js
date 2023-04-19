const User = require("../services/users/usersService");
const Transaction = require("../services/transactions/transactionsService");
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;
const UserSchema = require("../modules/validation/users.js").UserSchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
module.exports = async (app) => {
  app.get("/users/:id/transactions", auth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { lang, getDoubleAmount } = req.query;
      delete req.query.getDoubleAmount;
      if (
        id !== req.user._id.toString() &&
        !User.hasAdminRightsTo(req.user, User.adminRights.managePartyPoints)
      ) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      const transactions = await Transaction.find({
        query: {
          user: id,
          ...req.query,
          lang: undefined,
          $sort: { createdAt: -1 },
        },
      });
      let translatedData = transactions.data.map((t) => {
        return Transaction.translate(t, lang || req.user.languageSetting);
      });
      if (getDoubleAmount !== "true") {
        translatedData = translatedData.map((trx) => ({
          ...trx,
          amount: parseInt(trx.amount),
        }));
      }
      transactions.data = translatedData;
      res.send(transactions);
    } catch (e) {
      next(e);
    }
  });
};
