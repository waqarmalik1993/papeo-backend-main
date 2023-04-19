const PartySchema = require("../modules/validation/parties.js").PartySchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const InvitesSchema = require("../modules/validation/invites.js").InvitesSchema;
const Invites = require("../services/invites/invitesService.js");
const Party = require("../services/parties/partiesService.js");
const AdminLog = require("../services/adminlogs/adminLogsService");
const User = require("../services/users/usersService");
const PartyGuest = require("../services/partyGuests/partyGuestsService.js");
const { data } = require("../logger.js");
const { Types } = require("mongoose");
const { BadRequest } = require("@feathersjs/errors");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
module.exports = async (app) => {
  app.get("/invites", auth, async (req, res, next) => {
    try {
      res.send(
        await Invites.find({
          query: { ...req.query, invitedUser: req.user._id },
        })
      );
    } catch (e) {
      next(e);
    }
  });

  app.get("/invites/search", auth, async (req, res, next) => {
    try {
      console.log(req.query);
      if (req.query.sex) {
        if (!Array.isArray(req.query.sex)) req.query.sex = [req.query.sex];
      }
      if (req.query.include) {
        if (!Array.isArray(req.query.include))
          req.query.include = [req.query.include];
      }
      validate(InvitesSchema.search, req.query);
      res.send(await Invites.search(req.user, req.query));
    } catch (e) {
      next(e);
    }
  });
  app.get("/v2/invites/search", auth, async (req, res, next) => {
    try {
      console.log(req.query);
      if (req.query.sex) {
        if (!Array.isArray(req.query.sex)) req.query.sex = [req.query.sex];
      }
      if (req.query.include) {
        if (!Array.isArray(req.query.include))
          req.query.include = [req.query.include];
      }
      validate(InvitesSchema.searchV2, req.query);
      res.send(await Invites.searchV2(req.user, req.query, false));
    } catch (e) {
      next(e);
    }
  });
  app.get("/v2/invites/search/dryrun", auth, async (req, res, next) => {
    try {
      console.log(req.query);
      if (req.query.sex) {
        if (!Array.isArray(req.query.sex)) req.query.sex = [req.query.sex];
      }
      if (req.query.include) {
        if (!Array.isArray(req.query.include))
          req.query.include = [req.query.include];
      }
      validate(InvitesSchema.searchV2, req.query);
      req.query.$limit = 10000;
      req.query.$skip = 0;
      const result = await Invites.searchV2(req.user, req.query);

      let totalCost = 0;
      for (const user of result.data) {
        totalCost += user.invitationCost;
      }
      res.send({
        userCount: result.data.length,
        totalCost: totalCost,
        users: result.data.map((u) => ({
          _id: u._id,
          username: u.username,
          profilePicture: u.profilePicture,
          invitationCost: u.invitationCost,
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  app.get("/invites/parties", auth, async (req, res, next) => {
    try {
      validate(InvitesSchema.partiesToInviteUsersTo_QUERY, req.query);
      const userToInvite = await User.getRaw(req.query.user_to_invite);
      const userCanBeInvitedSettings = await Invites.userCanBeInvited(
        await Invites.getUserRelationShipCategories(req.user, userToInvite),
        userToInvite
      );
      const myActiveParties = (
        await Party.getActivePartiesFromUserPopulated(req.user._id)
      ).map((p) => p.toObject());
      const partiesWhereIAmOnTheGuestlist = (
        await PartyGuest.MODEL.find({
          user: req.user._id,
          status: "attending",
        }).populate({ path: "party", populate: "owner uploads" })
      )
        .filter((pg) => pg.party !== null)
        .filter(
          (pg) =>
            pg.party.startDate > new Date() &&
            pg.party.owner._id.toString() !== userToInvite._id.toString()
        )
        .map((pg) => pg.party.toObject());

      // A
      /*
      const partiesIAlreadyInvitedThisUserTo = (
        await Invites.MODEL.find({
          user: req.user._id,
          invitedUser: userToInvite._id,
        })
      ).map((i) => i.party.toString());
      */
      const allParties = await Promise.all(
        [...myActiveParties, ...partiesWhereIAmOnTheGuestlist].map(
          async (p) => {
            let userCanBeInvited = true;
            let userCanBeInvitedReason = null;
            if (!userCanBeInvitedSettings) {
              return {
                ...p,
                userCanBeInvited: false,
                userCanBeInvitedReason: "SETTINGS",
              };
            }
            /*
            if (partiesIAlreadyInvitedThisUserTo.includes(p._id.toString())) {
              return {
                ...p,
                userCanBeInvited: false,
                userCanBeInvitedReason: "ALREADY_INVITED",
              };
            } */
            const canBeInvited = await Party.canUserJoinParty(userToInvite, p);
            userCanBeInvited = canBeInvited.canJoinParty;
            userCanBeInvitedReason = canBeInvited.reason || null;

            return {
              ...p,
              userCanBeInvited,
              userCanBeInvitedReason,
            };
          }
        )
      );
      res.send(allParties);
    } catch (e) {
      next(e);
    }
  });

  app.post("/parties/:partyId/invites", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      validate(InvitesSchema.POST, req.body);
      const usersToInvite = req.body.users;
      const party = await Party.get(partyId);
      const partyIsFull =
        (await PartyGuest.getPartyGuestCount(partyId)) >= party.capacity;
      if (partyIsFull) throw papeoError(PAPEO_ERRORS.GUESTLIST_IS_FULL);
      // check if user has an partyGuest entry for this party or is owner
      if (party.owner._id.toString() !== req.user._id.toString()) {
        const isUserAnyPartyGuestResult = await PartyGuest.isUserAnyPartyGuest(
          partyId,
          req.user._id.toString()
        );
        const hasAdminInviteGuestToPartyRights = User.hasAdminRightsTo(
          req.user,
          User.adminRights.inviteGuestsToParties
        );
        if (!isUserAnyPartyGuestResult && !hasAdminInviteGuestToPartyRights) {
          throw papeoError(PAPEO_ERRORS.YOU_MUST_BE_A_GUEST_TO_INVITE_OTHERS);
        }
        if (hasAdminInviteGuestToPartyRights) {
          await AdminLog.TYPES.invitedUsers({
            userId: req.user._id,
            party,
            invitedUserIds: usersToInvite.map((id) => Types.ObjectId(id)),
          });
        }
      }
      const { estimatedCosts } = await Invites.checkInviteCosts(
        req.user,
        usersToInvite
      );
      /*const result = await Invites.inviteUsers(
        req.user,
        usersToInvite,
        partyId
      );*/
      const asyncResult = await Invites.inviteUsersAsync(
        req.user,
        usersToInvite,
        partyId
      );
      if (process.env.TEST) {
        res.send(asyncResult);
        return;
      }
      res.send({ estimatedCosts });
    } catch (e) {
      next(e);
    }
  });
  app.post("/parties/:partyId/invites/me", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      validate(InvitesSchema.POST_invite_me, req.body);
      const inviteToken = req.body.inviteToken;
      const party = await Party.get(partyId, {
        query: {
          $select: { "+inviteToken": 1 },
        },
      });
      if (party.inviteToken !== inviteToken) {
        console.log("party.inviteToken !== inviteToken");
        throw BadRequest("Invalid invite token");
      }

      if (!(await Invites.isUserInvited(partyId, req.user._id))) {
        await Invites.createRaw({
          user: party.owner,
          invitedUser: req.user._id,
          party: party._id,
        });
      }
      res.send({ ok: true });
    } catch (e) {
      next(e);
    }
  });
};
