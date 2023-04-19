const PartyGuestsSchema =
  require("../modules/validation/partyGuests").PartyGuestsSchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const PartyGuests = require("../services/partyGuests/partyGuestsService.js");
const PartyAdminActivity = require("../services/partyAdminActivities/partyAdminActivitiesService");
const Party = require("../services/parties/partiesService");
const User = require("../services/users/usersService");
const Activity = require("../services/activities/activitiesService");
const UserTicket = require("../services/ticketing/ticketingUserTicketService");
const Invite = require("../services/invites/invitesService");
const {
  createActivityTargetGroup,
} = require("../services/activities/createActivityTargetGroup");
const {
  getFriendIdsFromUser,
  getFollowerIdsFromUser,
  getWaitingPartyUserIds,
} = require("../services/activities/helper/getTargetGroup");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const {
  createPartyConversationAndSendMessage,
} = require("../services/users/modules/firebase/users");
const { optionalAuth } = require("../middleware/optionalAuth");
module.exports = async (app) => {
  app.get("/parties/:partyId/guests", optionalAuth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      if (!req.user) {
        const party = await Party.get(partyId, {
          query: {
            $select: { "+inviteToken": 1 },
          },
        });
        const userHasInviteToken =
          party.inviteToken && req.query.t === party.inviteToken;
        if (!userHasInviteToken) {
          throw papeoError(PAPEO_ERRORS.NOT_FOUND);
        }
      }
      delete req.query.t;
      if (req.query.text_search) {
        req.query.username = new RegExp(req.query.text_search, "i");
        delete req.query.text_search;
      }
      const partyGuests = await PartyGuests.find({
        query: { ...req.query, party: partyId },
      });
      partyGuests.data = await Promise.all(
        (partyGuests.data || []).map(async (pg) => {
          const hasTicket = !!(await UserTicket.MODEL.exists({
            user: pg.user,
            party: pg.party,
          }));
          return { ...pg, hasTicket };
        })
      );
      res.send(partyGuests);
    } catch (e) {
      next(e);
    }
  });
  app.get("/parties/:partyId/guests/sorted", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      const results = [];

      if (!req.query.$limit) {
        req.query.$limit = 250;
      }

      const me = await PartyGuests.find({
        query: {
          user: req.user._id,
          party: partyId,
          ...req.query,
          $limit: 1,
          $skip: 0,
        },
      });
      const friends = await PartyGuests.find({
        query: {
          ...req.query,
          user: {
            $in: req.user.partyFriends
              .filter((f) => f.status === "accepted")
              .map((f) => f.friend),
          },
          party: partyId,
          $limit: 1000,
          $skip: 0,
        },
      });
      if (me.data) results.push(...me.data);
      if (friends.data) results.push(...friends.data);
      const result = await PartyGuests.find({
        query: {
          ...req.query,
          user: {
            $nin: [
              req.user._id,
              ...req.user.partyFriends
                .filter((f) => f.status === "accepted")
                .map((f) => f.friend),
            ],
          },
          party: partyId,
        },
      });
      res.send({
        total: result.total,
        skip: result.skip,
        limit: result.limit,
        data: result.data,
        meAndFriends: results,
      });
    } catch (e) {
      next(e);
    }
  });

  app.delete("/parties/:partyId/guests", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      const partyGuests = (
        await PartyGuests.find({
          query: {
            user: req.user._id,
            party: partyId,
          },
        })
      ).data;
      if (partyGuests.length === 0) {
        throw papeoError(PAPEO_ERRORS.YOU_ARE_NOT_A_GUEST_OF_THIS_PARTY);
      }
      /*
        IMPORTANT: Users who have paid the entrance fee or who have been
        marked as present for the party can no longer be deleted
        from the guest list, nor can they delete themselves from the guest list.
      */
      if (partyGuests[0].onSite === "yes" || partyGuests[0].hasPaid) {
        throw papeoError(PAPEO_ERRORS.USER_CANNOT_BE_DELETED_FROM_GUESTLIST);
      }
      const result = await PartyGuests.remove(partyGuests[0]._id);
      console.log(`deleted partyguest ${result._id}`);
      if (partyGuests[0].user.toString() === req.user._id.toString()) {
        // TODO activity Benachrichtigung an Veranstalter versenden wenn ein Benutzer seine Anfrage zur Teilnahme an eine geschlossene Party zurückgezogen hat.
        const party = await Party.get(partyGuests[0].party);
        if (party.privacyLevel !== "open") {
          await Activity.create({
            type: "partyGuestRemovedHimself",
            user: party.owner,
            notificationCategories: ["parties"],
            otherUsers: [req.user._id],
            parties: [partyGuests[0].party],
            sendNotification: true,
          });
        }
      }
      await Party.removePartyAdmin(partyId, req.user._id);
      res.send(result);
    } catch (e) {
      next(e);
    }
  });

  app.delete(
    "/parties/:partyId/guests/:userId",
    auth,
    async (req, res, next) => {
      try {
        const { partyId, userId } = req.params;
        const partyGuests = (
          await PartyGuests.find({
            query: {
              user: userId,
              party: partyId,
            },
          })
        ).data;
        if (partyGuests.length === 0) {
          throw papeoError(PAPEO_ERRORS.YOU_ARE_NOT_A_GUEST_OF_THIS_PARTY);
        }
        //  IMPORTANT: Users who have paid the entrance fee or who have been
        //  marked as present for the party can no longer be deleted
        //  from the guest list, nor can they delete themselves from the guest list.
        const party = await Party.get(partyId);
        if (
          !User.hasRightsTo(req.user, party, User.rights.canManageGuestlist)
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        if (partyGuests[0].onSite === "yes" || partyGuests[0].hasPaid) {
          throw papeoError(PAPEO_ERRORS.USER_CANNOT_BE_DELETED_FROM_GUESTLIST);
        }
        // TODO NOTIFICATIONS
        /*
        REQUESTED

Benachrichtigung das ein Benutzer seine Teilnahme an einer Party abgesagt hat und aus der Gästeliste gelöscht wurde versenden an:

- Veranstalter (Notification category 05.01)
- Freunde des Benutzers (Notification category 05.02)
- Follower des Benutzers (Notification category 05.03)
*/
        const result = await PartyGuests.remove(partyGuests[0]._id);
        await Party.removePartyAdmin(partyId, userId);
        res.send(result);
      } catch (e) {
        next(e);
      }
    }
  );

  app.post("/parties/:partyId/guests", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      if (req.user.restrictions.participateInParties) {
        throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
      }
      const party = await Party.get(partyId, {
        query: {
          $select: { "+inviteToken": 1 },
        },
      });
      if (User.isBlockedByOrBlocking(req.user, party.owner)) {
        throw papeoError(PAPEO_ERRORS.NOT_FOUND);
      }
      const hasValidInviteToken =
        req.body &&
        req.body.inviteToken &&
        req.body.inviteToken === party.inviteToken;
      if (party.privacyLevel === "secret") {
        const isUserInvited =
          (
            await Invite.find({
              query: { party: party._id, invitedUser: req.user._id },
            })
          ).total > 0;

        if (!isUserInvited && !hasValidInviteToken) {
          throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
        }
      }
      const canJoinParty = (await Party.canUserJoinParty(req.user, party))
        .canJoinParty;
      if (!canJoinParty) {
        throw papeoError(PAPEO_ERRORS.YOU_CANNOT_JOIN_THIS_PARTY);
      }

      if (party.competition && req.user.attendedCompetitionParty === null) {
        await User.patch(req.user._id, {
          attendedCompetitionParty: party._id,
        });
      }

      const result = await PartyGuests.create({
        user: req.user._id,
        party: partyId,
      });
      result.user = await User.get(req.user._id);
      await guestNotification(result, result, result.user, party, req.user);
      if (party._id && req.user._id) {
        await Invite.MODEL.deleteMany({
          party: party._id,
          invitedUser: req.user._id,
        });
      }
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.patch(
    "/parties/:partyId/guests/:userId",
    auth,
    async (req, res, next) => {
      try {
        const { partyId, userId } = req.params;

        let user = await User.get(userId);

        validate(PartyGuestsSchema.PATCH, req.body);
        const partyGuests = await PartyGuests.find({
          query: {
            party: partyId,
            user: userId,
          },
        });
        if (partyGuests.data.length === 0) {
          throw papeoError(PAPEO_ERRORS.PARTYGUEST_NOT_FOUND);
        }

        let partyguest = partyGuests.data[0];

        if (!req.body.status && req.body.reminder !== undefined) {
          if (userId !== req.user._id.toString()) {
            throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
          }
          return res.send(
            await PartyGuests.patch(partyguest._id, {
              reminder: req.body.reminder,
            })
          );
        }
        if (!req.body.status && req.body.isDeleted !== undefined) {
          if (userId !== req.user._id.toString()) {
            throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
          }
          return res.send(
            await PartyGuests.patch(partyguest._id, {
              isDeleted: req.body.isDeleted,
            })
          );
        }
        const party = await Party.get(partyId);
        if (
          !User.hasRightsTo(req.user, party, User.rights.canManageGuestlist)
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        if (req.body.status && partyguest.status !== req.body.status) {
          if (req.body.status === "attending") {
            await PartyAdminActivity.TYPES.acceptedGuest({
              user: req.user,
              party: party,
              guest: user,
            });
            if (party.informationForAcceptedGuests) {
              await createPartyConversationAndSendMessage({
                party,
                receiverId: userId,
                message: party.informationForAcceptedGuests,
                senderId: party.owner.toString(),
              });
            }
          }
          if (req.body.status === "declined") {
            await PartyAdminActivity.TYPES.declinedGuest({
              user: req.user,
              party: party,
              guest: user,
            });
          }
        }
        const result = await PartyGuests.patch(partyguest._id, req.body);

        if (
          result.status !== partyguest.status &&
          result.status !== "attending"
        ) {
          await Party.removePartyAdmin(partyId, userId);
        }

        await guestNotification(partyguest, result, user, party, req.user);
        res.send(result);
      } catch (e) {
        next(e);
      }
    }
  );
};

const guestNotification = async (
  before,
  after,
  user,
  party,
  userWhichSendTheRequest
) => {
  if (after.status && after.status !== before.status) {
    let oldStatus = before.status;
    let newStatus = after.status;
    /*console.log({
      oldStatus,
      newStatus,
      user: user.username,
    });*/
    if (newStatus === "attending") {
      await Activity.create({
        notificationCategories: ["parties"],
        user: after.user,
        otherUsers: [after.user],
        type: "partyGuestAccepted",
        parties: [after.party],
        sendNotification: true,
      });
      if (party.privacyLevel !== "secret") {
        await createActivityTargetGroup({
          type: "partyGuestAccepted",
          targetGroups: {
            friends: getFriendIdsFromUser(user),
            following: await getFollowerIdsFromUser(after.user),
            //parties: [(await Party.get(after.party)).owner],
          },
          parties: [after.party],
          sendNotification: true,
          otherUsers: [user._id],
        });
      }
      const partyIsFull =
        (await PartyGuests.getPartyGuestCount(party._id)) >= party.capacity;
      if (partyIsFull) {
        await createActivityTargetGroup({
          type: "guestListIsFullClosedParty",
          targetGroups: {
            parties: [await getWaitingPartyUserIds(party._id)],
          },
          parties: [after.party],
          sendNotification: true,
          otherUsers: [user._id],
        });
      }
      if (party.owner.toString() !== userWhichSendTheRequest._id.toString()) {
        await Activity.create({
          notificationCategories: ["parties"],
          user: party.owner,
          otherUsers: [userWhichSendTheRequest._id, after.user],
          type: "partyGuestAcceptedByPartyAdmin",
          parties: [after.party],
          sendNotification: true,
        });
      }
    } else if (oldStatus === "attending" && newStatus === "declined") {
      await Activity.create({
        notificationCategories: ["parties"],
        user: after.user,
        otherUsers: [after.user],
        type: "partyGuestRemoved",
        parties: [after.party],
        sendNotification: true,
      });
      if (party.privacyLevel !== "secret") {
        await createActivityTargetGroup({
          type: "partyGuestRemoved",
          targetGroups: {
            friends: getFriendIdsFromUser(user),
            following: await getFollowerIdsFromUser(after.user),
            //parties: [(await Party.get(after.party)).owner],
          },
          parties: [after.party],
          sendNotification: true,
          otherUsers: [user._id],
        });
      }
      if (party.owner.toString() !== userWhichSendTheRequest._id.toString()) {
        await Activity.create({
          notificationCategories: ["parties"],
          user: party.owner,
          otherUsers: [userWhichSendTheRequest._id, after.user],
          type: "partyGuestRemovedByPartyAdmin",
          parties: [after.party],
          sendNotification: true,
        });
      }
    } else if (newStatus === "declined") {
      await Activity.create({
        notificationCategories: ["parties"],
        user: after.user,
        otherUsers: [after.user],
        type: "partyGuestDeclined",
        parties: [after.party],
        sendNotification: true,
      });
    }
  }
};
/*
// seed partyguests
setTimeout(async () => {
  const usersList = [
    "6130f74bb8723c0603900cb0",
    "6130f74fb8723c0603900dd4",
    "6130f751b8723c0603900e00",
    "6130f751b8723c0603900df8",
    "6130f751b8723c0603900dfe",
    "6130f751b8723c0603900dfa",
    "6130f751b8723c0603900dfc",
    "6130f756b8723c0603900f1c",
    "6130f758b8723c0603900f46",
    "6130f758b8723c0603900f40",
    "6130f758b8723c0603900f44",
    "6130f758b8723c0603900f42",
    "6130f758b8723c0603900f48",
  ];
  for (const userId of usersList) {
    console.log("test");
    const req = {};
    req.user = await User.getRaw(userId);
    const partyId = "61c4457549448c000941fa6a";

    const party = await Party.get(partyId);

    const canJoinParty = (await Party.canUserJoinParty(req.user, party))
      .canJoinParty;
    if (!canJoinParty) {
      throw papeoError(PAPEO_ERRORS.YOU_CANNOT_JOIN_THIS_PARTY);
    }

    if (party.competition && req.user.attendedCompetitionParty === null) {
      await User.patch(req.user._id, {
        attendedCompetitionParty: party._id,
      });
    }
    const result = await PartyGuests.create({
      user: req.user._id,
      party: partyId,
    });
    result.user = await User.get(req.user._id);
    await guestNotification(result, result, result.user);
  }
}, 2000);
*/
