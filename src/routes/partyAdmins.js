const PartyAdminSchema =
  require("../modules/validation/partyAdmins.js").PartyAdminSchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const User = require("../services/users/usersService.js");
const Party = require("../services/parties/partiesService.js");
const PartyGuest = require("../services/partyGuests/partyGuestsService");
const PartyAdminActivity = require("../services/partyAdminActivities/partyAdminActivitiesService");
const Transaction = require("../services/transactions/transactionsService");
const UserTicket = require("../services/ticketing/ticketingUserTicketService");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const firebaseModule = require("../services/users/modules/firebase/users");
const Activity = require("../services/activities/activitiesService");
const {
  getPartyPointsConfig,
} = require("../services/configuration/configurationsService");
const {
  createActivityTargetGroup,
} = require("../services/activities/createActivityTargetGroup");
const {
  getPartyAdmins,
} = require("../services/activities/helper/getTargetGroup");
module.exports = async (app) => {
  app.get("/parties/:partyId/admins", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      const { user } = req.query;
      const party = await Party.get(partyId);
      if (!party) throw papeoError(PAPEO_ERRORS.PARTY_DOES_NOT_EXIST);
      const result = [];
      await Promise.all(
        party.admins
          .filter((a) => !user || a.user.toString() === user)
          .map(async (admin) => {
            const user = await User.get(admin.user);
            result.push({ ...admin, user });
          })
      );
      res.send(result);
    } catch (e) {
      next(e);
    }
  });

  app.get(
    "/parties/:partyId/admins/:userId/history",
    auth,
    async (req, res, next) => {
      try {
        const { partyId, userId } = req.params;
        const { lang } = req.query;

        const party = await Party.get(partyId);
        if (
          !User.hasRightsTo(req.user, party, User.rights.canSeeAdminHistory)
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        const history = await PartyAdminActivity.find({
          query: {
            user: userId,
            party: partyId,
            $sort: {
              createdAt: -1,
            },
            ...req.query,
          },
        });
        history.data = await Promise.all(
          history.data.map(async (log) => {
            if (log.data?.post?.user) {
              log.data.post.user = await User.get(log.data.post.user);
              return log;
            }
            return log;
          })
        );
        res.send(history);
      } catch (e) {
        next(e);
      }
    }
  );
  const filterPartyGuestsForBroadcastMessage = async (
    genders,
    filter,
    colorGroups,
    partyId
  ) => {
    const query = {};
    if (filter && !filter.includes("all")) {
      if (filter.includes("on_site")) query.onSite = "yes";
      if (filter.includes("paid")) query.hasPaid = true;
    }

    const partyGuests = await PartyGuest.MODEL.find({
      party: partyId,
      colorGroup: {
        $in: colorGroups,
      },
      ...query,
    }).populate([{ path: "user", select: "sex" }]);
    let filteredPartyGuests = partyGuests.filter((pg) =>
      genders.includes(pg.user.sex)
    );
    if (
      filter &&
      (filter.includes("with_ticket") || filter.includes("without_ticket"))
    ) {
      const allUserTickets = await UserTicket.MODEL.find({
        party: partyId,
        refunded: false,
      })
        .select("user")
        .lean();
      if (filter.includes("with_ticket")) {
        filteredPartyGuests = filteredPartyGuests.filter((pg) =>
          allUserTickets.some(
            (ut) => ut.user.toString() === pg.user._id.toString()
          )
        );
      }
      if (filter.includes("without_ticket")) {
        console.log(allUserTickets);
        filteredPartyGuests = filteredPartyGuests.filter((pg) =>
          allUserTickets.every(
            (ut) => ut.user.toString() !== pg.user._id.toString()
          )
        );
      }
    }
    return filteredPartyGuests;
  };
  app.post(
    "/parties/:partyId/admins/broadcastmessage",
    auth,
    async (req, res, next) => {
      try {
        const { partyId } = req.params;
        validate(PartyAdminSchema.broadcastMessage.POST, req.body);
        const { colorGroups, message, genders, filter } = req.body;
        const party = await Party.get(partyId);
        if (
          !User.hasRightsTo(req.user, party, User.rights.canBroadcastMessages)
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        const filteredPartyGuests = await filterPartyGuestsForBroadcastMessage(
          genders,
          filter,
          colorGroups,
          partyId
        );

        const PARTY_POINTS_CONFIG = await getPartyPointsConfig();
        if (
          req.user.partyPoints <
          filteredPartyGuests.length * PARTY_POINTS_CONFIG.broadcastMessage
        ) {
          throw papeoError(
            PAPEO_ERRORS.YOU_DONT_HAVE_ENOUGH_PP_TO_BROADCAST_MESSAGE
          );
        }

        res.send(
          await Promise.all(
            filteredPartyGuests.map(async (pg) => {
              return await firebaseModule.sendPartyMessage({
                senderId: req.user._id,
                receiverId: pg.user._id,
                party,
                message,
              });
            })
          )
        );
        await PartyAdminActivity.TYPES.broadcastedMessage({
          party: party,
          user: req.user,
          peopleCount: filteredPartyGuests.length,
          colorGroups: colorGroups,
          message: message,
          points:
            filteredPartyGuests.length * PARTY_POINTS_CONFIG.broadcastMessage,
        });
        await Transaction.TYPES.broadCastedMessage({
          user: req.user,
          points:
            filteredPartyGuests.length * PARTY_POINTS_CONFIG.broadcastMessage,
          peopleCount: filteredPartyGuests.length,
          party,
        });
      } catch (e) {
        next(e);
      }
    }
  );
  app.post(
    "/parties/:partyId/admins/broadcastmessage/costs",
    auth,
    async (req, res, next) => {
      try {
        const { partyId } = req.params;
        validate(PartyAdminSchema.broadcastMessage.cost_POST, req.body);
        const { colorGroups, genders, filter } = req.body;
        const party = await Party.get(partyId);

        if (
          !User.hasRightsTo(req.user, party, User.rights.canBroadcastMessages)
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }

        const filteredPartyGuests = await filterPartyGuestsForBroadcastMessage(
          genders,
          filter,
          colorGroups,
          partyId
        );
        res.send({
          count: filteredPartyGuests.length,
          cost:
            filteredPartyGuests.length *
            (await getPartyPointsConfig()).broadcastMessage,
        });
      } catch (e) {
        next(e);
      }
    }
  );

  app.post(
    "/parties/:partyId/admins/:adminUserId",
    auth,
    async (req, res, next) => {
      try {
        const { partyId, adminUserId } = req.params;
        validate(PartyAdminSchema.POST, req.body);
        const rights = req.body.rights;
        const party = await Party.get(partyId);
        const adminUser = await User.get(adminUserId);
        if (!adminUser) throw papeoError(PAPEO_ERRORS.USER_DOES_NOT_EXIST);
        if (party.owner.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.ONLY_PARTY_OWNERS_CAN_ADD_ADMINS);
        }
        const result = await Party.addPartyAdmin(partyId, {
          user: adminUserId,
          rights,
        });
        res.send(result);
      } catch (e) {
        next(e);
      }
    }
  );

  app.patch(
    "/parties/:partyId/admins/:adminUserId",
    auth,
    async (req, res, next) => {
      try {
        const { partyId, adminUserId } = req.params;
        validate(PartyAdminSchema.PATCH, req.body);
        const rights = req.body.rights;
        const party = await Party.get(partyId);
        const adminUser = await User.get(adminUserId);
        if (!adminUser) throw papeoError(PAPEO_ERRORS.USER_DOES_NOT_EXIST);
        if (party.owner.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.ONLY_PARTY_OWNERS_CAN_ADD_ADMINS);
        }
        const result = await Party.patchPartyAdmin(partyId, {
          user: adminUserId,
          rights,
        });
        await createActivityTargetGroup({
          type: "editedPartyAdminRights",
          notificationCategories: ["parties"],
          otherUsers: [adminUser._id],
          parties: [party._id],
          targetGroups: {
            parties: await getPartyAdmins(party),
          },
          sendNotification: true,
        });
        res.send(result);
      } catch (e) {
        next(e);
      }
    }
  );

  app.delete(
    "/parties/:partyId/admins/:adminUserId",
    auth,
    async (req, res, next) => {
      try {
        const { partyId, adminUserId } = req.params;
        const party = await Party.get(partyId);
        if (party.owner.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.ONLY_PARTY_OWNERS_CAN_REMOVE_ADMINS);
        }
        res.send(await Party.removePartyAdmin(partyId, adminUserId));
      } catch (e) {
        next(e);
      }
    }
  );
};
