const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "comments";
  const schema = new mongoose.Schema(
    {
      post: {
        type: Schema.Types.ObjectId,
        ref: "posts",
        required: true,
      },
      parentComment: {
        type: Schema.Types.ObjectId,
        ref: "comments",
        default: null
      },
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      linkedUsers: [{
        alias: {
          type: String, 
          default: null
        },
        user: {
          type: Schema.Types.ObjectId,
          ref: "users",
        }
      }],
      comment: { type: String, default: null },
      deactivated: { type: Boolean, default: false },
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
