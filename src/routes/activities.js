const auth = require("../middleware/auth.js").auth;
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const Activity = require("../services/activities/activitiesService");
const validate = require("../modules/validation/validate.js");
const { ActivitySchema } = require("../modules/validation/activities.js");
module.exports = async (app) => {
  app.get("/activities/header", auth, async (req, res, next) => {
    try {
      let calculatedResult = await calculateHeaderCount(req.user);
      res.send(calculatedResult);
    } catch (e) {
      next(e);
    }
  });

  app.post("/activities", auth, async (req, res, next) => {
    try {
      validate(ActivitySchema.FEED, req.body);
      let query = {};
      if (req.body?.categories?.length) {
        let categorySearchArray = [];
        req.body?.categories.forEach((category) => {
          categorySearchArray.push({
            notificationCategories: category,
          });
        });
        query.$or = categorySearchArray;
      }
      query.$sort = {
        createdAt: -1,
      };
      query.user = req.user._id;
      if (req.query.$skip) query.$skip = req.query.$skip;
      if (req.query.$limit) query.$limit = req.query.$limit;
      if (req.query.read) query.read = req.query.read;
      let foundActivities = await Activity.find({
        query,
        lang: req.query.lang || req.user.languageSetting || "de",
      });
      return res.send(foundActivities);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/activities/:activityId", auth, async (req, res, next) => {
    try {
      validate(ActivitySchema.READ, req.body);
      let id = req.params.activityId;

      let doesOwn = await Activity.MODEL.findOne({
        _id: id,
        user: req.user._id,
      });
      if (!doesOwn) throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);

      let patchedActivity = await Activity.patch(id, req.body);
      res.send(patchedActivity);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/activities/", auth, async (req, res, next) => {
    try {
      validate(ActivitySchema.READ, req.body);
      const filter = { user: req.user._id };
      if (req.query.notificationCategory) {
        filter.notificationCategories = { $in: req.query.notificationCategory };
      }
      await Activity.MODEL.updateMany(filter, {
        read: true,
      });
      res.send("Worked");
    } catch (e) {
      next(e);
    }
  });
};

const calculateHeaderCount = async (user) => {
  let result = await Promise.all([
    Activity.MODEL.countDocuments({
      user: user._id,
      read: false,
    }),
    Activity.MODEL.countDocuments({
      user: user._id,
      read: false,
      notificationCategories: { $in: "parties" },
    }),
    Activity.MODEL.countDocuments({
      user: user._id,
      read: false,
      notificationCategories: { $in: "friends" },
    }),
    Activity.MODEL.countDocuments({
      user: user._id,
      read: false,
      notificationCategories: { $in: "following" },
    }),
    Activity.MODEL.countDocuments({
      user: user._id,
      read: false,
      notificationCategories: { $in: "followers" },
    }),
    Activity.MODEL.countDocuments({
      user: user._id,
      read: false,
      notificationCategories: { $in: "sharedContent" },
    }),
    Activity.MODEL.countDocuments({
      user: user._id,
      read: false,
      notificationCategories: { $in: "comments" },
    }),
    Activity.MODEL.countDocuments({
      user: user._id,
      read: false,
      notificationCategories: { $in: "myProfileActivity" },
    }),
    Activity.MODEL.countDocuments({
      user: user._id,
      read: false,
      notificationCategories: { $in: "membership" },
    }),
    Activity.MODEL.countDocuments({
      user: user._id,
      read: false,
      notificationCategories: { $in: "other" },
    }),
  ]);

  return {
    all: result[0],
    parties: result[1],
    friends: result[2],
    following: result[3],
    followers: result[4],
    sharedContent: result[5],
    comments: result[6],
    myProfileActivity: result[7],
    membership: result[8],
    other: result[9],
  };
};
