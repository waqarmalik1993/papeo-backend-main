const getErrorsForApiEndpoint = require("../modules/errors/errors.js").getErrorsForApiEndpoint;
module.exports = async (app) => {
  app.get("/errors", async (req, res, next) => {
    res.send(getErrorsForApiEndpoint());
  });
};
