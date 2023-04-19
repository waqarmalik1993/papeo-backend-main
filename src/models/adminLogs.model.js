const mongoose = require("mongoose");
const { Schema } = mongoose;

module.exports = function () {
  const modelName = "adminlogs";
  const schema = new mongoose.Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      usernameLowercase: {
        type: String,
        required: false,
      },
      affectedUser: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: false,
      },
      affectedUserNameLowercase: {
        type: String,
        required: false,
      },
      adminRightUsed: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        required: true,
      },
      data: {},
    },
    {
      // strict: false,
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
