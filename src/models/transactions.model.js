const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "transactions";
  const schema = new mongoose.Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      }, 
      type: { type: String, default: null },
      amount: { type: Number, default: null },
      direction: {
        type: String,
        required: true,
        enum: ["debit", "credit"],
      },
      data: {}
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
