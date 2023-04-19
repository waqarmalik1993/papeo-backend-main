const auth = require("../middleware/auth.js").auth;
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const Party = require("../services/parties/partiesService");
const Post = require("../services/posts/postsService");
const User = require("../services/users/usersService");
const Activity = require("../services/activities/activitiesService");
const Invites = require("../services/invites/invitesService");
const validate = require("../modules/validation/validate.js");
const { BadRequest } = require("@feathersjs/errors");
const ShareSchema = require("../modules/validation/sharing.js").ShareSchema;
module.exports = async (app) => {
  app.post("/share", auth, async (req, res, next) => {
    try {
      validate(ShareSchema.POST, req.body);
      const { sharedParty, sharedPost, sharedUser, userIds } = req.body;

      for (const user of userIds) {
        if (
          !req.user.partyFriends.find(
            (pf) => pf.friend.toString() === user && pf.status === "accepted"
          )
        ) {
          throw papeoError(PAPEO_ERRORS.USER_IS_NOT_IN_YOUR_FRIEND_LIST);
        }
      }
      if (sharedParty) {
        const party = await Party.get(sharedParty, {
          query: {
            $select: { "+inviteToken": 1 },
          },
        });
        // when secret party, check if user is partyadmin or owner and if true, send inviteToken
        let additionalInformation = undefined;
        if (party.privacyLevel === "secret") {
          const isPartyOwner =
            party.owner.toString() === req.user?._id.toString();
          const isPartyAdmin = !!party.admins?.find(
            (a) => a.user?.toString() === req.user._id.toString()
          );
          if (!isPartyOwner && !isPartyAdmin) {
            throw new BadRequest("You are not allowed to share this party");
          }
          additionalInformation = { inviteToken: party.inviteToken };
        }

        return res.send(
          await Promise.all(
            userIds.map(async (user) => {
              if (!(await Invites.isUserInvited(party._id, user._id))) {
                await Invites.createRaw({
                  user: party.owner,
                  invitedUser: user,
                  party: party._id,
                });
              }
              return await Activity.create({
                user: user,
                notificationCategories: ["sharedContent"],
                type: "sharedParty",
                parties: [party._id],
                otherUsers: [req.user._id],
                sendNotification: true,
                additionalInformation,
              });
            })
          )
        );
      }
      if (sharedPost) {
        const post = await Post.get(sharedPost);
        return res.send(
          await Promise.all(
            userIds.map(async (user) => {
              return await Activity.create({
                user: user,
                notificationCategories: ["sharedContent"],
                type: "sharedPost",
                posts: [post._id],
                otherUsers: [req.user._id],
                sendNotification: true,
              });
            })
          )
        );
      }
      if (sharedUser) {
        const dbSharedUser = await User.get(sharedUser);
        return res.send(
          await Promise.all(
            userIds.map(async (user) => {
              return await Activity.create({
                user: user,
                notificationCategories: ["sharedContent"],
                type: "sharedUser",
                otherUsers: [req.user._id, dbSharedUser._id],
                sendNotification: true,
              });
            })
          )
        );
      }
      throw papeoError(PAPEO_ERRORS.NOT_FOUND);
    } catch (e) {
      next(e);
    }
  });
};
