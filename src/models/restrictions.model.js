const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "restrictions";
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
        required: true,
      },
      restriction: {
        type: String,
        enum: [
          "reportMedia",
          "createParties",
          "uploadMedia",
          "commentMedia",
          "participateInParties",
          "login",
        ],
        required: true,
      },
      messageToUser: {
        type: String,
      },
      durationInMinutes: {
        type: Number,
      },
      reason: {
        type: String,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      expired: {
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
