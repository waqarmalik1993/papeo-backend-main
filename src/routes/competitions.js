const Party = require("../services/parties/partiesService.js");
const User = require("../services/users/usersService");
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const { CompetitionsSchema } = require("../modules/validation/competitions");
const PartyGuests = require("../services/partyGuests/partyGuestsService.js");
const Competition = require("../services/competitions/competitionsService");
const Upload = require("../services/uploads/uploadsService");
const AdminLogs = require("../services/adminlogs/adminLogsService");
const {
  sendNotificationToUser,
} = require("../modules/notifications/push/sendNotification");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const {
  createActivityTargetGroup,
} = require("../services/activities/createActivityTargetGroup.js");
const {
  getGuestListUserIds,
  getBookmarkedPartyUserIds,
} = require("../services/activities/helper/getTargetGroup");
module.exports = async (app) => {
  app.post("/competitions", auth, async (req, res, next) => {
    try {
      validate(CompetitionsSchema.POST, req.body);
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.manageCompetitions)
      ) {
        throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
      }
      req.body.owner = req.user._id;
      res.send(await Competition.create(req.body));
    } catch (e) {
      next(e);
    }
  });
  app.get("/competitions/:id", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      let competition = await Competition.get(id);

      const parties = await Competition.getSortedPartiesByCompetitionId(
        competition._id
      );
      res.send({
        ...competition,
        result: undefined,
        parties,
      });
    } catch (e) {
      next(e);
    }
  });

  app.get("/competitions", auth, async (req, res, next) => {
    try {
      const result = await Competition.find({ query: req.query });

      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.delete("/competitions/:id", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      if (
        !User.hasAdminRightsTo(req.user, User.adminRights.manageCompetitions)
      ) {
        throw papeoError(PAPEO_ERRORS.RESTRICTED_ACTION);
      }
      const result = await Competition.remove(id);
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
  app.post(
    "/competitions/:competitionId/join",
    auth,
    async (req, res, next) => {
      try {
        validate(CompetitionsSchema.join, req.body);
        let { competitionId } = req.params;
        let { party: partyId } = req.body;
        const party = await Party.get(partyId);
        const competition = await Competition.get(competitionId);
        if (party.privacyLevel === "secret") {
          throw papeoError(
            PAPEO_ERRORS.SECRET_PARTIES_CANNOT_JOIN_COMPETITIONS
          );
        }
        if (req.user._id.toString() !== party.owner.toString()) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        if (!Competition.isPartyInCompetitionDateRange(competition, party)) {
          throw papeoError(PAPEO_ERRORS.PARTY_NOT_IN_COMPETITION_DATE_RANGE);
        }
        await createActivityTargetGroup({
          user: party.owner,
          type: "partyParticipatesOnCompetition",
          notificationCategories: ["parties"],
          targetGroups: {
            parties: [
              await getGuestListUserIds(party._id),
              await getBookmarkedPartyUserIds(party._id),
            ],
          },
          parties: [party._id],
          competitions: [competition._id],
          otherUsers: [party.owner],
          sendNotification: true,
        });
        res.send(
          await Competition.addPartyToCompetition(party._id, competition._id)
        );
      } catch (e) {
        next(e);
      }
    }
  );
  app.post(
    "/competitions/:competitionId/remove",
    auth,
    async (req, res, next) => {
      try {
        validate(CompetitionsSchema.remove, req.body);
        let { competitionId } = req.params;
        let { party: partyId, reason, messageToOwner } = req.body;
        const party = await Party.get(partyId);
        const competition = await Competition.get(competitionId);
        if (
          !User.hasAdminRightsTo(req.user, User.adminRights.manageCompetitions)
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        if (
          !party.competition ||
          party.competition.toString() !== competitionId
        ) {
          throw papeoError(
            PAPEO_ERRORS.PARTY_DOES_NOT_BELONG_TO_THIS_COMPETITION
          );
        }
        res.send(await Competition.removePartyFromCompetition(party._id));
        await AdminLogs.TYPES.removedPartyFromCompetition({
          userId: req.user._id,
          affectedUser: await User.get(party.owner),
          party,
          competition,
          reason,
          messageToOwner,
        });
        if (messageToOwner) {
          await sendNotificationToUser(
            party.owner.toString(),
            "Papeo",
            messageToOwner,
            {}
          );
        }
      } catch (e) {
        next(e);
      }
    }
  );
};
