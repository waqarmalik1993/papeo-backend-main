const Party = require("../services/parties/partiesService.js");
const User = require("../services/users/usersService");
const PartyAdminActivity = require("../services/partyAdminActivities/partyAdminActivitiesService");
const PartySchema = require("../modules/validation/parties.js").PartySchema;
const validate = require("../modules/validation/validate.js");
const { auth } = require("../middleware/auth.js");
const { optionalAuth } = require("../middleware/optionalAuth.js");
const Rating = require("../services/ratings/ratingsService.js");
const Invite = require("../services/invites/invitesService");
const MenuCard = require("../services/menuCards/menuCardsService");
const TicketingShop = require("../services/ticketing/ticketingShopService");
const PartyGuests = require("../services/partyGuests/partyGuestsService.js");
const UserTicket = require("../services/ticketing/ticketingUserTicketService");
const {
  createActivityTargetGroup,
} = require("../services/activities/createActivityTargetGroup");
const {
  getGuestWaitingPartyUserIds,
  getBookmarkedPartyUserIds,
} = require("../services/activities/helper/getTargetGroup");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const { Forbidden } = require("@feathersjs/errors");
const {
  createPartyConversationAndSendMessage,
} = require("../services/users/modules/firebase/users");
const USER_POPULATION_FIELDS = {
  partyFriends: 1,
  _id: 1,
  obfuscatedHomeLocation: 1,
  verification: 1,
  rating: 1,
  firstName: 1,
  lastName: 1,
  fullName: 1,
  username: 1,
  languageSetting: 1,
  usernameLowercase: 1,
  locked: 1,
  roles: 1,
  sex: 1,
  city: 1,
  parties: 1,
  profileTags: 1,
  profilePicture: 1,
  firstLogin: 1,
  firstLoginAt: 1,
  lastLoginAt: 1,
  lastActivityAt: 1,
  birthday: 1,
  failedLoginAttempts: 1,
  successfulLoginCount: 1,
  isPartyKing: 1,
  isArtist: 1,
  referredBy: 1,
  createdAt: 1,
  updatedAt: 1,
  __v: 1,
  isArtistUpdatedDate: 1,
  artistDescription: 1,
  isAdmin: 1,
  isSuperAdmin: 1,
  attendedCompetitionParty: 1,
  obfuscatedCurrentLocation: 1,
  description: 1,
  referralCodes: 1,
};
const { query } = require("../logger.js");
module.exports = async (app) => {
  app.post("/parties", auth, async (req, res, next) => {
    try {
      validate(PartySchema.POST, req.body);
      if (req.user.restrictions.createParties) {
        throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
      }
      if (req.body.menuCard) {
        const menuCard = await MenuCard.get(req.body.menuCard);
        if (menuCard.user.toString() !== req.user._id.toString()) {
          throw new Forbidden();
        }
      }
      req.body.owner = req.user._id;
      res.send(await Party.create(req.body));
    } catch (e) {
      next(e);
    }
  });
  app.get("/parties/search", optionalAuth, async (req, res, next) => {
    try {
      console.log(req.query);
      if (req.query.guests) {
        if (!Array.isArray(req.query.guests))
          req.query.guests = [req.query.guests];
      }
      if (req.query.type) {
        if (!Array.isArray(req.query.type)) req.query.type = [req.query.type];
      }
      if (req.query.privacy_level) {
        if (!Array.isArray(req.query.privacy_level))
          req.query.privacy_level = [req.query.privacy_level];
      }

      validate(PartySchema.search, req.query);
      if (req.query.text_search && req.query.lat && req.query.long) {
        const result = await Party.search(req.user, {
          ...req.query,
        });

        return res.send(result);
      }
      return res.send(await Party.search(req.user, req.query));
    } catch (e) {
      next(e);
    }
  });
  app.get("/parties/attending", auth, async (req, res, next) => {
    try {
      const {
        user,
        withOwnParties,
        includeExpired,
        isDeleted,
        partiesWithTicket,
      } = req.query;
      const includeOwnParties = withOwnParties == "true";
      const includePartiesWithTicket = partiesWithTicket == "true";
      const forUser = user || req.user._id.toString();
      const includeExpiredParties = includeExpired === "true";
      const isDeletedPartyguest = isDeleted === "true";
      delete req.query.partiesWithTicket;
      delete req.query.withOwnParties;
      delete req.query.user;
      delete req.query.includeExpired;
      delete req.query.isDeleted;
      const partyGuestQuery = {
        expired12h: false,
        user: forUser,
        status: "attending",
      };
      if (isDeleted !== undefined) {
        partyGuestQuery.isDeleted = isDeletedPartyguest;
      }
      if (includeExpiredParties) delete partyGuestQuery.expired12h;
      let partyGuests = await PartyGuests.MODEL.find(partyGuestQuery)
        .select({ _id: 1, party: 1 })
        .lean();
      let partyIds = partyGuests.map((pg) => pg.party);
      if (includePartiesWithTicket) {
        const tickets = await UserTicket.MODEL.find({
          user: req.user._id,
        }).select("party");
        partyIds = [...partyIds, ...tickets.map((t) => t.party)];
      }
      const rootQuery = {
        expired12h: false,
        status: "published",
      };
      if (includeExpiredParties) delete rootQuery.expired12h;
      if (req.user._id.toString() !== forUser) {
        rootQuery.privacyLevel = { $ne: "secret" };
      }
      const attendingQuery = { ...rootQuery, _id: { $in: partyIds } };
      const ownPartiesQuery = { ...rootQuery, owner: forUser };
      let query = attendingQuery;
      if (includeOwnParties) {
        query = {
          $or: [attendingQuery, ownPartiesQuery],
        };
      }
      query.$populate = {
        path: "owner uploads",
      };
      if (includeExpiredParties) query.$sort = { expired12h: 1, startDate: -1 };
      query = { ...query, ...req.query };
      const result = await Party.find({ query });
      result.data = await Promise.all(
        result.data.map(async (party) => {
          return {
            ...party,
            ...(await Party.getCounts(req.user, party)),
          };
        })
      );
      res.send(result);
    } catch (e) {
      next(e);
    }
  });

  app.get("/parties/requested", auth, async (req, res, next) => {
    try {
      let partyGuests = await PartyGuests.find({
        query: {
          expired: false,
          user: req.user._id,
          status: "requested",
          $populate: {
            path: "party",
            populate: {
              path: "owner uploads",
            },
          },
          ...req.query,
        },
      });
      partyGuests.data = await Promise.all(
        partyGuests.data.map(async (pg) => {
          return {
            ...pg.party,
            ...(await Party.getCounts(req.user, pg.party)),
          };
        })
      );
      res.send(partyGuests);
    } catch (e) {
      next(e);
    }
  });
  app.get("/parties/:id/invitetoken", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      let party = await Party.get(id, {
        query: {
          $select: { "+inviteToken": 1 },
        },
      });
      let inviteToken = party.inviteToken;
      const isPartyOwner = party.owner.toString() === req.user?._id.toString();
      const isPartyAdmin = !!party.admins?.find(
        (a) => a.user?.toString() === req.user._id.toString()
      );
      if (!isPartyOwner && !isPartyAdmin && party.privacyLevel === "secret") {
        inviteToken = null;
      }
      res.send({ inviteToken: inviteToken });
    } catch (error) {
      next(error);
    }
  });
  app.get("/parties/:id", optionalAuth, async (req, res, next) => {
    try {
      let { id } = req.params;
      let party = await Party.get(id, {
        query: {
          $populate: [
            {
              path: "owner uploads",
            },
            {
              path: "staff.user",
              select: USER_POPULATION_FIELDS,
            },
          ],
          $select: { "+inviteToken": 1 },
        },
      });
      const userHasInviteToken =
        party.inviteToken && req.query.t === party.inviteToken;
      if (!req.user && !userHasInviteToken && party.privacyLevel === "secret") {
        throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
      }
      if (party.privacyLevel === "secret") {
        const canSeeSecretParty = await Party.userCanSeeSecretParty(
          req.user,
          party
        );
        if (!canSeeSecretParty && !userHasInviteToken) {
          throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
        }
      }
      const isAttending = await PartyGuests.isUserAttendingPartyGuest(
        party._id,
        req.user?._id
      );
      const isPartyOwner =
        party.owner._id.toString() === req.user?._id.toString();
      const canSeeInformationForAcceptedGuests = isAttending || isPartyOwner;
      if (!canSeeInformationForAcceptedGuests) {
        party.informationForAcceptedGuests = null;
      }

      party.isUploadAllowed = await Party.isUploadAllowed(req.user, party);
      party.canJoinParty = (
        await Party.canUserJoinParty(req.user, party)
      ).canJoinParty;
      party = { ...party, ...(await Party.getCounts(req.user, party)) };
      if (!req.user || !isPartyOwner) {
        delete party.inviteToken;
      }
      const myStaffObject = party.staff?.find(
        (staff) => staff.user?._id.toString() === req.user._id.toString()
      );
      party = {
        ...party,
        myStaffObject,
      };
      res.send(party);
    } catch (e) {
      next(e);
    }
  });

  app.get("/parties", auth, async (req, res, next) => {
    try {
      const query = { ...req.query };
      if (
        !User.hasAdminRightsTo(
          req.user,
          User.adminRights.canSeeSecretParties
        ) &&
        query.owner !== req.user._id.toString()
      ) {
        query.privacyLevel = { $ne: "secret" };
        query.status = { $ne: "draft" };
        query.expired = false;
      }
      const result = await Party.find({
        query,
      });
      result.data = await Promise.all(
        result.data.map(async (p) => {
          return { ...p, ...(await Party.getCounts(req.user, p)) };
        })
      );
      res.send(result);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/parties/:id", auth, async (req, res, next) => {
    try {
      validate(PartySchema.PATCH, req.body);
      let { id } = req.params;
      const party = await Party.get(id);
      if (!User.hasRightsTo(req.user, party, User.rights.canManageParty)) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      if (req.body.menuCard) {
        const menuCard = await MenuCard.get(req.body.menuCard);
        const ticketingShop = await TicketingShop.getTicketingShopForUser(
          party.owner
        );
        if (!ticketingShop || !ticketingShop.isActive) {
          throw papeoError(
            PAPEO_ERRORS.CANNOT_ATTACH_MENUCARD_TO_PARTY_IF_PARTY_HAS_NO_TICKETINGSHOP
          );
        }
        if (menuCard.user.toString() !== req.user._id.toString()) {
          throw new Forbidden();
        }
      }
      const result = await Party.patch(id, req.body);
      await PartyAdminActivity.logAdminPartyChanges(req.user, party, result);
      res.send(result);
    } catch (e) {
      next(e);
    }
  });

  app.patch("/parties/:id/uploads/order", auth, async (req, res, next) => {
    try {
      validate(PartySchema.uploadOrder, req.body);
      let { id } = req.params;
      const party = await Party.get(id);
      if (
        !User.hasRightsTo(req.user, party, User.rights.canManagePartyPhotos)
      ) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      res.send(await Party.patchUploadOrder(id, req.body));
    } catch (e) {
      next(e);
    }
  });

  app.patch("/parties/:partyId/onsitecheck", auth, async (req, res, next) => {
    try {
      validate(PartySchema.onSiteCheck, req.body);
      const { partyId } = req.params;
      const { onSite } = req.body;
      const party = await Party.get(partyId);
      if (!party) {
        throw papeoError(PAPEO_ERRORS.PARTY_DOES_NOT_EXIST);
      }
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
      if (onSite === "no") {
        return res.send(
          await PartyGuests.patch(partyGuests[0]._id, { onSite: "no" })
        );
      }
      if (onSite === "yes") {
        const nearbyUsers = await Party.getAllNearbyUsers(party);
        const found = nearbyUsers.find(
          (nbu) => nbu._id.toString() === req.user._id.toString()
        );
        if (!found) {
          throw papeoError(PAPEO_ERRORS.NOT_CLOSE_ENOUGH_TO_PARTY);
        }
        return res.send(
          await PartyGuests.patch(partyGuests[0]._id, { onSite: "yes" })
        );
      }
      const receiver = await User.get(party.owner.toString());
      // I18N
      const lang = {
        de: `(Automatisch generierte Nachricht) Bitte markieren sie mich als anwesend auf der Party "${party.name}."`,
        en: `(Automatically generated message) Please mark me as present at the party "${party.name}".`,
        it: `(Messaggio generato automaticamente) Segnami come presente alla festa "${party.name}".`,
        fr: `(Message généré automatiquement) Veuillez me marquer comme étant présent à la fête "${party.name}".`,
        es: `(Mensaje generado automáticamente) Por favor, márqueme como presente en la fiesta "${party.name}".`,
      };
      await createPartyConversationAndSendMessage({
        party,
        receiverId: party.owner.toString(),
        message: lang[receiver.languageSetting || "de"],
        senderId: partyGuests[0].user.toString(),
      });
      res.send(
        await PartyGuests.patch(partyGuests[0]._id, { onSite: "asked_owner" })
      );
    } catch (e) {
      next(e);
    }
  });

  app.delete("/parties/:id", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      // TODO cannot delete party after it started?
      const party = await Party.get(id);
      if (party.owner.toString() !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      res.send(await Party.remove(id));

      let currentDate = new Date();
      if (
        currentDate < (new Date(party.startDate) || new Date(party.endDate))
      ) {
        await createActivityTargetGroup({
          type: "partyCanceled",
          targetGroups: {
            parties: [
              await getGuestWaitingPartyUserIds(party._id),
              await getBookmarkedPartyUserIds(party._id),
            ],
          },
          additionalInformation: {
            name: party.name,
            startDate: party.startDate,
            endDate: party.endDate,
          },
          sendNotification: true,
        });
      }
    } catch (e) {
      next(e);
    }
  });
};
