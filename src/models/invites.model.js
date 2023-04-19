const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "invites";
  const schema = new mongoose.Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      invitedUser: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      party: {
        type: Schema.Types.ObjectId,
        ref: "parties",
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
}
