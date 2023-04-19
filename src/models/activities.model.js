const mongoose = require("mongoose");
const { Schema } = mongoose;

module.exports = function () {
  const modelName = "activities";
  const schema = new mongoose.Schema(
    {
      type: {
        type: String,
        required: true,
      },
      subType: {
        type: String,
        default: null,
      },
      notificationCategories: [
        {
          type: String,
          enum: [
            "parties",
            "friends",
            "following",
            "followers",
            "sharedContent",
            "comments",
            "myProfileActivity",
            "membership",
            "other",
          ],
          required: true,
        },
      ],
      linked: [{}],
      additionalInformation: {},
      read: {
        type: Boolean,
        default: false,
      },
      posts: [
        {
          type: Schema.Types.ObjectId,
          ref: "posts",
        },
      ],
      postComments: [
        {
          type: Schema.Types.ObjectId,
          ref: "comments",
        },
      ],
      ratings: [
        {
          type: Schema.Types.ObjectId,
          ref: "ratings",
        },
      ],
      parties: [
        {
          type: Schema.Types.ObjectId,
          ref: "parties",
        },
      ],
      competitions: [
        {
          type: Schema.Types.ObjectId,
          ref: "competitions",
        },
      ],
      newsletter: [
        {
          type: Schema.Types.ObjectId,
          ref: "newsletter",
        },
      ],
      otherUsers: [
        {
          type: Schema.Types.ObjectId,
          ref: "users",
        },
      ],
      userTickets: [
        {
          type: Schema.Types.ObjectId,
          ref: "ticketingUserTickets",
        },
      ],
      user: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      sendNotification: {
        type: Boolean,
        default: false,
      },
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
