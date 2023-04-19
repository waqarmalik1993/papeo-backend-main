const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "competitions";
  const schema = new mongoose.Schema(
    {
      name: {
        type: String,
        default: null,
      },
      owner: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      expired: { type: Boolean, default: false },
      sendOnSiteReminder: { type: Boolean, default: false },
      result: {
        type: {},
        default: null,
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
