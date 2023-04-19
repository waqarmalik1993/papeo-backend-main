const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "ratings";
  const schema = new mongoose.Schema(
    {
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
      partyOwner: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      comment: { type: String, default: null },
      value: { type: Number, default: null },
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
}
