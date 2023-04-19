const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "referraltree";
  const schema = new mongoose.Schema(
    {
      _id: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      parent: {
        type: Schema.Types.ObjectId,
        ref: "users",
        default: null,
      },
      userData: {
        type: {
          _id: {
            type: Schema.Types.ObjectId,
            required: true,
          },
          username: {
            type: String,
            required: true,
          },
          profilePicture: {
            type: Schema.Types.ObjectId,
            ref: "uploads",
          },
          isDeleted: {
            type: Schema.Types.Boolean,
            default: false,
          },
          referringTransactionsPushEnabled: {
            type: Schema.Types.Boolean,
            default: false,
          },
          isPartyKing: {
            type: Schema.Types.Boolean,
            default: false,
          },
        },
      },
      memberCount: { type: Schema.Types.Number, default: 0 },
      levelCount: { type: Schema.Types.Number, default: 0 },
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
