const PartyStaffSchema =
  require("../modules/validation/partyStaff").PartyStaffSchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const User = require("../services/users/usersService.js");
const Party = require("../services/parties/partiesService.js");
const PartyGuest = require("../services/partyGuests/partyGuestsService");
const PartyAdminActivity = require("../services/partyAdminActivities/partyAdminActivitiesService");
const Transaction = require("../services/transactions/transactionsService");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const firebaseModule = require("../services/users/modules/firebase/users");
const Activity = require("../services/activities/activitiesService");
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
const {
  createActivityTargetGroup,
} = require("../services/activities/createActivityTargetGroup");
const {
  getPartyAdmins,
} = require("../services/activities/helper/getTargetGroup");
const { Forbidden } = require("@feathersjs/errors");
module.exports = async (app) => {
  app.get("/parties/staff/mywork", auth, async (req, res, next) => {
    try {
      const yesterday = new Date();
      yesterday.setTime(yesterday.getTime() - 1 * 24 * 60 * 60 * 1000);
      const parties = await Party.find({
        query: {
          "staff.user": req.user._id,
          startDate: { $gt: yesterday },
          $sort: { startDate: 1 },
          $populate: [
            {
              path: "staff.user",
              select: USER_POPULATION_FIELDS,
            },
            {
              path: "owner",
              select: USER_POPULATION_FIELDS,
            },
          ],
        },
      });

      parties.data = await Promise.all(
        parties.data.map(async (party) => {
          const myStaffObject = party.staff.find(
            (staff) => staff.user._id.toString() === req.user._id.toString()
          );
          return {
            ...party,
            myStaffObject,
          };
        })
      );
      res.send(parties);
    } catch (e) {
      next(e);
    }
  });

  app.get("/parties/:partyId/staff", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      const { user } = req.query;
      const party = await Party.get(partyId);
      if (!party) throw papeoError(PAPEO_ERRORS.PARTY_DOES_NOT_EXIST);
      if (!party.staff) return res.send([]);
      const result = [];
      await Promise.all(
        party.staff
          .filter((a) => !user || a.user.toString() === user)
          .map(async (staff) => {
            const user = await User.get(staff.user);
            result.push({ ...staff, user });
          })
      );
      res.send(result);
    } catch (e) {
      next(e);
    }
  });

  app.post("/parties/:partyId/staff", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      validate(PartyStaffSchema.POST, req.body);
      const party = await Party.get(partyId);
      if (party.owner.toString() !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.ONLY_PARTY_OWNERS_CAN_ADD_ADMINS);
      }

      for (const data of req.body) {
        const staffUser = await User.get(data.user);
        if (!staffUser) throw papeoError(PAPEO_ERRORS.USER_DOES_NOT_EXIST);
      }

      await Promise.allSettled(
        req.body.map(async (data) => {
          return await Party.addPartyStaff(partyId, data);
        })
      );
      const result = (
        await Party.get(partyId, {
          query: {
            $populate: { path: "staff.user", select: USER_POPULATION_FIELDS },
          },
        })
      ).staff;
      res.send(result);
    } catch (e) {
      next(e);
    }
  });

  app.patch(
    "/parties/:partyId/staff/:staffUserId",
    auth,
    async (req, res, next) => {
      try {
        const { partyId, staffUserId } = req.params;
        validate(PartyStaffSchema.PATCH, req.body);
        const party = await Party.get(partyId);
        const staffUser = await User.get(staffUserId);
        if (!staffUser) throw papeoError(PAPEO_ERRORS.USER_DOES_NOT_EXIST);
        if (party.owner.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.ONLY_PARTY_OWNERS_CAN_ADD_ADMINS);
        }
        await Party.patchPartyStaff(partyId, {
          user: staffUserId,
          ...req.body,
        });
        const result = await Party.get(partyId, {
          query: {
            $populate: { path: "staff.user", select: USER_POPULATION_FIELDS },
          },
        });
        res.send(result.staff);
      } catch (e) {
        next(e);
      }
    }
  );

  app.post(
    "/parties/:partyId/staff/:staffUserId/decline",
    auth,
    async (req, res, next) => {
      try {
        const { partyId, staffUserId } = req.params;
        validate(PartyStaffSchema.declineWork, req.body);
        const party = await Party.get(partyId);
        if (req.user._id.toString() !== staffUserId) {
          throw new Forbidden();
        }
        const result = await Party.removePartyStaff(partyId, staffUserId);
        await Activity.create({
          user: party.owner,
          otherUsers: [staffUserId],
          type: "partyStaffCancelled",
          additionalInformation: {},
          notificationCategories: ["parties"],
          parties: [party._id],
          sendNotification: true,
        });

        res.send(result.staff);
      } catch (e) {
        next(e);
      }
    }
  );

  app.delete(
    "/parties/:partyId/staff/:staffUserId",
    auth,
    async (req, res, next) => {
      try {
        const { partyId, staffUserId } = req.params;
        const party = await Party.get(partyId);
        if (party.owner.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.ONLY_PARTY_OWNERS_CAN_REMOVE_ADMINS);
        }
        const result = await Party.removePartyStaff(partyId, staffUserId);

        res.send(result.staff);
      } catch (e) {
        next(e);
      }
    }
  );
};
