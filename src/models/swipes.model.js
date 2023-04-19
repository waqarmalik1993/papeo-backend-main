const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "swipes";
  const schema = new mongoose.Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      swipedParty: {
        type: Schema.Types.ObjectId,
        ref: "parties",
        default: null,
      },
      swipedUser: {
        type: Schema.Types.ObjectId,
        ref: "users",
        default: null,
      },
      swipe: {
        type: Boolean,
      },
    },
    {
      timestamps: true,
    }
  );
  schema.index({ user: 1, swipedParty: 1 });
  schema.index({ user: 1, swipedUser: 1 });
  // This is necessary to avoid models compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongoose.modelNames().includes(modelName)) {
    mongoose.deleteModel(modelName);
  }
  return mongoose.model(modelName, schema);
};
