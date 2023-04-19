const SwipeSchema = require("../modules/validation/swipes.js").SwipeSchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const Report = require("../services/reports/reportsService.js");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
module.exports = async (app) => {
  // POST report is in POST /uploads?type=report...
  app.get("/reports", auth, async (req, res, next) => {
    try {
      // TODO Admin kann alle reports sehen
      if (req.query.user && req.query.user !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      const result = await Report.find({
        query: { ...req.query, user: req.query.user || req.user._id },
      });
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.delete("/reports/:reportId", auth, async (req, res, next) => {
    try {
      const { reportId } = req.params;
      const report = await Report.get(reportId);
      if (!report) throw papeoError(PAPEO_ERRORS.REPORT_DOES_NOT_EXIST);
      if (report.user._id.toString() !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      res.send(await Report.remove(reportId));
    } catch (e) {
      next(e);
    }
  });
};
