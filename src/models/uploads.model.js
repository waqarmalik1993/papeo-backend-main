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
  const modelName = "uploads";
  const schema = new mongoose.Schema(
    {
      done: {
        type: Boolean,
        default: false,
      },
      public: {
        type: Boolean,
        default: false,
      },
      path: {
        type: String,
        default: null,
        required: true,
      },
      key: {
        type: String,
        default: null,
        required: true,
      },
      bucket: {
        type: String,
        default: null,
        required: true,
      },
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      party: {
        type: Schema.Types.ObjectId,
        ref: "parties",
      },
      newsletter: {
        type: Schema.Types.ObjectId,
        ref: "newsletter",
      },
      /*
      competition: {
        type: Schema.Types.ObjectId,
        ref: "competitions",
      },*/
      post: {
        type: Schema.Types.ObjectId,
        ref: "posts",
      },
      conversation: {
        type: String,
      },
      message: {
        type: String,
      },
      verifiedUser: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      profilePictureFromUser: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      report: {
        type: Schema.Types.ObjectId,
        ref: "reports",
      },
      profileBannerFromUser: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      allowedChat: {
        type: String,
        default: null,
      },
      mimetype: {
        type: String,
        default: null,
      },
      thumbnail: {
        type: Schema.Types.ObjectId,
        ref: "uploads",
      },
      isThumbnail: {
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
