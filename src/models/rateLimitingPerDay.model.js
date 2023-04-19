const mongoose = require("mongoose");
const { Schema } = mongoose;

module.exports = function () {
  const modelName = "ratelimitingperday";
  const schema = new mongoose.Schema(
    {
      bucket: {
        type: String,
        required: true,
      },
      day: {
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
      createdAt: { type: Date, default: Date.now, index: { expires: 86400 } }, // day
    },
    {
      timestamps: true,
    }
  );
  schema.index({ bucket: 1, day: 1, method: 1 });
  // This is necessary to avoid models compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongoose.modelNames().includes(modelName)) {
    mongoose.deleteModel(modelName);
  }
  return mongoose.model(modelName, schema);
};
