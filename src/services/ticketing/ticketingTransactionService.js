const { NotFound, BadRequest } = require("@feathersjs/errors");
const service = require("feathers-mongoose");
const { Types, Mongoose } = require("mongoose");
const TicketingTicket = require("../../services/ticketing/ticketingTicketService");
const Model = require("../../models/ticketingTransactions.model");
const stripeTicketing = require("../integrations/stripe/ticketingStripe");
const TicketingShop = require("../ticketing/ticketingShopService");
const UserTicket = require("../ticketing/ticketingUserTicketService");
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
const PAYMENT_INTENT_EXPIRATION_MINUTES = 5;
const create = async (data) => {
  // TODO mongodb transaction, create pending transaction in ticket(s)
  // check availability
  // create pending transaction
  // https://www.mongodb.com/blog/post/quick-start-nodejs--mongodb--how-to-implement-transactions
  const session = await options.Model.startSession();
  const expiresAt = new Date();
  expiresAt.setTime(
    expiresAt.getTime() + PAYMENT_INTENT_EXPIRATION_MINUTES * 60 * 1000
  );
  data.expiresAt = expiresAt;
  const transactionOptions = {
    readPreference: "primary",
    readConcern: { level: "local" },
    writeConcern: { w: "majority" },
  };
  let result = null;
  try {
    let failed = false;
    await session.withTransaction(async () => {
      const [ticketingTransaction] = await options.Model.create([data], {
        session,
      });
      // for each order, push pending transaction into ticket and decrease availability

      for (const order of ticketingTransaction.orders) {
        console.log({ order });
        let updatedTicket = null;
        try {
          updatedTicket = await TicketingTicket.MODEL.findByIdAndUpdate(
            order.ticket,
            {
              /*$push: {
                pendingTransactions: {
                  _id: ticketingTransaction._id,
                  expiresAt: data.expiresAt,
                  quantity: order.quantity,
                },
              },*/
              $inc: {
                availability: -order.quantity,
              },
            },
            { new: true, session }
          );
        } catch (error) {
          console.error(error);
          failed = true;
        }
        console.log({ updatedTicket });
        if (updatedTicket.availability < 0) {
          failed = true;
          console.log("ticket availability not sufficient");
        }
        if (failed) {
          await session.abortTransaction();
          return;
        }
      }
      result = ticketingTransaction;
    }, transactionOptions);

    if (failed) {
      console.log("The transaction was intentionally aborted.");
    }
  } catch (error) {
    console.error(error);
  } finally {
    await session.endSession();
  }
  console.log(result);
  if (result === null) throw BadRequest();
  return result;
};
exports.create = create;

const get = async (id, params) => {
  return await service(options).get(id, params);
};
exports.get = get;

const patch = async (id, data, params) => {
  const before = await get(id);
  if (data.status === "succeeded" && before.status !== "succeeded") {
    const party = await Party.get(before.party);
    await Promise.all(
      before.orders.map(async (order) => {
        for (let i = 0; i < order.quantity; i++) {
          await UserTicket.create({
            ticketingShop: before.ticketingShop,
            party: before.party,
            user: before.user,
            ticket: order.ticket,
            //
            purchasedPrice: order.price?.total,
            allowExternalSharing: party.ticketingSettings.allowExternalSharing,
            allowInternalSharing: party.ticketingSettings.allowInternalSharing,
          });
        }
        await TicketingTicket.incrementBought(order.ticket, order.quantity);
      })
    );
  }
  let result = await service(options).patch(id, data, params);
  return result;
};
exports.patch = patch;

const expireTransactions = async () => {
  const expiredTransactions = await options.Model.find({
    expiresAt: { $lt: new Date() },
    status: "pending",
  })
    .populate("ticketingShop")
    .lean();
  const results = await Promise.allSettled(
    expiredTransactions.map(async (etrx) => {
      await stripeTicketing.cancelPaymentIntent(
        etrx.ticketingShop.stripeAccountId,
        etrx.paymentIntent
      );
      for (const order of etrx.orders) {
        await TicketingTicket.incrementAvailability(
          order.ticket,
          order.quantity
        );
      }
      await patch(etrx._id, { status: "expired" });
    })
  );
  console.log(results);
};
exports.expireTransactions = expireTransactions;

const refundSuccededTransactionsForParty = async (partyId) => {
  const successfulTransactions = await options.Model.find({
    party: partyId,
    status: "succeeded",
  })
    .populate("ticketingShop") // TODO optimize, its probably the same ticketing shop everytime
    .lean();
  const results = await Promise.allSettled(
    successfulTransactions.map(async (etrx) => {
      await stripeTicketing.refundPaymentIntent(
        etrx.ticketingShop.stripeAccountId,
        etrx.paymentIntent
      );
      await patch(etrx._id, { status: "refunded" });
    })
  );
  console.log(results);
  return results;
};
exports.refundSuccededTransactionsForParty = refundSuccededTransactionsForParty;
/*
(() => {
  setTimeout(async () => {
    console.log("GENERATE TICKETING TRX TEST DATA");
    async function createTrx(date) {
      return await options.Model.create({
        status: "succeeded",
        ticketingShop: new Types.ObjectId("6310d30d0d2d8c0009fe209f"),
        party: new Types.ObjectId("6389fdb021354a0008e0ac5e"),
        user: new Types.ObjectId("630495a1b2b6c90009c9de24"),
        amount: 1234,
        orders: [
          {
            ticket: new Types.ObjectId("6389fdca21354a0008e0ac85"),
            quantity: 1,
          },
        ],
        createdAt: date,
        expiresAt: new Date(),
        paymentIntent: null,
      });
    }
    await createTrx(new Date());
    console.log("SCAN FINISHED");
  }, 1500);
})();
*/