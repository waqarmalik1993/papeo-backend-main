const { PaymentSchema } = require("../modules/validation/payments");
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const axios = require("axios");
const {
  createStripeCheckout,
  customerPortalStripe,
  getAvailablePointPlans,
  getAvailableSubscriptions,
} = require("../services/integrations/stripe/stripe");

module.exports = async (app) => {
  app.post("/payments/checkout", auth, async (req, res, next) => {
    try {
      validate(PaymentSchema.CHECKOUT, req.body);
      const { priceId, urlParams } = req.body;
      let checkout = await createStripeCheckout(req.user, priceId, urlParams);
      res.send(checkout);
    } catch (e) {
      next(e);
    }
  });

  app.post("/payments/portal", auth, async (req, res, next) => {
    try {
      validate(PaymentSchema.PORTAL, req.body);
      const { urlParams } = req.body;
      let customerPortal = await customerPortalStripe(req.user, urlParams);
      res.send(customerPortal);
    } catch (e) {
      next(e);
    }
  });

  app.get("/payments/subscriptions", auth, async (req, res, next) => {
    try {
      res.send(getAvailableSubscriptions());
    } catch (e) {
      next(e);
    }
  });

  app.get("/payments/point-plans", auth, async (req, res, next) => {
    try {
      res.send(getAvailablePointPlans());
    } catch (e) {
      next(e);
    }
  });
};
