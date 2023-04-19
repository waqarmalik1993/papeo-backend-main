// uploads-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
const mongoose = require("mongoose");
// users-models.js - A mongoose models
//
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.

let { Schema } = mongoose;

module.exports = function () {
  const modelName = "imagementions";
  const schema = new mongoose.Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      mentionedUser: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      upload: {
        type: Schema.Types.ObjectId,
        ref: "uploads",
      },
      post: {
        type: Schema.Types.ObjectId,
        ref: "posts",
      },
      isPostInSecretParty: {
        type: Schema.Types.Boolean,
        default: false,
      },
      location: {
        xPercent: {
          type: Number,
        },
        yPercent: {
          type: Number,
        },
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
