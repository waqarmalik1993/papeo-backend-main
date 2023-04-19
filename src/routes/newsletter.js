const User = require("../services/users/usersService.js");

const Newsletter = require("../services/newsletter/newsletterService");

const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const { NewsletterSchema } = require("../modules/validation/newsletter");
const { BadRequest } = require("@feathersjs/errors");
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;

module.exports = async (app) => {
  app.post("/newsletter", auth, async (req, res, next) => {
    try {
      // TODO NEXT createNewsletter
      if (!User.hasAdminRightsTo(req.user, User.adminRights.createNewsletter)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      validate(NewsletterSchema.POST, req.body);
      return res.send(
        await Newsletter.create({
          ...req.body,
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.patch("/newsletter/:newsletterId", auth, async (req, res, next) => {
    try {
      const { newsletterId } = req.params;
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.editNewsletter) &&
        !User.hasAdminRightsTo(req.user, User.adminRights.createNewsletter)
      ) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      validate(NewsletterSchema.PATCH, req.body);
      return res.send(await Newsletter.patch(newsletterId, req.body));
    } catch (e) {
      next(e);
    }
  });
  app.get("/newsletter", auth, async (req, res, next) => {
    try {
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.editNewsletter) &&
        !User.hasAdminRightsTo(req.user, User.adminRights.createNewsletter)
      ) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      return res.send(await Newsletter.find({ query: req.query }));
    } catch (e) {
      next(e);
    }
  });
  app.get("/newsletter/:newsletterId", auth, async (req, res, next) => {
    try {
      const { newsletterId } = req.params;
      const newsletter = await Newsletter.get(newsletterId);
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.editNewsletter) &&
        !User.hasAdminRightsTo(req.user, User.adminRights.createNewsletter) &&
        newsletter.isPublished === false
      ) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      return res.send(newsletter);
    } catch (e) {
      next(e);
    }
  });
  app.post(
    "/newsletter/:newsletterId/publish",
    auth,
    async (req, res, next) => {
      try {
        const { newsletterId } = req.params;
        if (
          !User.hasAdminRightsTo(req.user, User.adminRights.createNewsletter)
        ) {
          throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
        }
        return res.send(await Newsletter.sendNotificationsAsync(newsletterId));
      } catch (e) {
        next(e);
      }
    }
  );
  app.delete("/newsletter/:newsletterId", auth, async (req, res, next) => {
    try {
      const { newsletterId } = req.params;
      if (!User.hasAdminRightsTo(req.user, User.adminRights.createNewsletter)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      return res.send(await Newsletter.remove(newsletterId));
    } catch (e) {
      next(e);
    }
  });
};
