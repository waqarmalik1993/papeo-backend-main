const stripe = require("stripe")(process.env.STRIPE_PRIVATE);
const { BadRequest } = require("@feathersjs/errors");
const TicketingShop = require("../../ticketing/ticketingShopService");
const TicketingTransaction = require("../../ticketing/ticketingTransactionService");
const { generateMerchant } = process.env.TEST
  ? require("../../../tests/integration/data/ticketing/merchant.mock")
  : { generateMerchant: null };
let domain = process.env.DOMAIN_FRONTEND;
const PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
exports.handleStripeWebhookConnect = async (event) => {
  switch (event.type) {
  case "capability.updated": {
    const data = event.data.object;
    console.log("capability.updated", data.id, data.status);
    const ticketingShop = await TicketingShop.getTicketingShopByAccountId(
      event.account
    );
    if (data.id === "card_payments") {
      await TicketingShop.patch(ticketingShop._id, {
        cardPaymentsEnabled: data.status === "active",
      });
    }
    if (data.id === "transfers") {
      await TicketingShop.patch(ticketingShop._id, {
        transfersEnabled: data.status === "active",
      });
    }
    return;
  }

  case "payment_intent.succeeded": {
    const data = event.data.object;
    console.log("payment_intent.succeeded");
    console.log(data);
    if (data.metadata.transactionType === "ticketing") {
      await TicketingTransaction.patch(data.metadata.transactionId, {
        status: "succeeded",
      });
    }
    if (data.metadata.transactionType === "menuCard") {
      // TODO create menuCardOrder transaction?
    }
    return;
  }

  default:
    console.log("TICKETING:", event.type);
    console.log(JSON.stringify(event));
    break;
  }
};
exports.handleStripeWebhook = async (event) => {
  switch (event.type) {
  case "payment_method.attached": {
    const data = event.data.object;
    console.log("payment_method.attached");
    console.log(data);
    await this.setDefaultPaymentMethod(data.customer, data.id);
    // TODO update transaction
    return;
  }

  default:
    console.log("TICKETING:", event.type);
    console.log(JSON.stringify(event));
    break;
  }
};

exports.generateOnboardingLink = (accountID, origin) => {
  if (process.env.TEST) return "example.com/onboard";
  return stripe.accountLinks
    .create({
      type: "account_onboarding",
      account: accountID,
      refresh_url: `${origin}/ticketing/shops/refresh`,
      return_url: `${origin}/ticketing/shops/success`,
      collect: "eventually_due", // oder "currently_due" für schnelleres aber nicht komplettes onboarding
      // https://stripe.com/docs/connect/identity-verification#onboarding-flows
    })
    .then((link) => link.url);
};
exports.generateLoginLink = async (accountID) => {
  if (process.env.TEST) return "example.com/login";
  const loginLink = await stripe.accounts.createLoginLink(accountID);
  return loginLink.url;
};
exports.createExpressMerchantAccount = async ({ userId }) => {
  if (process.env.TEST) return generateMerchant(Math.random() * 10000 + "");
  const account = await stripe.accounts.create({
    type: "express",
    metadata: {
      userId,
    },
  });
  return account;
};
exports.getExpressMerchantAccount = async ({ accountId }) => {
  if (process.env.TEST) return generateMerchant(accountId);
  const account = await stripe.accounts.retrieve(accountId);
  return account;
};
exports.createTicket = async (stripeAccountId, { name, id }) => {
  if (process.env.TEST) return "example.com";
  const ticket = await stripe.products.create(
    {
      name,
      id: id,
      active: true,
      default_price_data: {
        currency: "eur",
        tax_behavior: "inclusive",
        unit_amount: 10190,
      },
      expand: ["default_price"],
    },
    { stripeAccount: stripeAccountId }
  );
  return ticket;
};

exports.createSetupIntent = async (stripeCustomer) => {
  if (process.env.TEST) return "example.com";
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: stripeCustomer.id },
    { apiVersion: "2020-08-27" }
  );
  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomer.id,
  });
  return {
    setupIntent: setupIntent.client_secret,
    ephemeralKey: ephemeralKey.secret,
    customer: stripeCustomer.id,
    publishableKey: PUBLISHABLE_KEY,
  };
};
exports.createPaymentIntentWithoutPaymentMethod = async (
  merchantId,
  { total, fees, metadata, description },
  { confirm }
) => {
  if (process.env.TEST) {
    return {
      client_secret: "123",
      payment_method: "123",
      id: "123",
    };
  }
  const paymentIntent = await stripe.paymentIntents.create(
    {
      description,
      amount: total,
      currency: "eur",
      //payment_method_types: ["card"],
      application_fee_amount: fees,
      //customer: clonedCustomer.id,
      confirm: confirm,
      metadata,
    },
    { stripeAccount: merchantId }
  );
  console.log(paymentIntent);
  return paymentIntent;
};
/*
async function createPaymentMethodFromCardToken(
  merchantId,
  cardToken
) {
  if (!cardToken) throw new BadRequest();

  return await stripe.paymentMethods.create(
    {
      type: "card",
      card: { token: cardToken },
    },
    { stripeAccount: merchantId }
  );
}
*/
/*
exports.createPaymentIntentOnlyWithCardToken = async (
  merchantId,
  { gross, fees, metadata, description },
  { confirm },
  cardToken
) => {
  if (process.env.TEST)
    return {
      client_secret: "123",
      payment_method: "123",
      id: "123",
    };

  const paymentIntent = await stripe.paymentIntents.create(
    {
      description,
      amount: gross,
      currency: "eur",
      //payment_method_types: ["card"],
      application_fee_amount: fees,
      payment_method: await createPaymentMethodFromCardToken(merchantId, cardToken),
      //customer: clonedCustomer.id,
      confirm: confirm,
      metadata,
    },
    { stripeAccount: merchantId }
  );
  console.log(paymentIntent);
  return paymentIntent;
};
*/
exports.createPaymentIntent = async (
  customerId,
  merchantId,
  { total, fees, metadata, description },
  { confirm, captureMethod = "automatic" }
) => {
  if (process.env.TEST) {
    return {
      client_secret: "123",
      payment_method: "123",
      id: "123",
    };
  }
  const stripeUser = await stripe.customers.retrieve(customerId);
  const paymentMethodRooot =
    stripeUser.invoice_settings?.default_payment_method ||
    stripeUser.default_source;
  console.log({ paymentMethodRooot });
  console.log("CLONING PAYMENT METHOD");
  const clonedPaymentMethod = await stripe.paymentMethods.create(
    {
      customer: stripeUser.id,
      payment_method: paymentMethodRooot,
    },
    {
      stripeAccount: merchantId,
    }
  );
  const paymentIntent = await stripe.paymentIntents.create(
    {
      description,
      amount: total,
      currency: "eur",
      //payment_method_types: ["card"],
      application_fee_amount: fees,
      //customer: clonedCustomer.id,
      confirm: confirm,
      capture_method: captureMethod,
      payment_method: clonedPaymentMethod.id, //clonedCustomer.invoice_settings.default_payment_method,
      metadata,
    },
    { stripeAccount: merchantId }
  );
  return paymentIntent;
};
exports.capturePaymentIntent = async (paymentIntentId, merchantId) => {
  if (process.env.TEST) {
    return {
      status: "succeeded",
    };
  }
  return await stripe.paymentIntents.capture(paymentIntentId, {
    stripeAccount: merchantId,
  });
};

exports.setDefaultPaymentMethod = async (customerId, paymentMethodId) => {
  return await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
};
exports.getStripeCustomer = async (customerId) => {
  return await stripe.customers.retrieve(customerId);
};
exports.getStripeCustomerExtendedPaymentMethods = async (customerId) => {
  return await stripe.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });
};
exports.createStripeCustomer = async ({ id, name }) => {
  return await stripe.customers.create({
    id,
    name,
  });
};
exports.cancelPaymentIntent = async (merchantId, paymentIntentId) => {
  // console.log({ merchantId, paymentIntentId });
  if (process.env.TEST) return;
  return await stripe.paymentIntents.cancel(paymentIntentId, {
    stripeAccount: merchantId,
  });
};
exports.getPaymentIntent = async (merchantId, paymentIntentId) => {
  // console.log({ merchantId, paymentIntentId });
  if (process.env.TEST) return;
  return await stripe.paymentIntents.retrieve(paymentIntentId, {
    stripeAccount: merchantId,
  });
};
exports.refundPaymentIntent = async (merchantId, paymentIntentId) => {
  // console.log({ merchantId, paymentIntentId });
  if (process.env.TEST) return;
  return await stripe.refunds.create(
    { payment_intent: paymentIntentId },
    {
      stripeAccount: merchantId,
    }
  );
};
