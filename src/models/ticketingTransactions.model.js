const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "ticketingTransactions";
  const schema = new mongoose.Schema(
    {
      ticketingShop: {
        type: Schema.Types.ObjectId,
        ref: "ticketingShops",
        required: true,
      },
      party: {
        type: Schema.Types.ObjectId,
        ref: "parties",
        required: true,
      },
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      paymentIntent: { type: String },
      status: { type: String, required: true }, // succeeded, pending, expired
      expiresAt: { type: Date, required: true },
      amount: {
        type: Schema.Types.Number,
        required: true,
      },
      orders: {
        type: [
          {
            ticket: {
              type: Schema.Types.ObjectId,
              ref: "ticketingTickets",
              required: true,
            },
            quantity: {
              type: Schema.Types.Number,
              required: true,
            },
            price: {
              type: {
                gross: { type: Number, required: true },
                net: { type: Number, required: true },
                fees: { type: Number },
                tax: { type: Number, required: true },
                taxPerMille: { type: Number, required: true },
                total: { type: Number, required: true },
              },
            },
          },
        ],
      },
    },
    {
      timestamps: true,
    }
  );
  // This is necessary to avoid models compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongoose.modelNames().includes(modelName)) {
    mongoose.deleteModel(modelName);
  }
  return mongoose.model(modelName, schema);
};
