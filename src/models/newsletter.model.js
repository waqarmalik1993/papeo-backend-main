const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "newsletter";
  const schema = new mongoose.Schema(
    {
      isDraft: {
        type: Schema.Types.Boolean,
        default: true,
      },
      isEdited: {
        type: Schema.Types.Boolean,
        default: false,
      },
      title: {
        type: Schema.Types.String,
      },
      content: {
        type: Schema.Types.String,
      },
      audience: {
        type: Schema.Types.String,
        default: "all_users", // all_users, new_users, existing_users
      },
      upload: {
        type: Schema.Types.ObjectId,
        ref: "uploads",
        default: null,
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
