const {
  pointPlansStripe,
  subscriptionPlansStripe,
} = require("../stripe/helper/stripeConfig");
const {
  createCheckout,
  getCustomerPortal,
  createCustomer,
} = require("./helper/setupPayment");
const User = require("../../users/usersService");
const {
  papeoError,
  PAPEO_ERRORS,
} = require("../../../modules/errors/errors.js");
const axios = require("axios");

let domain = process.env.DOMAIN_FRONTEND;

const sendFetchTokenToRevenueCat = async (userId, subscriptionId) => {
  let options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REVENUECAT_API_KEY}`,
      "X-Platform": "stripe",
      "Content-Type": "application/json",
    },
    data: {
      app_user_id: userId.toString(),
      fetch_token: subscriptionId,
    },
    url: `https://api.revenuecat.com/v1/receipts`,
  };
  const response = await axios(options);
  return response?.data;
};
exports.handleStripeWebhook = async (event) => {
  if (event.type === "customer.subscription.created") {
    const subscriptionId = event.data.object.id;
    const user = await User.MODEL.findOne({
      stripeCustomerId: event.data.object.customer,
    });
    await sendFetchTokenToRevenueCat(user._id, subscriptionId);
  }
  if (event.type === "checkout.session.completed") {
    const checkoutSessionId = event.data.object.id;
    const user = await User.MODEL.findOne({
      stripeCustomerId: event.data.object.customer,
    });
    await sendFetchTokenToRevenueCat(user._id, checkoutSessionId);
  }
};

exports.createStripeCheckout = async (user, priceId, urlParams) => {
  user = await checkIfStripeCustomerExistsAndCreate(user);
  let priceInformation = translatePriceId(priceId);
  return createCheckout(
    user.stripeCustomerId,
    priceInformation.mode,
    priceId,
    domain,
    urlParams
  );
};

exports.customerPortalStripe = async (user, urlParams) => {
  user = await checkIfStripeCustomerExistsAndCreate(user);
  return getCustomerPortal(user.stripeCustomerId, domain, urlParams);
};

exports.getAvailableSubscriptions = () => {
  return subscriptionPlansStripe;
};

exports.getAvailablePointPlans = () => {
  return pointPlansStripe;
};

const checkIfStripeCustomerExistsAndCreate = async (user) => {
  if (!user.stripeCustomerId) {
    let updateObject = {
      metadata: {
        userId: user._id.toString(),
      },
    };
    if (user.username) updateObject.name = user.username;
    if (user.email) updateObject.email = user.email;
    let stripeCustomer = await createCustomer(updateObject);

    await User.patch(user._id, {
      stripeCustomerId: stripeCustomer.id,
    });
    return await User.getRaw(user._id);
  }

  return user;
};

const translatePriceId = (priceId) => {
  let result;
  result = subscriptionPlansStripe.find(
    (element) => element.priceId === priceId
  );
  if (!result)
    result = pointPlansStripe.find((element) => element.priceId === priceId);
  if (!result) throw papeoError(PAPEO_ERRORS.TYPE_DOES_NOT_EXIST);
  return result;
};
