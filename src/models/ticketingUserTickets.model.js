const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "ticketingUserTickets";
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
      usernameLowercase: { type: String },
      checkedIn: { type: Boolean, default: false },
      checkedInDate: { type: Date, default: null },
      sharedWith: {
        type: Schema.Types.ObjectId,
        ref: "users",
        default: null,
      },
      ticket: {
        type: Schema.Types.ObjectId,
        ref: "ticketingTickets",
        required: true,
      },
      qrCodeValue: {
        type: String,
        required: true,
      },
      refunded: { type: Boolean, default: false },
      purchasedPrice: { type: Number, required: true },
      allowExternalSharing: { type: Boolean, required: true },
      allowInternalSharing: { type: Boolean, required: true },
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
