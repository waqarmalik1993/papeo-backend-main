const Upload = require("../services/uploads/uploadsService.js");
const Party = require("../services/parties/partiesService.js");
const Post = require("../services/posts/postsService.js");
const Report = require("../services/reports/reportsService.js");
const Rating = require("../services/ratings/ratingsService");
const Comment = require("../services/posts/comments/postCommentsService");
const User = require("../services/users/usersService.js");
const AdminLog = require("../services/adminlogs/adminLogsService");
const Competition = require("../services/competitions/competitionsService");
const validate = require("../modules/validation/validate.js");
const UploadsSchema = require("../modules/validation/uploads.js").UploadsSchema;
const auth = require("../middleware/auth.js").auth;
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const {
  updateFirebaseImageMessage,
  getFirebaseConversation,
} = require("../services/users/modules/firebase/users");
const Activity = require("../services/activities/activitiesService");
const {
  createActivityTargetGroup,
} = require("../services/activities/createActivityTargetGroup");
const {
  getFriendIdsFromUser,
  getFollowerIdsFromUser,
  getPartyAdmins,
  getGuestWaitingPartyUserIds,
  getBookmarkedPartyUserIds,
} = require("../services/activities/helper/getTargetGroup");
const deleteObjectByKey =
  require("../services/uploads/s3.js").deleteObjectByKey;
module.exports = async (app) => {
  app.get("/uploads/getPresignedUrl", auth, async (req, res, next) => {
    try {
      return res.send(await Upload.getPresignedUpload(req.user._id));
    } catch (e) {
      next(e);
    }
  });

  app.get(
    "/uploads/:id",
    /* auth, */ async (req, res, next) => {
      try {
        let { id } = req.params;
        let { preferThumbnail } = req.query;
        const url = await Upload.getPresignedDownloadUrl(
          id,
          preferThumbnail === "true"
        );
        res.send({ url });
      } catch (e) {
        next(e);
      }
    }
  );
  app.get(
    "/uploads/:id/redirect",
    /* auth, */ async (req, res, next) => {
      try {
        let { id } = req.params;
        let { preferThumbnail } = req.query;
        const url = await Upload.getPresignedDownloadUrl(
          id,
          preferThumbnail === "true"
        );
        res.redirect(url);
      } catch (e) {
        next(e);
      }
    }
  );
  app.patch("/uploads/profilepicture", auth, async (req, res, next) => {
    try {
      validate(UploadsSchema.profilePicture, req.body);
      const upload = await Upload.get(req.body.upload);
      if (upload.user.toString() !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      const result = await Upload.patch(req.body.upload, {
        profilePictureFromUser: req.user._id.toString(),
      });
      return res.send(result);
    } catch (e) {
      console.log(e);

      next(e);
    }
  });
  app.post("/uploads/parties/:partyId", auth, async (req, res, next) => {
    try {
      validate(UploadsSchema.party, req.body);
      if (req.user.restrictions.uploadMedia) {
        throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
      }
      const { partyId } = req.params;
      const { uploads } = req.body;
      const party = await Party.get(partyId);

      if (!party) throw papeoError(PAPEO_ERRORS.PARTY_DOES_NOT_EXIST);
      if (party.owner._id.toString() !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.YOU_ARE_NOT_THE_OWNER_OF_THIS_PARTY);
      }

      const dbUploads = await Promise.all(uploads.map((u) => Upload.get(u)));
      // check if user is the owner of all uploads
      for (const u of dbUploads) {
        if (u.user.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
      }

      const result = await Promise.all(
        dbUploads.map(async (u) => {
          return await Upload.patch(u._id, {
            party: partyId,
          });
        })
      );
      return res.send(result);
    } catch (e) {
      console.log(e);

      next(e);
    }
  });
  /*
  app.post(
    "/uploads/competitions/:competitionId",
    auth,
    async (req, res, next) => {
      try {
        validate(UploadsSchema.party, req.body);
        if (req.user.restrictions.uploadMedia) {
          throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
        }
        const { competitionId } = req.params;
        const { uploads } = req.body;
        const competition = await Competition.get(competitionId);

        if (!competition)
          throw papeoError(PAPEO_ERRORS.COMPETITION_DOES_NOT_EXIST);
        if (competition.owner._id.toString() !== req.user._id.toString()) {
          throw papeoError(
            PAPEO_ERRORS.YOU_ARE_NOT_THE_OWNER_OF_THIS_COMPETITION
          );
        }

        const dbUploads = await Promise.all(uploads.map((u) => Upload.get(u)));
        // check if user is the owner of all uploads
        for (const u of dbUploads) {
          if (u.user.toString() !== req.user._id.toString()) {
            throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
          }
        }

        const result = await Promise.all(
          dbUploads.map(async (u) => {
            return await Upload.patch(u._id, {
              competition: competitionId,
            });
          })
        );
        return res.send(result);
      } catch (e) {
        console.log(e);

        next(e);
      }
    }
  );
  */
  app.post("/uploads/posts", auth, async (req, res, next) => {
    try {
      validate(UploadsSchema.post, req.body);
      if (req.user.restrictions.uploadMedia) {
        throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
      }
      const { uploads, party, description, location } = req.body;

      let isPostInSecretParty = false;
      if (party !== undefined) {
        const dbParty = await Party.get(party);
        if (!dbParty) throw papeoError(PAPEO_ERRORS.PARTY_DOES_NOT_EXIST);
        if (dbParty.privacyLevel === "secret") {
          isPostInSecretParty = true;
        }
      }

      const post = await Post.create({
        user: req.user._id,
        description,
        party,
        location,
        type: party === undefined ? "user" : "party",
        isPostInSecretParty,
      });

      const dbUploads = await Promise.all(uploads.map((u) => Upload.get(u)));
      // check if user is the owner of all uploads
      for (const u of dbUploads) {
        if (u.user.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
      }

      const result = await Promise.all(
        dbUploads.map(async (u) => {
          return await Upload.patch(u._id, {
            post: post._id,
          });
        })
      );
      res.send({ ...post, uploads: result });

      if (post.party) {
        let party = await Party.get(post.party);
        if (party.privacyLevel !== "secret") {
          await createActivityTargetGroup({
            type: "newPartyPost",
            otherUsers: [post.user],
            excludeUsers: [post.user],
            parties: [post.party],
            targetGroups: {
              friends: getFriendIdsFromUser(req.user),
              following: await getFollowerIdsFromUser(req.user._id),
              parties: [
                await getGuestWaitingPartyUserIds(party._id),
                await getBookmarkedPartyUserIds(party._id),
                await getPartyAdmins(party),
                party.owner,
              ],
            },
            sendNotification: true,
            posts: [post._id],
          });
        }
      } else {
        await createActivityTargetGroup({
          type: "newProfilePost",
          otherUsers: [post.user],
          excludeUsers: [post.user],
          targetGroups: {
            friends: getFriendIdsFromUser(req.user),
            following: await getFollowerIdsFromUser(req.user._id),
          },
          sendNotification: true,
          posts: [post._id],
        });
      }
    } catch (e) {
      console.log(e);

      next(e);
    }
  });
  app.post("/uploads/reports", auth, async (req, res, next) => {
    try {
      validate(UploadsSchema.report, req.body);
      const {
        uploads,
        reportedParty,
        reportedUser,
        reportedPost,
        reportedRating,
        reportedComment,
        comment,
      } = req.body;
      if (req.user.restrictions.reportMedia) {
        throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
      }

      if (reportedParty) {
        const dbParty = await Party.get(reportedParty);
        if (!dbParty) throw papeoError(PAPEO_ERRORS.PARTY_DOES_NOT_EXIST);
      }
      if (reportedUser) {
        if (!(await User.exists(reportedUser)))
          throw papeoError(PAPEO_ERRORS.USER_DOES_NOT_EXIST);
      }
      if (reportedPost) {
        if (!(await Post.exists(reportedPost)))
          throw papeoError(PAPEO_ERRORS.POST_DOES_NOT_EXIST);
      }
      if (reportedRating) {
        if (!(await Rating.exists(reportedRating)))
          throw papeoError(PAPEO_ERRORS.RATING_DOES_NOT_EXIST);
      }
      if (reportedComment) {
        if (!(await Comment.exists(reportedComment)))
          throw papeoError(PAPEO_ERRORS.COMMENT_DOES_NOT_EXIST);
      }

      const dbUploads = await Promise.all(uploads.map((u) => Upload.get(u)));
      // check if user is the owner of all uploads
      for (const u of dbUploads) {
        if (u.user.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
      }
      const report = await Report.create({
        user: req.user._id,
        comment: comment,
        reportedParty,
        reportedUser,
        reportedPost,
        reportedRating,
        reportedComment,
        uploads: dbUploads.map((u) => u._id),
      });

      const result = await Promise.all(
        dbUploads.map(async (u) => {
          return await Upload.patch(u._id, {
            report: report._id,
          });
        })
      );
      res.send({ ...report, uploads: result });

      if (report.reportedUser) {
        await Activity.create({
          notificationCategories: ["myProfileActivity"],
          user: report.reportedUser,
          type: "userReported",
          sendNotification: true,
        });
      }
    } catch (e) {
      console.log(e);

      next(e);
    }
  });
  app.post("/uploads/messages", auth, async (req, res, next) => {
    try {
      validate(UploadsSchema.message, req.body);
      const { upload, conversation, message } = req.body;
      const dbUpload = await Upload.get(upload);
      if (dbUpload.user.toString() !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      const conversations = await getFirebaseConversation(conversation);
      console.log({ conversations });
      if (!conversations?.members?.includes(req.user._id.toString())) {
        throw papeoError(PAPEO_ERRORS.YOU_ARE_NOT_PART_OF_THIS_CONVERSATION);
      }
      await updateFirebaseImageMessage(conversation, message, dbUpload);
      const result = await Upload.patch(dbUpload._id, {
        message: message,
        conversation: conversation,
      });
      return res.send(result);
    } catch (e) {
      console.log(e);

      next(e);
    }
  });
  app.post("/uploads/verification", auth, async (req, res, next) => {
    try {
      validate(UploadsSchema.verification, req.body);
      const { upload } = req.body;

      const dbUpload = await Upload.get(upload);
      if (dbUpload.user.toString() !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      const result = await Upload.patch(dbUpload._id, {
        verifiedUser: req.user._id,
      });
      return res.send(result);
    } catch (e) {
      console.log(e);

      next(e);
    }
  });

  app.delete("/uploads/:id", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      const upload = await Upload.get(id);
      if (req.user._id.toString() !== upload.user.toString()) {
        if (!User.hasAdminRightsTo(req.user, User.adminRights.manageMedia)) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        await AdminLog.TYPES.deletedMedia({ userId: req.user._id, upload });
      }
      res.send(await Upload.remove(id));
    } catch (e) {
      next(e);
    }
  });
};
