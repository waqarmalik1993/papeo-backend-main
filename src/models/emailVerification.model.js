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
  const modelName = "emailverification";
  const schema = new mongoose.Schema({
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
      sparse: true,
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    createdAt: { type: Date, default: Date.now, index: { expires: 900 } },
  });
  // This is necessary to avoid models compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongoose.modelNames().includes(modelName)) {
    mongoose.deleteModel(modelName);
  }
  return mongoose.model(modelName, schema);
}
