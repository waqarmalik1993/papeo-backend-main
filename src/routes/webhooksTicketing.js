const bodyParser = require("body-parser");
const stripe = require("stripe");

const {
  handleStripeWebhook,
  handleStripeWebhookConnect,
} = require("../services/integrations/stripe/ticketingStripe");

module.exports = async (app) => {
  app.post(
    "/ticketing/webhooks/connect",
    bodyParser.raw({ type: "application/json" }),
    async (req, res, next) => {
      try {
        const sig = req.headers["stripe-signature"];
        const event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SIGNING_SECRET_TICKETING_CONNECT
        );
        await handleStripeWebhookConnect(event);
        await res.sendStatus(200);
      } catch (e) {
        next(e);
      }
    }
  );
  app.post(
    "/ticketing/webhooks",
    bodyParser.raw({ type: "application/json" }),
    async (req, res, next) => {
      try {
        const sig = req.headers["stripe-signature"];
        console.log(process.env.STRIPE_WEBHOOK_SIGNING_SECRET_TICKETING);
        const event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SIGNING_SECRET_TICKETING
        );
        await handleStripeWebhook(event);
        await res.sendStatus(200);
      } catch (e) {
        next(e);
      }
    }
  );
};
