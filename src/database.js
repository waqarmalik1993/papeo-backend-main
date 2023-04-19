const mongoose = require("mongoose");
let conn = null;
module.exports = async function createDatabaseConnection() {
  if (conn == null) {
    conn = mongoose.connect(process.env?.MONGODB_URI, {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      readPreference: "secondaryPreferred",
      bufferCommands: false, // Disable mongoose buffering
      serverSelectionTimeoutMS: 5000,
    });

    // `await`ing connection after assigning to the `conn` variable
    // to avoid multiple function calls creating new connections
    await conn;
    console.log("connected to database");
  } else {
    console.log("reusing database connection");
  }
  mongoose.Promise = global.Promise;
  return conn;
};
