const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "payouts";
  const schema = new mongoose.Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      admin: {
        type: Schema.Types.ObjectId,
        ref: "users",
        default: null,
      },
      status: {
        type: Schema.Types.String,
        default: "pending", // pending, enabled, paid, rejected
      },
      email: {
        type: Schema.Types.String,
        required: true,
      },
      amount: {
        type: Schema.Types.Number,
        required: true,
      },
      comment: {
        type: Schema.Types.String,
        default: null,
      },
      minute: {
        type: Schema.Types.Number,
        default: () => Math.round(new Date().getTime() / 60000),
      },
    },
    {
      timestamps: true,
    }
  );
  schema.index({ user: 1, amount: 1, minute: 1 }, { unique: true });
  // This is necessary to avoid models compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongoose.modelNames().includes(modelName)) {
    mongoose.deleteModel(modelName);
  }
  return mongoose.model(modelName, schema);
};
