const { NotFound, BadRequest } = require("@feathersjs/errors");
const service = require("feathers-mongoose");
const { Types } = require("mongoose");
const Model = require("../../models/ticketingTickets.model");
const stripeTicketing = require("../integrations/stripe/ticketingStripe");
const TicketingShop = require("../ticketing/ticketingShopService");
const PartyGuest = require("../partyGuests/partyGuestsService");
const TicketingTransaction = require("../ticketing/ticketingTransactionService");
const User = require("../users/usersService");
const Party = require("../parties/partiesService");
const options = {
  Model: Model(),
  paginate: {
    default: 10,
    max: 1000,
  },
  multi: [],
  whitelist: [],
};
exports.MODEL = options.Model;

const create = async (data) => {
  const ticketShop = await TicketingShop.getTicketingShopForUser(data.user);
  if (!ticketShop) {
    throw new NotFound();
  }
  const ticketId = new Types.ObjectId();
  const price = calculatePrice(data.price);
  data.availability = data.totalAvailability;
  const result = await service(options).create({
    _id: ticketId,
    ...data,
    price,
  });
  return result;
};
const purchase = async (
  user,
  ticketingShop,
  partyId,
  orders,
  useDefaultPaymentMethod = false
) => {
  for (const { ticket, quantity } of orders) {
    if (ticket.deleted) {
      throw new NotFound();
    }
    if (ticket.paused) {
      throw new BadRequest("Ticket purchase is not allowed");
    }
    const party = await Party.get(ticket.party);
    if (
      party.ticketingSettings.limitTicketPurchasesPerUser &&
      // TODO limit quantity per order or for all tickets?
      party.ticketingSettings.ticketPurchasesPerUser < quantity
    ) {
      throw new BadRequest(
        `You can only buy ${party.ticketingSettings.ticketPurchasesPerUser} tickets`
      );
    }
    if (party.ticketingSettings.guestlistPurchaseOnly) {
      if (
        !(await PartyGuest.MODEL.exists({
          user: user._id,
          party: partyId,
          status: "attending",
        }))
      ) {
        throw new BadRequest(
          "You are not on the guestlist for this party. You can't purchase tickets"
        );
      }
    }
  }
  // TODO check availability and ticket settings

  let grossTotal = 0;
  let feesTotal = 0;
  let transactionDescriptionString = `${user.username} purchased `;
  for (const { ticket, quantity } of orders) {
    if (!ticket.price) throw new BadRequest("ticket has no price");
    grossTotal += ticket.price.gross * quantity;
    feesTotal += ticket.price.fees * quantity;
    transactionDescriptionString += `${quantity} X ${ticket.name}; `;
  }
  const transaction = await TicketingTransaction.create({
    status: "pending",
    ticketingShop: ticketingShop._id,
    party: partyId,
    user: user._id,
    amount: grossTotal + feesTotal,
    // TODO does this work?
    orders: orders.map((order) => ({ ...order, price: order.ticket.price })),
  });
  try {
    const args = {
      total: grossTotal + feesTotal,
      fees: feesTotal,
      description: transactionDescriptionString,
      metadata: {
        transactionType: "ticketing",
        transactionId: transaction._id.toString(),
        userId: user._id.toString(),
        ticketingShopId: ticketingShop._id.toString(),
      },
    };
    const paymentIntent = !useDefaultPaymentMethod
      ? await stripeTicketing.createPaymentIntentWithoutPaymentMethod(
        ticketingShop.stripeAccountId,
        args,
        { confirm: false }
      )
      : await stripeTicketing.createPaymentIntent(
        user.stripeCustomerId,
        ticketingShop.stripeAccountId,
        args,
        { confirm: false }
      );
    await TicketingTransaction.patch(transaction._id, {
      paymentIntent: paymentIntent.id,
    });
    return paymentIntent;
  } catch (error) {
    console.error(error);
  }
  return null;
};
exports.purchase = purchase;
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
  // recalculate price object
  if (data.price) {
    data.price = calculatePrice({ ...before.price, ...data.price });
  }
  // recalculate availability
  if (data.totalAvailability !== undefined) {
    // TODO race conditions?
    data.availability =
      before.availability + (data.totalAvailability - before.totalAvailability);
  }
  let result = await service(options).patch(id, data, params);
  return result;
};
exports.patch = patch;

const calculateFees = (net, platformFeePercent) => {
  return Math.round(net * (platformFeePercent / 100));
};
exports.calculateFees = calculateFees;
const calculateFeesForTicket = (ticket, platformFeePercent = 10) => {
  if (!ticket.price.net) throw new Error("ticket has not net price");
  return calculateFees(ticket.price.net, platformFeePercent);
};
exports.calculateFeesForTicket = calculateFeesForTicket;
const calculateTax = (net, taxPerMille) => {
  return Math.round((net * taxPerMille) / 1000);
};
exports.calculateTax = calculateTax;
const calculatePrice = (price, platformFeePercent = 10) => {
  if (!price.net) throw new Error("ticket has not net price");
  if (!price.taxPerMille && price.taxPerMille !== 0) {
    throw new Error("ticket has not taxPerMille");
  }
  const net = price.net;
  const taxPerMille = price.taxPerMille;
  const fees = calculateFees(net, platformFeePercent);
  const tax = calculateTax(net, taxPerMille);
  const gross = net + tax;
  const total = gross + fees;
  return {
    taxPerMille,
    net,
    gross,
    fees,
    tax,
    total,
  };
};
exports.calculatePrice = calculatePrice;

const incrementAvailability = async (ticketId, quantity) => {
  return await options.Model.updateOne(
    { _id: ticketId },
    { $inc: { availability: quantity } },
    { new: true }
  );
};
exports.incrementAvailability = incrementAvailability;
const incrementBought = async (ticketId, quantity) => {
  return await options.Model.updateOne(
    { _id: ticketId },
    { $inc: { bought: quantity } },
    { new: true }
  );
};
exports.incrementBought = incrementBought;
exports.get = get;
exports.find = find;

exports.create = create;
