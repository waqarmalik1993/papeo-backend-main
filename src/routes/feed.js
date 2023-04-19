const auth = require("../middleware/auth.js").auth;
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const Feed = require("../services/feed/feedService.js");
const validate = require("../modules/validation/validate.js");
const FeedSchema = require("../modules/validation/feed.js").FeedSchema;
module.exports = async (app) => {
  app.post("/feed", auth, async (req, res, next) => {
    try {
      validate(FeedSchema.POST, req.body);
      const excludeIds = req.body.exclude || [];
      excludeIds.push(
        ...req.user.blockedUsers.map((u) => u.toString()),
        ...req.user.blockedByUsers.map((u) => u.toString())
      );

      const result = await Feed.getFeed(req.user, excludeIds);
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.post("/unauthenticatedfeed", async (req, res, next) => {
    try {
      validate(FeedSchema.unauthenticated.POST, req.body);
      validate(FeedSchema.unauthenticated.POST_QUERY, req.query);
      const excludeIds = req.body.exclude;
      const { lat, long } = req.query;
      const result = await Feed.getUnauthenticatedFeed(
        parseFloat(lat),
        parseFloat(long),
        excludeIds
      );
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
};
