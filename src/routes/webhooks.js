const User = require("../services/users/usersService");
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;
const UserSchema = require("../modules/validation/users.js").UserSchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const bodyParser = require("body-parser");
const stripe = require("stripe");
const express = require("@feathersjs/express");
const {
  processRevenuecat,
} = require("../services/integrations/revenuecat/webhook");
const {
  handleStripeWebhook,
} = require("../services/integrations/stripe/stripe");

module.exports = async (app) => {
  app.post("/webhooks/revenuecat", express.json(), async (req, res, next) => {
    if (req.headers.authorization !== process.env.REVENUECAT_WEBHOOK_SECRET) {
      return res.sendStatus(401);
    }
    try {
      console.log(JSON.stringify(req.body, null, 2));
      await processRevenuecat(req.body);
      res.sendStatus(200);
    } catch (e) {
      next(e);
    }
  });
  app.post(
    "/webhooks/stripe",
    bodyParser.raw({ type: "application/json" }),
    async (req, res, next) => {
      try {
        const sig = req.headers["stripe-signature"];
        const event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SIGNING_SECRET
        );
        await handleStripeWebhook(event);
        await res.sendStatus(200);
      } catch (e) {
        next(e);
      }
    }
  );
};
