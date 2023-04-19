const PartySchema = require("../modules/validation/parties.js").PartySchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const Bookmark = require("../services/bookmarks/bookmarksService.js");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const { MessagesSchema } = require("../modules/validation/messages");
const { sendMessage } = require("../services/users/modules/firebase/users");
module.exports = async (app) => {
  app.post("/messages", auth, async (req, res, next) => {
    try {
      validate(MessagesSchema.POST, req.body);
      if (process.env.LOADTEST && req.conversationId) {
        const result = await sendMessage(
          req.conversationId,
          req.user._id.toString(),
          req.user._id.toString(),
          req.body.message
        );
        return res.send(result);
      }
      res.send(500);
    } catch (e) {
      next(e);
    }
  });
};
