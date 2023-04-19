const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "menucards";
  const schema = new mongoose.Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      name: { type: String },
      info: { type: String },
      cashPaymentAllowed: { type: Boolean, default: false },
      isDraft: { type: Boolean, default: true },
      ppPaymentAllowed: { type: Boolean, default: false },
      ppPaymentLimit: { type: Number, default: 0 },
      ppPaymentLimited: { type: Boolean, default: false },
      categories: [
        {
          name: { type: String, required: true },
          upload: {
            type: Schema.Types.ObjectId,
            ref: "uploads",
            default: null,
          },
          articles: [
            {
              name: { type: String, required: true },
              description: { type: String },
              upload: {
                type: Schema.Types.ObjectId,
                ref: "uploads",
                default: null,
              },
              pricePP: { type: Number, default: 0 },
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
      ],
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
