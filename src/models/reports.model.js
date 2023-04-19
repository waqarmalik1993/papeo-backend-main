const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "reports";
  const schema = new mongoose.Schema(
    {
      reportedUser: {
        type: Schema.Types.ObjectId,
        ref: "users",
        default: null,
      },
      openReports: {
        type: Number,
        default: 0,
      },
      reports: [
        {
          type: {
            type: String,
            enum: ["party", "user", "post", "rating", "comment"],
            default: null,
          },
          user: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
          },
          reportedParty: {
            type: Schema.Types.ObjectId,
            ref: "parties",
            default: null,
          },
          reportedUser: {
            type: Schema.Types.ObjectId,
            ref: "users",
            default: null,
          },
          reportedPost: {
            type: Schema.Types.ObjectId,
            ref: "posts",
            default: null,
          },
          reportedRating: {
            type: Schema.Types.ObjectId,
            ref: "ratings",
            default: null,
          },
          reportedComment: {
            type: Schema.Types.ObjectId,
            ref: "comments",
            default: null,
          },
          comment: { type: String, default: null },
          translation: { type: String, default: null },
          uploads: [
            {
              type: Schema.Types.ObjectId,
              ref: "uploads",
              default: null,
            },
          ],
          status: {
            type: String,
            enum: ["open", "approved", "declined"],
            default: "open",
          },
          reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: "users",
            default: null,
          },
          reviewedTimestamp: {
            type: Date,
            default: null,
          },
          createdAt: {
            type: Date,
            default: Date.now,
          },
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
