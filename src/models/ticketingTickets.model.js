const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "ticketingTickets";
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
      name: { type: String, required: true },
      availability: { type: Number, required: true },
      totalAvailability: { type: Number, required: true },
      sellingStartDate: { type: Date, required: true },
      sellingEndDate: { type: Date, required: true },
      paused: { type: Boolean, default: false },
      deleted: { type: Boolean, default: false },
      visibility: {
        type: {
          hostOnly: { type: Boolean, default: false },
          adminsOnly: { type: Boolean, default: false },
          friendsOnly: { type: Boolean, default: false },
          guestlistOnly: { type: Boolean, default: false },
        },
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
      bought: { type: Number, default: 0 },
      
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
