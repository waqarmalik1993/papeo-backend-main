const mongoose = require("mongoose");
const { Schema } = mongoose;

module.exports = function () {
  const modelName = "ratelimiting";
  const schema = new mongoose.Schema(
    {
      bucket: {
        type: String,
        required: true,
      },
      minute: {
        type: Number,
        required: true,
      },
      method: {
        type: String,
        required: true,
      },
      requests: {
        type: Number,
      },
      createdAt: { type: Date, default: Date.now, index: { expires: 120 } },
    },
    {
      timestamps: true,
    }
  );
  schema.index({ bucket: 1, minute: 1, method: 1 });
  // This is necessary to avoid models compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongoose.modelNames().includes(modelName)) {
    mongoose.deleteModel(modelName);
  }
  return mongoose.model(modelName, schema);
};
