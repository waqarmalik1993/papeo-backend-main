const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "ticketingShops";
  const schema = new mongoose.Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        unique: true,
      },
      stripeAccountId: {
        type: String,
        required: true,
      },
      isActive: {
        type: Boolean,
        default: false,
      },
      cardPaymentsEnabled: {
        type: Boolean,
        default: false,
      },
      transfersEnabled: {
        type: Boolean,
        default: false,
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
