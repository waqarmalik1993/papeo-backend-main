// users-models.js - A mongoose models
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
  const modelName = "posts";
  const schema = new mongoose.Schema(
    {
      description: { type: String, default: "" },
      sticky: {
        type: Boolean,
        default: false,
      },
      interactionRate: {
        type: Number,
        default: 0,
      },
      deactivated: { type: Boolean, default: false },
      deactivatedByAdmin: { type: Boolean, default: false },
      isPostInSecretParty: { type: Boolean, default: false },
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      type: {
        type: String,
        enum: ["party", "user"],
      },
      party: {
        type: Schema.Types.ObjectId,
        ref: "parties",
      },
      location: {
        type: {
          type: String, // Don't do `{ location: { type: String } }`
          enum: ["Point"], // 'location.type' must be 'Point'
          default: "Point",
        },
        coordinates: {
          type: [Number],
        },
      },
      uploads: [
        {
          type: Schema.Types.ObjectId,
          ref: "uploads",
          default: null,
        },
      ],
      likedBy: [
        {
          type: Schema.Types.ObjectId,
          ref: "users",
        },
      ],
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
