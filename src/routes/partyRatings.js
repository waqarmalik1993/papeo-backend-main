const PartySchema = require("../modules/validation/parties.js").PartySchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const Rating = require("../services/ratings/ratingsService.js");
const User = require("../services/users/usersService");
const PartyGuest = require("../services/partyGuests/partyGuestsService");
const Party = require("../services/parties/partiesService.js");
const Activity = require("../services/activities/activitiesService");
const AdminLog = require("../services/adminlogs/adminLogsService");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
module.exports = async (app) => {
  app.post("/parties/:partyId/ratings", auth, async (req, res, next) => {
    try {
      validate(PartySchema.ratings.POST, req.body);
      const { partyId } = req.params;
      const party = await Party.get(partyId);
      const rating = {
        party: partyId,
        user: `${req.user._id}`,
        value: req.body.value,
        comment: req.body.comment,
        partyOwner: party.owner.toString(),
      };
      validate(PartySchema.ratings.RATING, rating);

      if (User.isBlockedByOrBlocking(req.user, party.owner)) {
        throw papeoError(PAPEO_ERRORS.NOT_FOUND);
      }
      if (party.owner.toString() === req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.YOU_CANNOT_RATE_YOUR_OWN_PARTY);
      }
      const partyGuest = await PartyGuest.find({
        query: {
          user: req.user._id.toString(),
          party: partyId,
        },
      });
      if (partyGuest.data.length === 0) {
        throw papeoError(PAPEO_ERRORS.YOU_ARE_NOT_A_GUEST_OF_THIS_PARTY);
      }
      if (!!!partyGuest.data[0].onSite) {
        throw papeoError(PAPEO_ERRORS.CANNOT_RATE_PARTY_WHEN_NOT_ON_SITE);
      }
      res.send(await Rating.create(rating));
    } catch (e) {
      next(e);
    }
  });

  app.delete(
    "/parties/:partyId/ratings/:ratingId",
    auth,
    async (req, res, next) => {
      try {
        const { partyId, ratingId } = req.params;
        const rating = await Rating.get(ratingId);
        if (rating.user.toString() !== req.user._id.toString()) {
          if (!User.hasAdminRightsTo(req.user, User.adminRights.deleteRating)) {
            throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
          }
          await AdminLog.TYPES.deletedRating({
            userId: req.user._id,
            rating,
          });
          await Activity.create({
            type: "adminDeletedPartyRating",
            notificationCategories: ["parties"],
            user: rating.user,
            otherUsers: [rating.user],
            sendNotification: true,
            parties: [rating.party],
          });
          await Activity.create({
            type: "adminDeletedPartyRating",
            notificationCategories: ["parties"],
            user: (await Party.get(rating.party)).owner,
            otherUsers: [rating.user],
            sendNotification: true,
            parties: [rating.party],
          });
        }
        res.send(await Rating.remove(ratingId));
      } catch (e) {
        next(e);
      }
    }
  );

  app.patch(
    "/parties/:partyId/ratings/:ratingId",
    auth,
    async (req, res, next) => {
      try {
        const { partyId, ratingId } = req.params;
        validate(PartySchema.ratings.PATCH, req.body);
        res.send(await Rating.patch(ratingId, req.body));
      } catch (e) {
        next(e);
      }
    }
  );

  app.get("/parties/:partyId/ratings", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      res.send(await Rating.find({ query: { ...req.query, party: partyId } }));
    } catch (e) {
      next(e);
    }
  });
};
