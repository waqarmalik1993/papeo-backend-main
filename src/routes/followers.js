const PartySchema = require("../modules/validation/parties.js").PartySchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const User = require("../services/users/usersService.js");
const Follower = require("../services/followers/followersService.js");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
module.exports = async (app) => {
  app.get("/users/:userId/followers", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { text_search } = req.query;
      if (!text_search) {
        const result = await Follower.find({
          query: { ...req.query, followedUser: userId },
        });
        return res.send(result);
      }
      let result = await Follower.MODEL.find({
        // ...req.query,
        text_search: undefined,
        followedUser: userId,
      }).populate("user");
      result = result.filter((r) =>
        r.user.usernameLowercase.includes(text_search)
      );
      result.sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      return res.send({
        total: result.length,
        limit: result.length,
        skip: 0,
        data: result,
      });
    } catch (e) {
      next(e);
    }
  });

  app.get("/users/:userId/following", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { text_search } = req.query;
      if (!text_search) {
        const result = await Follower.find({
          query: { ...req.query, user: userId },
        });
        return res.send(result);
      }
      let result = await Follower.MODEL.find({
        // ...req.query,
        text_search: undefined,
        user: userId,
      }).populate("followedUser");
      result = result.filter((r) =>
        r.followedUser.usernameLowercase.includes(text_search)
      );
      result.sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      return res.send({
        total: result.length,
        limit: result.length,
        skip: 0,
        data: result,
      });
    } catch (e) {
      next(e);
    }
  });

  app.delete("/users/:followerId/following", auth, async (req, res, next) => {
    try {
      const { followerId } = req.params;
      res.send(await User.unfollowUser(req.user._id, followerId));
    } catch (e) {
      next(e);
    }
  });

  app.delete("/users/:userId/followers", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      res.send(await User.unfollowUser(userId, req.user._id));
    } catch (e) {
      next(e);
    }
  });

  app.post("/users/:userId/followers", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      res.send(await User.addFollower(req.user._id, userId));
    } catch (e) {
      next(e);
    }
  });
};
