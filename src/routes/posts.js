const Post = require("../services/posts/postsService.js");
const Party = require("../services/parties/partiesService");
const User = require("../services/users/usersService");
const PostComment = require("../services/posts/comments/postCommentsService.js");
const PartyAdminActivity = require("../services/partyAdminActivities/partyAdminActivitiesService");
const AdminLog = require("../services/adminlogs/adminLogsService");
const ImageMention = require("../services/imageMention/imageMentionService");
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const PostsSchema = require("../modules/validation/posts.js").PostsSchema;
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;

const {
  transformComments,
} = require("../services/posts/comments/helper/transformComments");
const {
  getPartyAdmins,
  getPostCommentUserIds,
} = require("../services/activities/helper/getTargetGroup");
const {
  createActivityTargetGroup,
} = require("../services/activities/createActivityTargetGroup");
const Activity = require("../services/activities/activitiesService");

module.exports = async (app) => {
  app.get("/posts/mentioned", auth, async (req, res, next) => {
    try {
      const { mentionedUser } = req.query;
      req.query.$populate = {
        path: "post",
        populate: {
          path: "uploads user",
        },
      };
      let posts = await ImageMention.find({
        query: {
          mentionedUser: mentionedUser || req.user._id,
          isPostInSecretParty: false,
          ...req.query,
        },
      });
      posts.data = posts.data.map((imageMention) => {
        return { ...imageMention.post };
      });
      res.send(posts);
    } catch (e) {
      next(e);
    }
  });
  app.get("/posts/:id", auth, async (req, res, next) => {
    try {
      const { id } = req.params;
      res.send(
        await Post.get(id, {
          query: {
            $populate: {
              path: "user uploads",
            },
          },
        })
      );
    } catch (e) {
      next(e);
    }
  });

  app.patch("/posts/:id", auth, async (req, res, next) => {
    try {
      validate(PostsSchema.PATCH, req.body);
      const { id } = req.params;
      const post = await Post.get(id, {
        query: {
          $populate: {
            path: "party",
          },
        },
      });
      if (post.user.toString() !== req.user._id.toString()) {
        if (!post.party) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        //check if user has adminrights
        if (
          !User.hasRightsTo(
            req.user,
            post.party,
            User.rights.canManagePartyPhotos
          )
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        if (
          req.body.deactivated !== undefined &&
          post.deactivated !== req.body.deactivated
        ) {
          if (req.body.deactivated) {
            await PartyAdminActivity.TYPES.hiddenPost({
              user: req.user,
              party: post.party,
              post: post,
            });
          } else {
            await PartyAdminActivity.TYPES.unhiddenPost({
              user: req.user,
              party: post.party,
              post: post,
            });
          }
        }
      }
      res.send(await Post.patch(id, req.body));
    } catch (e) {
      next(e);
    }
  });

  app.get("/posts", auth, async (req, res, next) => {
    try {
      let shouldFilterDeactivatedPosts = true;

      if (req.query.party) {
        const party = await Party.get(req.query.party);
        if (
          User.hasRightsTo(req.user, party, User.rights.canManagePartyPhotos)
        ) {
          shouldFilterDeactivatedPosts = false;
        }
        if (party.privacyLevel === "secret") {
          const canSeeSecretParty = await Party.userCanSeeSecretParty(
            req.user,
            party
          );
          if (!canSeeSecretParty) {
            req.query.isPostInSecretParty = false;
          }
        }
      } else {
        req.query.isPostInSecretParty = false;
      }
      if (
        (req.query.user && req.user._id.toString() === req.query.user) ||
        req.user.adminRights?.manageMedia
      ) {
        shouldFilterDeactivatedPosts = false;
      }
      const query = { query: req.query };
      if (shouldFilterDeactivatedPosts) {
        query.query.$or = [{ deactivated: false }, { user: req.user._id }];
        // query.query.deactivated = false;
        query.query.deactivatedByAdmin = false;
      }
      let posts = await Post.find(query);
      res.send(posts);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/posts/:id", auth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const post = await Post.get(id);

      if (post.user.toString() !== req.user._id.toString()) {
        const party = await Party.get(post.party);
        if (
          !(await User.hasRightsTo(
            req.user,
            party,
            User.rights.canManagePartyPhotos
          ))
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        await PartyAdminActivity.TYPES.deletedPost({
          user: req.user,
          party,
          post,
        });
        await Activity.create({
          user: post.user,
          otherUsers: [post.user],
          type: "deletedPostByPartyAdmin",
          notificationCategories: ["myProfileActivity"],
          sendNotification: true,
        });
      }
      if (post.type === "party") {
        const party = await Party.get(post.party);
        if (party.owner.toString() !== req.user._id.toString()) {
          await Activity.create({
            user: party.owner,
            otherUsers: [post.user],
            type: "deletedPostByPartyAdmin",
            notificationCategories: ["parties"],
            parties: [party._id],
            sendNotification: true,
          });
        }
      }
      res.send(await Post.remove(id));
    } catch (e) {
      next(e);
    }
  });

  app.get("/posts/:postId/comments", auth, async (req, res, next) => {
    try {
      console.log(req.query?.$sort);
      const { postId } = req.params;
      let allComments = await PostComment.MODEL.find({
        post: postId,
        deactivated: { $ne: true },
      })
        .populate({
          path: "user linkedUsers",
          select: {
            username: 1,
            profilePicture: 1,
          },
        })
        .sort(req.query?.$sort)
        .lean();
      let transformedComments = transformComments(allComments);
      res.send(transformedComments);
    } catch (e) {
      next(e);
    }
  });

  app.delete(
    "/posts/:postId/comments/:commentId",
    auth,
    async (req, res, next) => {
      try {
        const { postId, commentId } = req.params;
        const comment = await PostComment.get(commentId);
        if (comment.user._id.toString() !== req.user._id.toString()) {
          if (
            !User.hasAdminRightsTo(req.user, User.adminRights.manageComments)
          ) {
            throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
          }
          await AdminLog.TYPES.deletedComment({
            userId: req.user._id,
            comment,
          });
        }
        res.send(await PostComment.remove(commentId));

        let post = await Post.get(postId);
        let targetGroups = {
          comments: [post.user, await getPostCommentUserIds(post._id)],
        };

        if (post.party) {
          let party = await Party.get(post.party);
          targetGroups = {
            comments: [
              post.user,
              party.owner,
              await getPartyAdmins(party),
              await getPostCommentUserIds(post._id),
            ],
          };
        }

        await createActivityTargetGroup({
          type: "deletedPostComment",
          otherUsers: [comment.user],
          excludeUsers: [comment.user],
          postComments: [comment._id],
          targetGroups,
          sendNotification: true,
          posts: [comment.post],
          additionalInformation: {
            text: comment.comment,
          },
        });
      } catch (e) {
        next(e);
      }
    }
  );

  app.post("/posts/:postId/comments", auth, async (req, res, next) => {
    try {
      validate(PostsSchema.comments.POST, req.body);
      const { postId } = req.params;
      if (req.user.restrictions.commentMedia) {
        throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
      }
      const posts = await Post.find({
        query: {
          _id: postId,
        },
      });
      if (posts.data.length === 0) {
        throw papeoError(PAPEO_ERRORS.POST_DOES_NOT_EXIST);
      }
      let post = posts.data[0];
      if (User.isBlockedByOrBlocking(req.user, post.user)) {
        throw papeoError(PAPEO_ERRORS.NOT_FOUND);
      }
      const comment = {
        post: postId,
        user: `${req.user._id}`,
        comment: req.body.comment,
        linkedUsers: req.body.linkedUsers,
        parentComment: req.body.parentComment,
      };
      validate(PostsSchema.comments.COMMENT, comment);

      let createdComment = await PostComment.create(comment);
      res.send(createdComment);

      let targetGroups = {
        comments: [post.user, await getPostCommentUserIds(post._id)],
      };
      if (post.party) {
        let party = await Party.get(post.party);
        targetGroups = {
          comments: [
            post.user,
            party.owner,
            await getPartyAdmins(party),
            await getPostCommentUserIds(post._id),
          ],
        };
      }
      await createActivityTargetGroup({
        type: "newPostComment",
        otherUsers: [createdComment.user],
        excludeUsers: [createdComment.user],
        postComments: [createdComment._id],
        targetGroups,
        sendNotification: true,
        posts: [post._id],
        additionalInformation: {
          text: createdComment.comment,
        },
      });
      if (createdComment.linkedUsers) {
        await createActivityTargetGroup({
          type: "newPostCommentMention",
          otherUsers: [createdComment.user],
          excludeUsers: [createdComment.user],
          postComments: [createdComment._id],
          targetGroups: {
            comments: [createdComment.linkedUsers.map((lu) => lu.user)],
          },
          sendNotification: true,
          posts: [post._id],
          additionalInformation: {
            text: createdComment.comment,
          },
        });
      }
    } catch (e) {
      next(e);
    }
  });

  app.patch(
    "/posts/:postId/comments/:commentId",
    auth,
    async (req, res, next) => {
      try {
        validate(PostsSchema.comments.PATCH, req.body);
        let postComment = await PostComment.get(req.params.commentId);
        let post = await Post.get(postComment.post);

        if (postComment.user.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        let patchedComment = await PostComment.patch(postComment._id, req.body);
        res.send(patchedComment);

        let targetGroups = {
          comments: [post.user, await getPostCommentUserIds(post._id)],
        };
        if (post.party) {
          let party = await Party.get(post.party);
          targetGroups = {
            comments: [
              post.user,
              party.owner,
              await getPartyAdmins(party),
              await getPostCommentUserIds(post._id),
            ],
          };
        }

        if (postComment.comment !== patchedComment.comment) {
          await createActivityTargetGroup({
            type: "editPostComment",
            otherUsers: [patchedComment.user],
            excludeUsers: [patchedComment.user],
            postComments: [patchedComment._id],
            targetGroups,
            sendNotification: true,
            posts: [post._id],
            additionalInformation: {
              text: patchedComment.comment,
            },
          });
        }
      } catch (e) {
        next(e);
      }
    }
  );

  app.post("/posts/:postId/like", auth, async (req, res, next) => {
    try {
      const { postId } = req.params;
      const posts = await Post.find({
        query: {
          _id: postId,
        },
      });
      if (posts.data.length === 0) {
        throw papeoError(PAPEO_ERRORS.POST_DOES_NOT_EXIST);
      }
      let post = posts.data[0];

      res.send(await Post.like(postId, req.user._id.toString()));

      if (post.user.toString() !== req.user._id.toString()) {
        await Activity.create({
          notificationCategories: ["myProfileActivity"],
          user: post.user,
          type: "postNewLike",
          posts: [post._id],
          otherUsers: [req.user._id],
          sendNotification: true,
        });
      }
    } catch (e) {
      next(e);
    }
  });
  app.delete("/posts/:postId/like", auth, async (req, res, next) => {
    try {
      const { postId } = req.params;
      const post = await Post.find({
        query: {
          _id: postId,
        },
      });
      if (post.data.length === 0) {
        throw papeoError(PAPEO_ERRORS.POST_DOES_NOT_EXIST);
      }

      res.send(await Post.unlike(postId, req.user._id.toString()));
    } catch (e) {
      next(e);
    }
  });
};
