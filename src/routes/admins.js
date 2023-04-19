const User = require("../services/users/usersService.js");
const { removeAccessToken } = require("../services/users/modules/fcmToken");
const Party = require("../services/parties/partiesService");
const Post = require("../services/posts/postsService");
const PartyGuest = require("../services/partyGuests/partyGuestsService");
const Reports = require("../services/reports/reportsService");
const Activity = require("../services/activities/activitiesService");
const {
  getAllSuperAdmins,
} = require("../services/activities/helper/getTargetGroup");
const authenticate = require("../services/users/authenticate.js");
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const { AdminSchema } = require("../modules/validation/admins");
const { UserSchema } = require("../modules/validation/users");
const usersService = require("../services/users/usersService.js");
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;
const {
  ADMIN_USER_LOGIN,
} = require("../modules/notifications/push/internationalization");
const AdminLog = require("../services/adminlogs/adminLogsService");
const Configuration = require("../services/configuration/configurationsService");
const Restriction = require("../services/restrictions/restrictionsService");
const Transaction = require("../services/transactions/transactionsService");
const Upload = require("../services/uploads/uploadsService");
const Rating = require("../services/ratings/ratingsService");
const Comment = require("../services/posts/comments/postCommentsService");
const {
  revenuecatCreatePromotionalEntitlement,
  revenuecatRevokePromotionalEntitlement,
  revenuecatGetSubscriber,
} = require("../services/integrations/revenuecat/webhook");
const {
  sendNotificationToUser,
} = require("../modules/notifications/push/sendNotification");
const {
  sendRawMessage,
} = require("../modules/notifications/emails/sendUserNotifications");
module.exports = async (app) => {
  app.post("/admins/:userId", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageAdmins)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      await AdminLog.TYPES.addedAdmin({
        userId: req.user._id,
        admin: await User.get(userId),
      });
      await Activity.create({
        notificationCategories: ["myProfileActivity"],
        user: userId,
        otherUsers: [req.user._id],
        type: "addedAdmin",
        sendNotification: true,
      });
      return res.send(
        await User.patch(userId, {
          isAdmin: true,
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.patch("/admins/:userId", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      validate(AdminSchema.PATCH, req.body);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageAdmins)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      const adminUser = await User.get(userId);
      if (!adminUser.isAdmin) {
        throw papeoError(PAPEO_ERRORS.THIS_USER_IS_NOT_AN_ADMIN);
      }
      await AdminLog.TYPES.changedAdminRights({
        userId: req.user._id,
        admin: await User.get(userId),
        oldRights: adminUser.adminRights,
        newRights: req.body,
      });
      return res.send(
        await User.patch(userId, {
          adminRights: req.body,
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.delete("/admins/:userId", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageAdmins)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      await AdminLog.TYPES.removedAdmin({
        userId: req.user._id,
        admin: await User.get(userId),
      });
      return res.send(
        await User.patch(userId, {
          isAdmin: false,
          adminRights: {
            manageUserProfiles: false,
            manageUserLinks: false,
            muteUser: false,
            lockUser: false,
            advancedMemberSearch: false,
            deleteRating: false,
            deleteUserFinally: false,
            manageMedia: false,
            manageComments: false,
            manageParties: false,
            inviteGuestsToParties: false,
            managePartyPoints: false,
            manageMembership: false,
            editTranslation: false,
            changeTC: false,
            manageMainMenu: false,
            rateVideoIdent: false,
            manageViolationReports: false,
            viewStatistics: false,
            viewAdminLog: false,
            manageAdmins: false,
            canSeeSecretParties: false,
            loginAsUser: false,
            createUserProfiles: false,
          },
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.get("/admins", auth, async (req, res, next) => {
    try {
      console.log(req.query);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageAdmins)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      // group count by type of logs
      function countByKey(array, key) {
        const counts = {};
        for (const element of array) {
          counts[element[key]] = (counts[element[key]] || 0) + 1;
        }
        return counts;
      }
      function translateLogsCountsToRightCounts(logCounts) {
        const result = {};
        Object.keys(logCounts).forEach((lc) => {
          result[AdminLog.typesToRightsMap[lc]] = logCounts[lc];
        });
        return result;
      }
      const admins = await User.MODEL.find({
        isAdmin: true,
      }).select("+adminRights");

      const result = await Promise.all(
        admins.map(async (a) => {
          const logs = await AdminLog.MODEL.find({ user: a._id }).select(
            "type"
          );
          return {
            ...a.toObject(),
            rightsUsedCount: translateLogsCountsToRightCounts(
              countByKey(logs, "type")
            ),
          };
        })
      );
      return res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.get("/admins/superadmins", auth, async (req, res, next) => {
    try {
      console.log(req.query);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageAdmins)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      return res.send(
        await User.MODEL.find({
          isAdmin: true,
          $or: [{ isSuperAdmin: true }, { "adminRights.manageAdmins": true }],
        }).select("+adminRights")
      );
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/users/:userId/lock", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      validate(AdminSchema.lockUser, req.body);
      const { reason, messageToUser } = req.body;
      if (!User.hasAdminRightsTo(req.user, User.adminRights.lockUser)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      await AdminLog.TYPES.lockedUser({
        userId: req.user._id,
        lockedUser: await User.get(userId),
        reason,
        messageToUser,
      });
      if (messageToUser) {
        await sendNotificationToUser(userId, "Papeo", messageToUser, {});
      }
      return res.send(
        await User.patch(userId, {
          locked: true,
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.delete("/admins/users/:userId/lock", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!User.hasAdminRightsTo(req.user, User.adminRights.lockUser)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      await AdminLog.TYPES.unlockedUser({
        userId: req.user._id,
        unlockedUser: await User.get(userId),
      });
      return res.send(
        await User.patch(userId, {
          locked: false,
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/posts/:id/hide", auth, async (req, res, next) => {
    try {
      const { id } = req.params;
      validate(AdminSchema.deleteReason, req.body);
      const { reason } = req.body;
      const post = await Post.get(id);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageMedia)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      await AdminLog.TYPES.hiddenPost({ userId: req.user._id, post, reason });
      await Activity.create({
        user: post.user,
        otherUsers: [post.user],
        type: "hiddenPostByAdmin",
        additionalInformation: { reason: reason },
        notificationCategories: ["myProfileActivity"],
        posts: [post._id],
        sendNotification: true,
      });
      if (post.type === "party") {
        const party = await Party.get(post.party);
        await Activity.create({
          user: party.owner,
          otherUsers: [post.user],
          type: "hiddenPostByAdmin",
          additionalInformation: { reason: reason },
          notificationCategories: ["parties"],
          parties: [party._id],
          posts: [post._id],
          sendNotification: true,
        });
      }
      res.send(await Post.patch(id, { deactivatedByAdmin: true }));
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/posts/:id/unhide", auth, async (req, res, next) => {
    try {
      const { id } = req.params;
      validate(AdminSchema.deleteReason, req.body);
      const { reason } = req.body;
      const post = await Post.get(id);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageMedia)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      await AdminLog.TYPES.unhiddenPost({ userId: req.user._id, post, reason });
      res.send(await Post.patch(id, { deactivatedByAdmin: false }));
    } catch (e) {
      next(e);
    }
  });
  app.delete("/admins/posts/:id", auth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const post = await Post.get(id);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageMedia)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      await AdminLog.TYPES.deletedPost({ userId: req.user._id, post });
      res.send(await Post.remove(id));
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/parties/:id/delete", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      validate(AdminSchema.deleteParty, req.body);
      const { reason, messageToUsers } = req.body;
      const party = await Party.get(id);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageParties)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      if (messageToUsers) {
        const partyGuests = await PartyGuest.MODEL.find({
          party: id,
          status: "attending",
        });
        // TODO NOTIFICATIONS
        await Promise.all(
          partyGuests.map(async (pg) => {
            return sendNotificationToUser(
              pg.user.toString(),
              "Papeo",
              messageToUsers,
              {}
            );
          })
        );
      }
      await AdminLog.TYPES.deletedParty({
        userId: req.user._id,
        party,
        reason,
        messageToUsers,
      });
      res.send(await Party.remove(id));
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/parties/:id/tag/delete", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      validate(AdminSchema.deletePartyTag, req.body);
      const { tag } = req.body;
      const party = await Party.get(id);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageParties)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }

      await AdminLog.TYPES.deletedPartyTag({
        userId: req.user._id,
        party,
        tag,
      });
      res.send(
        await Party.patch(id, {
          $pull: {
            tags: tag,
          },
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.patch("/admins/parties/:id", auth, async (req, res, next) => {
    try {
      validate(AdminSchema.patchParty, req.body);
      let { id } = req.params;
      const { type, privacyLevel, messageToOwner } = req.body;
      const party = await Party.get(id);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageParties)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      const result = await Party.patch(id, {
        ...req.body,
        messageToOwner: undefined,
      });
      if (messageToOwner) {
        await sendNotificationToUser(
          party.owner.toString(),
          "Papeo",
          messageToOwner,
          {}
        );
      }
      await AdminLog.TYPES.patchedParty({
        userId: req.user._id,
        party,
        type,
        privacyLevel,
        messageToOwner,
      });
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.put("/termsofservice", auth, async (req, res, next) => {
    try {
      validate(AdminSchema.putTOS, req.body);
      validate(AdminSchema.putTOSQuery, req.query);
      let { termsOfService } = req.body;
      const { lang } = req.query;

      if (!User.hasAdminRightsTo(req.user, User.adminRights.changeTC)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      let oldTOS = await Configuration.MODEL.findOne({ key: "termsOfService" });
      if (!oldTOS) {
        oldTOS = await Configuration.create({
          key: "termsOfService",
          value: {},
        });
      }
      const result = await Configuration.patch(oldTOS._id, {
        [`value.${lang}`]: termsOfService,
      });
      await AdminLog.TYPES.changedTermsOfService({
        userId: req.user._id,
        oldTOS: oldTOS,
        newTOS: termsOfService,
      });
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.get("/termsofservice", async (req, res, next) => {
    try {
      const { lang } = req.query;
      const tos = await Configuration.MODEL.findOne({ key: "termsOfService" });
      if (lang) return res.send(tos.value[lang]);
      res.send(tos);
    } catch (e) {
      next(e);
    }
  });
  app.get("/privacyterms", async (req, res, next) => {
    try {
      const { lang } = req.query;
      const privacyTerms = await Configuration.MODEL.findOne({
        key: "privacyTerms",
      });
      if (lang) return res.send(privacyTerms.value[lang]);
      res.send(privacyTerms);
    } catch (e) {
      next(e);
    }
  });
  app.get("/partypointsconfig", async (req, res, next) => {
    try {
      const partyPointsConfig = await Configuration.MODEL.findOne({
        key: "partyPoints",
      });
      res.send(partyPointsConfig.value);
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/users/:userId/mute", auth, async (req, res, next) => {
    try {
      let { userId } = req.params;
      validate(AdminSchema.muteUser, req.body);
      const { reason, messageToUser, restrictions, durationInMinutes } =
        req.body;

      if (!User.hasAdminRightsTo(req.user, User.adminRights.muteUser)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }

      res.send(
        await Promise.all(
          restrictions.map(async (restriction) => {
            await AdminLog.TYPES.mutedUser({
              userId: req.user._id,
              restrictedUser: await User.get(userId),
              restriction,
              durationInMinutes,
              messageToUser,
              reason,
            });
            return await Restriction.restrictUser({
              userId,
              adminUserId: req.user._id,
              restriction,
              durationInMinutes,
              messageToUser,
              reason,
            });
          })
        )
      );
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/users/:userId/unmute", auth, async (req, res, next) => {
    try {
      let { userId } = req.params;
      validate(AdminSchema.unmuteUser, req.body);
      const { restrictionIds } = req.body;

      if (!User.hasAdminRightsTo(req.user, User.adminRights.muteUser)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }

      res.send(
        await Promise.all(
          restrictionIds.map(async (restrictionId) => {
            const restriction = await Restriction.get(restrictionId);
            await AdminLog.TYPES.unmutedUser({
              userId: req.user._id,
              restrictedUser: await User.get(userId),
              restriction: restriction.restriction,
            });
            return await Restriction.removeRestrictionFromUser(
              userId,
              restriction
            );
          })
        )
      );
    } catch (e) {
      next(e);
    }
  });
  app.get(
    "/admins/users/:userId/restrictions",
    auth,
    async (req, res, next) => {
      try {
        let { userId } = req.params;

        if (!User.hasAdminRightsTo(req.user, User.adminRights.muteUser)) {
          throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
        }

        res.send(
          await Restriction.find({
            query: {
              user: userId,
              ...req.query,
              $populate: {
                path: "admin",
              },
              $sort: {
                createdAt: -1,
              },
            },
          })
        );
      } catch (e) {
        next(e);
      }
    }
  );
  app.post(
    "/admins/users/:userId/transactions/credit",
    auth,
    async (req, res, next) => {
      try {
        const { userId } = req.params;
        validate(AdminSchema.adminTransaction, req.body);
        if (
          !User.hasAdminRightsTo(req.user, User.adminRights.managePartyPoints)
        ) {
          throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
        }
        const { amount, reason } = req.body;
        const user = await User.get(userId);
        await AdminLog.TYPES.adminCredit({
          creditedUser: await User.get(userId),
          amount: amount,
          userId: req.user._id,
          reason,
        });
        res.send(
          await Transaction.TYPES.adminCredit({
            user,
            points: amount,
            reason,
          })
        );
      } catch (e) {
        next(e);
      }
    }
  );
  app.post(
    "/admins/parties/:partyId/guests/transactions/credit",
    auth,
    async (req, res, next) => {
      try {
        const { partyId } = req.params;
        validate(AdminSchema.adminTransaction, req.body);
        if (
          !User.hasAdminRightsTo(req.user, User.adminRights.managePartyPoints)
        ) {
          throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
        }
        const { amount, reason } = req.body;

        const partyGuests = await PartyGuest.MODEL.find({
          party: partyId,
          status: "attending",
        });
        const result = await Promise.all(
          partyGuests.map(async (pg) => {
            const user = await User.get(pg.user);
            await AdminLog.TYPES.adminCredit({
              debitedUser: user,
              amount: amount,
              userId: req.user._id,
              reason,
            });
            return Transaction.TYPES.adminCredit({
              user: user,
              points: amount,
              reason,
            });
          })
        );
        res.send(result);
      } catch (e) {
        next(e);
      }
    }
  );
  app.post(
    "/admins/parties/:partyId/guests/verified/transactions/credit",
    auth,
    async (req, res, next) => {
      try {
        const { partyId } = req.params;
        validate(AdminSchema.adminTransaction, req.body);
        if (
          !User.hasAdminRightsTo(req.user, User.adminRights.managePartyPoints)
        ) {
          throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
        }
        const { amount, reason } = req.body;

        const partyGuests = await PartyGuest.MODEL.find({
          party: partyId,
          status: "attending",
          isUserVerified: true,
        });
        const result = await Promise.all(
          partyGuests.map(async (pg) => {
            const user = await User.get(pg.user);
            await AdminLog.TYPES.adminCredit({
              debitedUser: user,
              amount: amount,
              userId: req.user._id,
              reason,
            });
            return Transaction.TYPES.adminCredit({
              user: user,
              points: amount,
              reason,
            });
          })
        );
        res.send(result);
      } catch (e) {
        next(e);
      }
    }
  );
  app.post(
    "/admins/users/:userId/transactions/debit",
    auth,
    async (req, res, next) => {
      try {
        const { userId } = req.params;
        validate(AdminSchema.adminTransaction, req.body);
        if (
          !User.hasAdminRightsTo(req.user, User.adminRights.managePartyPoints)
        ) {
          throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
        }
        const { amount, reason } = req.body;
        const user = await User.get(userId);
        await AdminLog.TYPES.adminDebit({
          debitedUser: user,
          amount: amount,
          userId: req.user._id,
          reason,
        });
        res.send(
          await Transaction.TYPES.adminDebit({
            user,
            points: amount,
            reason,
          })
        );
      } catch (e) {
        next(e);
      }
    }
  );
  app.get("/admins/logs", auth, async (req, res, next) => {
    try {
      if (!User.hasAdminRightsTo(req.user, User.adminRights.viewAdminLog)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      console.log(req.query);
      if (req.query.text_search) {
        if (Array.isArray(req.query.$or)) {
          req.query.$or.push({
            usernameLowercase: new RegExp(req.query.text_search, "i"),
          });
        } else {
          req.query.$or = [
            {
              usernameLowercase: new RegExp(req.query.text_search, "i"),
            },
          ];
        }
        if (
          !req.query.searchUsersOnly ||
          req.query.searchUsersOnly === "false"
        ) {
          req.query.$or.push({
            affectedUserNameLowercase: new RegExp(req.query.text_search, "i"),
          });
        }
        delete req.query.searchUsersOnly;
        delete req.query.text_search;
      }
      if (req.query.relatedRole) {
        req.query.adminRightUsed = [];
        const rolePresets = await Configuration.MODEL.findOne({
          key: "adminRolePresets",
        });

        if (Array.isArray(req.query.relatedRole)) {
          req.query.relatedRole.map((relatedRoleIndex) => {
            const rolePreset =
              rolePresets.value.adminRolePresets[parseInt(relatedRoleIndex)];
            req.query.adminRightUsed.push(
              ...Object.keys(rolePreset)
                .filter((key) => key !== "name")
                .filter((key) => rolePreset[key])
            );
          });
        } else {
          const rolePreset =
            rolePresets.value.adminRolePresets[parseInt(req.query.relatedRole)];
          req.query.adminRightUsed.push(
            ...Object.keys(rolePreset)
              .filter((key) => key !== "name")
              .filter((key) => rolePreset[key])
          );
        }
        delete req.query.relatedRole;
      }
      const result = await AdminLog.find({
        query: {
          ...req.query,
        },
      });
      // for users which are no longer in the db
      result.data = result.data.map((data) => {
        if (req.query.$populate === "user" && data.user === null) {
          return {
            ...data,
            user: {
              _id: "000000000000000000000000",
              username: "DELETED USER",
            },
          };
        }
        return data;
      });
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.get("/admins/users/search", auth, async (req, res, next) => {
    try {
      console.log(req.query);
      if (req.query.sex) {
        if (!Array.isArray(req.query.sex)) req.query.sex = [req.query.sex];
      }
      if (req.query.include) {
        if (!Array.isArray(req.query.include))
          req.query.include = [req.query.include];
      }
      validate(UserSchema.adminSearch, req.query);
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.advancedMemberSearch)
      ) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      res.send(await User.adminSearch(req.user, req.query));
    } catch (e) {
      next(e);
    }
  });
  app.post(
    "/admins/users/:reportedUserId/reports/:reportId/approve",
    auth,
    async (req, res, next) => {
      try {
        const { reportedUserId, reportId } = req.params;
        if (
          !User.hasAdminRightsTo(
            req.user,
            User.adminRights.manageViolationReports
          )
        ) {
          throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
        }
        await Reports.approveReport(req.user, reportedUserId, reportId);
        res.send("OK");
      } catch (e) {
        next(e);
      }
    }
  );
  app.post(
    "/admins/users/:reportedUserId/reports/:reportId/decline",
    auth,
    async (req, res, next) => {
      try {
        const { reportedUserId, reportId } = req.params;
        if (
          !User.hasAdminRightsTo(
            req.user,
            User.adminRights.manageViolationReports
          )
        ) {
          throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
        }
        await Reports.declineReport(req.user, reportedUserId, reportId);
        res.send("OK");
      } catch (e) {
        next(e);
      }
    }
  );
  app.get("/admins/reports", auth, async (req, res, next) => {
    try {
      if (
        !User.hasAdminRightsTo(
          req.user,
          User.adminRights.manageViolationReports
        )
      ) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      res.send(await Reports.getFormattedReports(req.query));
    } catch (e) {
      next(e);
    }
  });
  app.get("/admins/rolepresets", auth, async (req, res, next) => {
    try {
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageAdmins)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      res.send(await Configuration.MODEL.findOne({ key: "adminRolePresets" }));
    } catch (e) {
      next(e);
    }
  });
  app.put("/admins/rolepresets", auth, async (req, res, next) => {
    try {
      validate(AdminSchema.putAdminRolePresets, req.body);
      let adminRolePresets = req.body;

      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageAdmins)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      let oldAdminRolePresets = await Configuration.MODEL.findOne({
        key: "adminRolePresets",
      });
      if (!oldAdminRolePresets) {
        oldAdminRolePresets = await Configuration.create({
          key: "adminRolePresets",
          value: {
            adminRolePresets: null,
          },
        });
      }
      const result = await Configuration.patch(oldAdminRolePresets._id, {
        "value.adminRolePresets": adminRolePresets,
      });

      await AdminLog.TYPES.changedAdminRolePresets({
        userId: req.user._id,
        oldAdminRolePresets: oldAdminRolePresets,
        newAdminRolePresets: adminRolePresets,
      });
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.put("/admins/partypointsconfig", auth, async (req, res, next) => {
    try {
      validate(AdminSchema.putPartyPointsConfig, req.body);
      let partyPointsConfig = req.body;

      if (!req.user.isSuperAdmin) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      let oldPartyPointsConfig = await Configuration.MODEL.findOne({
        key: "partyPoints",
      });
      if (!oldPartyPointsConfig) {
        oldPartyPointsConfig = await Configuration.create({
          key: "partyPoints",
          value: partyPointsConfig,
        });
      }
      const result = await Configuration.patch(oldPartyPointsConfig._id, {
        value: partyPointsConfig,
      });
      res.send(result.value);
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/users/:userId/delete", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      validate(AdminSchema.deleteUser, req.body);
      const { emailToUser, reason } = req.body;
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.deleteUserFinally) &&
        req.user._id.toString() !== userId
      ) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      const user = await User.getRaw(userId);
      await AdminLog.TYPES.deletedUser({
        userId: req.user._id,
        deletedUser: user,
        emailToUser,
        reason,
      });
      if (user.email && emailToUser)
        await sendRawMessage(
          user.email,
          "Dein Papeo Account wurde gelöscht",
          emailToUser
        );
      res.send(await User.remove(userId));
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/uploads/:id/delete", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      validate(AdminSchema.deleteReason, req.body);
      const { reason } = req.body;
      const upload = await Upload.get(id);
      const manageParties =
        upload.party &&
        !User.hasAdminRightsTo(req.user, User.adminRights.manageParties);
      const managePosts =
        upload.post &&
        !User.hasAdminRightsTo(req.user, User.adminRights.manageMedia);
      const manageProfiles =
        upload.profilePictureFromUser &&
        !User.hasAdminRightsTo(req.user, User.adminRights.manageUserProfiles);

      if (manageParties || managePosts || manageProfiles) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      if (!upload.party && !upload.post && !upload.profilePictureFromUser) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      await AdminLog.TYPES.deletedMedia({
        userId: req.user._id,
        upload,
        reason,
      });
      if (upload.profilePictureFromUser) {
        await Activity.create({
          user: upload.profilePictureFromUser,
          otherUsers: [upload.profilePictureFromUser],
          type: "deletedProfilePictureByAdmin",
          additionalInformation: { reason: reason },
          notificationCategories: ["myProfileActivity"],
          sendNotification: true,
        });
      }
      res.send(await Upload.remove(id));
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/ratings/:id/delete", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      validate(AdminSchema.deleteReason, req.body);
      const { reason } = req.body;
      const rating = await Rating.get(id);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.deleteRating)) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      await AdminLog.TYPES.deletedRating({
        userId: req.user._id,
        rating,
        reason,
      });
      // TODO NOTIFICATIONS
      res.send(await Rating.remove(id));
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/comments/:id/delete", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      validate(AdminSchema.deleteReason, req.body);
      const { reason } = req.body;
      const comment = await Comment.get(id);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageComments)) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      await AdminLog.TYPES.deletedComment({
        userId: req.user._id,
        comment,
        reason,
      });

      const post = await Post.get(comment.post);
      await Activity.create({
        user: comment.user,
        otherUsers: [comment.user],
        posts: [comment.post],
        type: "deletedPostCommentByAdmin",
        additionalInformation: { reason: reason, comment: comment.comment },
        notificationCategories: ["comments"],
        sendNotification: true,
      });
      if (post.user.toString() !== comment.user.toString()) {
        await Activity.create({
          user: post.user,
          otherUsers: [comment.user],
          posts: [comment.post],
          type: "deletedPostCommentByAdmin",
          additionalInformation: { reason: reason, comment: comment.comment },
          notificationCategories: ["comments"],
          sendNotification: true,
        });
      }
      res.send(await Comment.remove(id));
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/posts/:id/delete", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      validate(AdminSchema.deleteReason, req.body);
      const { reason } = req.body;
      const post = await Post.get(id);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageMedia)) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      await AdminLog.TYPES.deletedPost({
        userId: req.user._id,
        post,
        reason,
      });
      if (post.deactivatedByAdmin === false) {
        await Activity.create({
          user: post.user,
          otherUsers: [post.user],
          type: "deletedPostByAdmin",
          additionalInformation: { reason: reason },
          notificationCategories: ["myProfileActivity"],
          sendNotification: true,
        });
        if (post.type === "party") {
          const party = await Party.get(post.party);
          await Activity.create({
            user: party.owner,
            otherUsers: [post.user],
            type: "deletedPostByAdmin",
            additionalInformation: { reason: reason },
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
  app.post(
    "/admins/artists/:id/description/delete",
    auth,
    async (req, res, next) => {
      try {
        let { id } = req.params;
        validate(AdminSchema.deleteReason, req.body);
        const { reason } = req.body;
        const user = await User.get(id);
        if (
          !User.hasAdminRightsTo(req.user, User.adminRights.manageUserProfiles)
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        await AdminLog.TYPES.removedArtistDescription({
          userId: req.user._id,
          affectedUser: user,
          oldArtistDescription: user.artistDescription,
          reason,
        });
        await Activity.create({
          user: user._id,
          otherUsers: [user._id],
          type: "deletedArtistDescriptionByAdmin",
          additionalInformation: { reason: reason },
          notificationCategories: ["myProfileActivity"],
          sendNotification: true,
        });
        res.send(
          await User.patch(id, {
            artistDescription: null,
          })
        );
      } catch (e) {
        next(e);
      }
    }
  );
  app.patch("/admins/artists/:id", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      validate(AdminSchema.changedArtistStatus, req.body);
      const { reason, isArtist } = req.body;
      const user = await User.get(id);
      if (!User.hasAdminRightsTo(req.user, User.adminRights.manageMembership)) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      await AdminLog.TYPES.changedArtistStatus({
        userId: req.user._id,
        affectedUser: user,
        isArtist,
        reason,
      });
      res.send(
        await User.patch(id, {
          isArtist: isArtist,
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.post(
    "/admins/users/:id/description/delete",
    auth,
    async (req, res, next) => {
      try {
        let { id } = req.params;
        validate(AdminSchema.deleteReason, req.body);
        const { reason } = req.body;
        const user = await User.get(id);
        if (
          !User.hasAdminRightsTo(req.user, User.adminRights.manageUserProfiles)
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        await AdminLog.TYPES.removedUserDescription({
          userId: req.user._id,
          affectedUser: user,
          oldDescription: user.description,
          reason,
        });
        await Activity.create({
          user: user._id,
          otherUsers: [user._id],
          type: "deletedProfileDescriptionByAdmin",
          additionalInformation: { reason: reason },
          notificationCategories: ["myProfileActivity"],
          sendNotification: true,
        });
        res.send(
          await User.patch(id, {
            description: null,
          })
        );
      } catch (e) {
        next(e);
      }
    }
  );
  app.post("/admins/users/:id/hashtag/delete", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      validate(AdminSchema.deleteHashtag, req.body);
      const { reason, tag } = req.body;
      const user = await User.get(id);
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.manageUserProfiles)
      ) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      await AdminLog.TYPES.deletedUserTag({
        userId: req.user._id,
        affectedUser: user,
        tag,
      });
      res.send(
        await User.patch(id, {
          $pull: { profileTags: tag },
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.post(
    "/admins/users/:userId/subscription",
    auth,
    async (req, res, next) => {
      try {
        let { userId } = req.params;
        validate(AdminSchema.createSubscription, req.body);
        const { duration, reason } = req.body;
        const user = await User.get(userId);
        if (
          !User.hasAdminRightsTo(req.user, User.adminRights.manageMembership)
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        await AdminLog.TYPES.createdSubscription({
          userId: req.user._id,
          affectedUser: user,
          duration,
          reason,
        });
        res.send(
          await revenuecatCreatePromotionalEntitlement(userId, duration)
        );
      } catch (e) {
        next(e);
      }
    }
  );
  app.post(
    "/admins/users/:userId/subscription/delete",
    auth,
    async (req, res, next) => {
      try {
        let { userId } = req.params;
        validate(AdminSchema.deletedSubscription, req.body);
        const { reason } = req.body;
        const user = await User.get(userId);
        if (
          !User.hasAdminRightsTo(req.user, User.adminRights.manageMembership)
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        await AdminLog.TYPES.deletedSubscription({
          userId: req.user._id,
          affectedUser: user,
          reason,
        });
        res.send(await revenuecatRevokePromotionalEntitlement(userId));
      } catch (e) {
        next(e);
      }
    }
  );
  app.get(
    "/admins/users/:userId/subscription",
    auth,
    async (req, res, next) => {
      try {
        let { userId } = req.params;
        if (
          !User.hasAdminRightsTo(req.user, User.adminRights.manageMembership)
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }

        res.send(await revenuecatGetSubscriber(userId));
      } catch (e) {
        next(e);
      }
    }
  );
  app.post("/admins/users/:userId/gettoken", auth, async (req, res, next) => {
    try {
      validate(AdminSchema.getToken, req.body);
      let { userId } = req.params;
      if (!User.hasAdminRightsTo(req.user, User.adminRights.loginAsUser)) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      const user = await User.getRaw(userId);
      if (!user.settings.allowAdminLogin && !req.user.isSuperAdmin) {
        throw papeoError(PAPEO_ERRORS.USER_DISABLED_ADMIN_LOGIN_IN_SETTINGS);
      }
      await AdminLog.TYPES.loginAsUser({
        userId: req.user._id,
        affectedUser: await User.get(userId),
        reason: req.body.reason,
      });
      // push notifications to all admins
      const adminIds = await getAllSuperAdmins();
      await Promise.allSettled(
        adminIds.map(async (adminId) => {
          const msg = ADMIN_USER_LOGIN(
            req.user.username,
            user.username,
            adminId.languageSetting || "de"
          );
          console.log(`NOTIFICATION: ${msg.title} - ${msg.body} to ${adminId}`);
          return await sendNotificationToUser(
            adminId.toString(),
            msg.title,
            msg.body,
            {}
          );
        })
      );

      res.send(await User.getLoginInformationForAdminAccess(user, req.user));
    } catch (e) {
      next(e);
    }
  });
  app.post("/admins/users/createprofile", auth, async (req, res, next) => {
    try {
      validate(AdminSchema.createUserProfile, req.body);
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.createUserProfiles)
      ) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }

      const user =
        await User.createUserWithoutPhoneNumberForAdminUserCreation();
      const login =
        await User.getLoginInformationForAdminAccessWithoutRightsCheck(user);
      await AdminLog.TYPES.profileCreated({
        userId: req.user._id,
        affectedUser: user,
      });

      return res.send(login);
    } catch (e) {
      next(e);
    }
  });
};
