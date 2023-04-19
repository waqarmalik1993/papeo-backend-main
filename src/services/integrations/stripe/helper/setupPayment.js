const { stripe } = require("./stripeConfig");

// TODO payment or subscription
const createCheckout = async (customerId, mode, priceId, domain, urlParams) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: mode,
      //'giropay', 'sepa_debit', 'sofort'
      payment_method_types: ["card"],
      customer: customerId,
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      automatic_tax: {
        enabled: true,
      },
      customer_update: { address: "auto" },
      billing_address_collection: "required",
      success_url: domain + urlParams.success,
      cancel_url: domain + urlParams.cancel,
    });
    return {
      sessionId: session.id,
    };
  } catch (e) {
    throw e;
  }
};

const getCustomerPortal = async (customerId, domain, urlParams) => {
  const portalsession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: domain + urlParams.return,
  });
  return {
    url: portalsession.url,
  };
};

const createCustomer = async (objectInformation) => {
  try {
    const customer = await stripe.customers.create(objectInformation);
    return customer;
  } catch (e) {
    throw e;
  }
};

const patchCustomer = async (customerId, newInformation) => {
  await stripe.customers.update(customerId, newInformation);
};

const getCustomer = async (customerId) => {
  return await stripe.customers.retrieve(customerId);
};

module.exports = {
  createCheckout,
  getCustomerPortal,
  createCustomer,
  patchCustomer,
  getCustomer,
};
