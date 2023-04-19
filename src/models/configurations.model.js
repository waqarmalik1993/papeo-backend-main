const mongoose = require("mongoose");
const { Schema } = mongoose;

module.exports = function () {
  const modelName = "configurations";
  const schema = new mongoose.Schema(
    {
      key: {
        type: String,
        required: true,
      },
      value: {},
    },
    {
      timestamps: true,
    }
  );
  schema.index({ user: 1, party: 1 });
  // This is necessary to avoid models compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongoose.modelNames().includes(modelName)) {
    mongoose.deleteModel(modelName);
  }
  return mongoose.model(modelName, schema);
};
