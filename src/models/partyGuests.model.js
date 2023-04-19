const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "partyguests";
  const schema = new mongoose.Schema(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      username: {
        type: String,
      },
      sex: {
        type: String,
        enum: ["male", "female", "diverse", null],
        default: null,
      },
      status: {
        type: String,
        enum: ["attending", "requested", "declined", null],
        default: null,
        // updated at
      },
      onSite: {
        type: String,
        enum: ["yes", "no", "unknown", "asked_owner"],
        default: "unknown",
      },
      hasPaid: {
        type: Boolean,
        default: false,
      },
      isNewUser: {
        type: Boolean,
        default: false,
      },
      isNewPartyGuest: {
        type: Boolean,
        default: true,
      },
      isUserVerified: {
        type: Boolean,
        default: false,
      },
      showedOnSiteNotification: {
        type: Date,
        default: null,
      },
      showedPartyRatingNotification: {
        type: Boolean,
        default: false,
      },
      showedPartyReminderNotification: {
        type: Boolean,
        default: false,
      },
      reminder: {
        type: Boolean,
        default: true,
      },
      party: {
        type: Schema.Types.ObjectId,
        ref: "parties",
      },
      colorGroup: {
        type: String,
        enum: [
          "default",
          "primary",
          "yellow",
          "green",
          "blue",
          "purple",
          "pink",
        ],
        default: "default",
      },
      expired: { type: Boolean, default: false },
      isDeleted: { type: Boolean, default: false },
      expired12h: { type: Boolean, default: false },
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
