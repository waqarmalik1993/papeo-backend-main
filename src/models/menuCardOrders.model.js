const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "menucardorders";
  const schema = new mongoose.Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      ticketingShop: {
        type: Schema.Types.ObjectId,
        ref: "ticketingshops",
        default: null,
      },
      menuCard: {
        type: Schema.Types.ObjectId,
        ref: "menucards",
        required: true,
      },
      party: {
        type: Schema.Types.ObjectId,
        ref: "parties",
        required: true,
      },
      note: { type: String, default: null },
      paymentMethod: {
        type: String,
        enum: ["cash", "partyPoints", "card"],
        required: true,
      },
      status: {
        type: String,
        enum: ["pending", "successful", "failed", "declined"],
        default: "pending",
      },
      paymentIntent: {
        type: String,
        default: null,
      },
      staff: {
        type: Schema.Types.ObjectId,
        ref: "users",
        default: null,
      },
      favorite: { type: Boolean, default: false },
      qrCodeValue: {
        type: String,
        required: true,
      },
      orders: {
        type: [
          {
            articleId: {
              type: Schema.Types.ObjectId,
              required: true,
            },
            quantity: {
              type: Schema.Types.Number,
              required: true,
            },
            categoryName: { type: String, required: true },
            article: {},
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
