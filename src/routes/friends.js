const PartySchema = require("../modules/validation/parties.js").PartySchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const User = require("../services/users/usersService.js");
const Activity = require("../services/activities/activitiesService");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
module.exports = async (app) => {
  app.get("/users/:userId/friends", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const user = await User.get(userId);
      let data = user.partyFriends;
      // filter out friend requests if the user wants to access other users friends
      if (
        req.user._id.toString() !== userId ||
        req.query.status === "accepted"
      ) {
        data = data.filter((friend) => friend.status === "accepted");
      }

      if (req.query.$populate && req.query.$populate === "friend") {
        data = await Promise.all(
          data.map(async (friend) => {
            return {
              ...friend,
              friend: {
                ...(await User.get(friend.friend)),
                // TODO Warum funktioniert hier select:false nicht???
                partyFriends: undefined,
                //birthday: undefined,
                homeLocation: undefined,
                currentLocation: undefined,
              },
            };
          })
        );
      }

      res.send({ data });
    } catch (e) {
      next(e);
    }
  });

  app.post("/users/:userId/friends", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      res.send(await User.requestFriendship(req.user._id, userId));
    } catch (e) {
      next(e);
    }
  });
  app.post("/users/:userId/friends/accept", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      res.send(await User.acceptFriendship(req.user._id, userId));
    } catch (e) {
      next(e);
    }
  });

  app.delete("/users/:userId/friends", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const isRealFriend = req.user.partyFriends.find(
        (f) => f.friend.toString() === userId && f.status === "accepted"
      );
      res.send(await User.removeFriend(req.user._id, userId));
      if (isRealFriend) {
        await Activity.create({
          notificationCategories: ["friends"],
          user: userId,
          type: "friendRemoved",
          otherUsers: [req.user._id],
          sendNotification: true,
        });
      }
    } catch (e) {
      next(e);
    }
  });
};
