const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const { papeoError, PAPEO_ERRORS } = require("../modules/errors/errors.js");
const { ImageMentionsSchema } = require("../modules/validation/imageMentions");
const ImageMention = require("../services/imageMention/imageMentionService");
const Upload = require("../services/uploads/uploadsService");
const Party = require("../services/parties/partiesService");
const User = require("../services/users/usersService");
const Activity = require("../services/activities/activitiesService");
const {
  createActivityTargetGroup,
} = require("../services/activities/createActivityTargetGroup");
const {
  getFriendIdsFromUser,
  getFollowerIdsFromUser,
} = require("../services/activities/helper/getTargetGroup");
const AdminLog = require("../services/adminlogs/adminLogsService");

module.exports = async (app) => {
  // POST report is in POST /uploads?type=report...
  app.post(
    "/uploads/:uploadId/mentions/:mentionedUser",
    auth,
    async (req, res, next) => {
      try {
        validate(ImageMentionsSchema.POST, req.body);
        const { location } = req.body;
        let { mentionedUser, uploadId } = req.params;

        const upload = await Upload.get(uploadId);
        if (!upload.post) {
          throw papeoError(PAPEO_ERRORS.MENTION_UPLOAD_HAS_NO_POST);
        }
        console.log(uploadId);
        // TODO soll man nur nutzer markieren auf eigenen bildern?
        /*if (upload.user.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }*/

        const result = await ImageMention.mentionUser(
          req.user._id.toString(),
          mentionedUser,
          uploadId,
          location,
          upload.post
        );

        // Erstellung der Benachrichtigung
        if (result.user.toString() !== result.mentionedUser.toString()) {
          await Activity.create({
            notificationCategories: ["myProfileActivity"],
            user: result.mentionedUser,
            type: "userImageMentioned",
            otherUsers: [result.mentionedUser, result.user],
            posts: [result.post],
            sendNotification: true,
          });
        }

        if (upload.user.toString() !== req.user._id.toString()) {
          await Activity.create({
            notificationCategories: ["myProfileActivity"],
            user: upload.user,
            type: "userWasMentionedInYourUpload",
            otherUsers: [result.mentionedUser, result.user],
            posts: [result.post],
            sendNotification: true,
          });
        }

        if (!result.isPostInSecretParty) {
          await createActivityTargetGroup({
            type: "userImageMentioned",
            otherUsers: [result.mentionedUser, result.user],
            posts: [result.post],
            targetGroups: {
              friends: getFriendIdsFromUser(
                await User.get(result.mentionedUser)
              ),
              following: await getFollowerIdsFromUser(result.mentionedUser),
            },
            sendNotification: true,
          });
        }
        res.send(result);
      } catch (e) {
        next(e);
      }
    }
  );
  app.delete(
    "/uploads/:uploadId/mentions/:mentionedUserId",
    auth,
    async (req, res, next) => {
      try {
        const { mentionedUserId, uploadId } = req.params;
        const mentions = (
          await ImageMention.find({
            query: {
              mentionedUser: mentionedUserId,
              upload: uploadId,
            },
          })
        ).data;
        if (mentions.length === 0)
          throw papeoError(PAPEO_ERRORS.MENTION_DOES_NOT_EXIST);

        const upload = await Upload.get(uploadId);
        if (
          mentions[0].user.toString() !== req.user._id.toString() &&
          mentions[0].mentionedUser.toString() !== req.user._id.toString() &&
          upload.user.toString() !== req.user._id.toString()
        ) {
          if (
            !User.hasAdminRightsTo(req.user, User.adminRights.manageUserLinks)
          ) {
            throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
          }

          await AdminLog.TYPES.removedImageMention({
            userId: req.user._id,
            upload: upload,
            mentionedUser: await User.get(mentionedUserId),
          });
        }

        const response = await ImageMention.remove(mentions[0]._id);
        let result = mentions[0];

        if (req.user._id.toString() != result.mentionedUser.toString()) {
          await Activity.create({
            notificationCategories: ["myProfileActivity"],
            user: result.mentionedUser,
            type: "userImageMentionedDeleted",
            otherUsers: [result.mentionedUser, result.user],
            posts: [result.post],
            sendNotification: true,
          });
        }
        if (upload.user.toString() !== req.user._id.toString()) {
          await Activity.create({
            notificationCategories: ["myProfileActivity"],
            user: upload.user,
            type: "userMentionWasDeletedInYourUpload",
            otherUsers: [result.mentionedUser],
            posts: [result.post],
            sendNotification: true,
          });
        }
        return res.send(response);
      } catch (e) {
        next(e);
      }
    }
  );
  app.get("/posts/:postId/mentions", auth, async (req, res, next) => {
    try {
      const { postId } = req.params;
      let mentions = await ImageMention.MODEL.find({ post: postId }).populate(
        "mentionedUser"
      );
      res.send(mentions);
    } catch (e) {
      next(e);
    }
  });
  app.get("/uploads/:uploadId/mentions", auth, async (req, res, next) => {
    try {
      const { uploadId } = req.params;
      res.send(
        await ImageMention.find({
          query: { ...req.query, upload: uploadId },
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.get("/mentions", auth, async (req, res, next) => {
    try {
      console.log(req.query);
      res.send(await ImageMention.find({ query: { ...req.query } }));
    } catch (e) {
      next(e);
    }
  });
};
