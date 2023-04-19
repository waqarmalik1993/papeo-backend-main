const service = require("feathers-mongoose");
const Model = require("../../models/menuCardOrders.model");
const MenuCard = require("../menuCards/menuCardsService");
const TicketingShop = require("../ticketing/ticketingShopService");
const Transaction = require("../transactions/transactionsService");
const Party = require("../parties/partiesService");
const User = require("../users/usersService");
const stripeTicketing = require("../integrations/stripe/ticketingStripe");
const crypto = require("crypto");
const { NotFound, BadRequest, NotImplemented } = require("@feathersjs/errors");
const { papeoError, PAPEO_ERRORS } = require("../../modules/errors/errors");
const options = {
  Model: Model(),
  paginate: {
    default: 10,
    max: 1000,
  },
  multi: [],
  whitelist: ["$populate"],
};
exports.MODEL = options.Model;

const create = async (data) => {
  const menuCard = await MenuCard.get(data.menuCard);
  const party = await Party.get(data.party);
  let ticketingShop = await TicketingShop.MODEL.findOne({
    user: party.owner,
  });
  if (data.paymentMethod === "partyPoints" && menuCard.ppPaymentLimited) {
    const partyPointsOrders = await this.MODEL.find({
      user: data.user,
      party: data.party,
      paymentMethod: "partyPoints",
    });
    if (partyPointsOrders.length >= menuCard.ppPaymentLimit) {
      throw papeoError(
        PAPEO_ERRORS.MENUCARD_ORDER_FAILED_PP_ORDER_LIMIT_PER_PARTY_REACHED
      );
    }
  }
  if (data.paymentMethod === "card" && !ticketingShop)
    throw new BadRequest("No ticketing shop found for this party");
  if (!ticketingShop) ticketingShop = { _id: null };
  const articles = MenuCard.getArticlesWithCategoryName(menuCard);
  const orders = data.orders.map((order) => {
    const article = articles.find(
      (a) => a.article._id.toString() === order.articleId.toString()
    );
    if (!article) throw new NotFound(`No article with id ${order.articleId}`);
    return {
      articleId: order.articleId,
      quantity: order.quantity,
      article: article.article,
      categoryName: article.categoryName,
    };
  });
  let paymentInformation = null;
  // create payment intent if payment method is card
  if (data.paymentMethod === "card") {
    const user = await User.getRaw(data.user);
    if (!user.stripeCustomerId) {
      throw papeoError(PAPEO_ERRORS.MENUCARD_ORDER_FAILED_NO_CARD);
    }
    const gross = calculateGrossTotal({ orders });
    const args = {
      total: gross.eur,
      fees: 0,
      description: "MenuCard Payment",
      metadata: {
        transactionType: "menuCard",
        // transactionId: transaction._id.toString(),
        userId: user._id.toString(),
        ticketingShopId: ticketingShop._id.toString(),
      },
    };
    const paymentIntentObject = await stripeTicketing.createPaymentIntent(
      user.stripeCustomerId,
      ticketingShop.stripeAccountId,
      args,
      { confirm: false, captureMethod: "manual" }
    );
    paymentInformation = {
      paymentIntent: paymentIntentObject.id,
      clientSecret: paymentIntentObject.client_secret,
      accountId: ticketingShop.stripeAccountId,
      paymentMethod: paymentIntentObject.payment_method,
    };
  }
  const result = await service(options).create({
    ...data,
    paymentIntent: paymentInformation ? paymentInformation.paymentIntent : null,
    ticketingShop: ticketingShop._id,
    menuCard: menuCard._id,
    party: party._id,
    qrCodeValue: `M#${crypto.randomUUID()}`,
    orders: orders,
  });
  return { ...result, paymentInformation };
};
const get = async (id) => {
  const result = await service(options).get(id);
  return result;
};
const find = async (params) => {
  const result = await service(options).find(params);
  return result;
};
const patch = async (id, data, params) => {
  const before = await get(id);
  if (data.status && before.status !== "pending") {
    throw papeoError(PAPEO_ERRORS.MENUCARD_ORDER_ALREADY_PROCESSED);
  }
  let payment = null;
  if (data.status === "successful" && before.status === "pending") {
    payment = await processOrderPayment(before);
    data.status = payment.status;
  }
  let result = await service(options).patch(id, data, params);
  if (payment?.error) {
    throw papeoError(payment.error);
  }
  const price = calculateGrossTotal(result);
  return {
    ...result,
    totalPrice: price.eur,
    totalPricePP: price.pp,
  };
};

const processOrderPayment = async (menuCardOrder) => {
  if (menuCardOrder.paymentMethod === "cash") return { status: "successful" };
  if (menuCardOrder.paymentMethod === "partyPoints") {
    const gross = calculateGrossTotal(menuCardOrder);
    const user = await User.getRaw(menuCardOrder.user);
    if (user.partyPoints < gross.pp) {
      return {
        status: "failed",
        error: PAPEO_ERRORS.MENUCARD_ORDER_FAILED_NOT_ENOUGH_PP,
      };
    }
    const party = await Party.get(menuCardOrder.party);
    await Transaction.TYPES.menuCardPayment({ user, points: gross.pp });
    await Transaction.TYPES.menuCardPaymentCredit({
      user: party.owner,
      points: gross.pp,
    });
    return { status: "successful" };
  }
  if (menuCardOrder.paymentMethod === "card") {
    const ticketingShop = await TicketingShop.get(menuCardOrder.ticketingShop);
    const paymentIntent = await stripeTicketing.capturePaymentIntent(
      menuCardOrder.paymentIntent,
      ticketingShop.stripeAccountId
    );
    if (paymentIntent.status !== "succeeded") {
      return {
        status: "failed",
        error: papeoError(PAPEO_ERRORS.MENUCARD_ORDER_FAILED_CARD_DECLINED),
      };
    }
    return { status: "successful" };
  }
  throw new NotImplemented("Payment method not implemented");
};
exports.processOrderPayment = processOrderPayment;
const calculateGrossTotal = (menuCardOrder, splitEurAndPP = false) => {
  let totalEur = 0;
  let totalPP = 0;
  if (splitEurAndPP && !menuCardOrder.paymentMethod) {
    throw new Error("No payment method provided");
  }
  for (const order of menuCardOrder.orders) {
    if (splitEurAndPP) {
      if (["card", "cash"].includes(menuCardOrder.paymentMethod)) {
        totalEur += order.quantity * order.article.price.gross;
      }
      if (menuCardOrder.paymentMethod === "partyPoints") {
        totalPP += order.quantity * order.article.pricePP;
      }
    } else {
      totalEur += order.quantity * order.article.price.gross;
      totalPP += order.quantity * order.article.pricePP;
    }
  }
  return { eur: totalEur, pp: totalPP };
};

exports.calculateGrossTotal = calculateGrossTotal;

exports.patch = patch;
exports.get = get;
exports.find = find;

exports.create = create;
