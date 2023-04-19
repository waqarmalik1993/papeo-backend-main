const SwipeSchema = require("../modules/validation/swipes.js").SwipeSchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const Swipe = require("../services/swipes/swipesService.js");
const {createActivityTargetGroup} = require("../services/activities/createActivityTargetGroup");
const {getFriendIdsFromUser, getFollowerIdsFromUser} = require("../services/activities/helper/getTargetGroup");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
module.exports = async (app) => {
  app.post("/swipes", auth, async (req, res, next) => {
    try {
      validate(SwipeSchema.POST, req.body);
      let result = await Swipe.create({ ...req.body, user: req.user._id });
      res.send(result);

      if (result.swipe && result.swipedParty) {
        // TODO do not send notification if party is secret
        await createActivityTargetGroup({
          type: "partyBookmarked",
          otherUsers: [req.user._id],
          parties: [result.swipedParty],
          targetGroups: {
            friends: getFriendIdsFromUser(req.user),
            following: await getFollowerIdsFromUser(req.user._id),
          },
          sendNotification: true,
        });
      }
    } catch (e) {
      next(e);
    }
  });
};
