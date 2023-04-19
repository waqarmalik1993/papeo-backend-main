const MyPartyGuestsSchema =
  require("../modules/validation/myPartyGuests").MyPartyGuestsSchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const MyPartyGuests = require("../services/myPartyGuests/myPartyGuestsService");
const PartyAdminActivity = require("../services/partyAdminActivities/partyAdminActivitiesService");
const Party = require("../services/parties/partiesService");
const Follower = require("../services/followers/followersService");
const User = require("../services/users/usersService");
const Activity = require("../services/activities/activitiesService");
const Invite = require("../services/invites/invitesService");
const { data } = require("../logger");

const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const MY_PARTY_GUESTS_POPULATION_USER_SELECTION = {
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

module.exports = async (app) => {
  app.get("/users/mypartyguests", auth, async (req, res, next) => {
    try {
      const result = await MyPartyGuests.find({
        query: {
          ...req.query,
          user: req.user._id,
          $populate: {
            path: "guest",
            select: MY_PARTY_GUESTS_POPULATION_USER_SELECTION,
          },
        },
      });
      result.data = await Promise.all(
        result.data.map(async (mpg) => {
          mpg.guest = {
            ...mpg.guest,
            partyFriendsCount: mpg.guest.partyFriends.filter(
              (pf) => pf.status === "accepted"
            ).length,
            followerCount: await Follower.getFollowerCount(mpg.guest._id),
            partyFriends: undefined,
          };
          return mpg;
        })
      );
      res.send(result);
    } catch (e) {
      next(e);
    }
  });

  app.delete(
    "/users/mypartyguests/:myPartyGuestId",
    auth,
    async (req, res, next) => {
      try {
        const { myPartyGuestId } = req.params;
        const myPartyGuest = await MyPartyGuests.get(myPartyGuestId);
        if (myPartyGuest.user.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
        }
        res.send(await MyPartyGuests.remove(myPartyGuestId));
      } catch (e) {
        next(e);
      }
    }
  );

  app.post("/users/mypartyguests", auth, async (req, res, next) => {
    try {
      validate(MyPartyGuestsSchema.POST, req.body);
      const { body } = req;
      await User.get(body.guest);
      res.send(
        await MyPartyGuests.create(
          {
            user: req.user._id,
            guest: body.guest,
          },
          {
            query: {
              $populate: {
                path: "guest",
                select: MY_PARTY_GUESTS_POPULATION_USER_SELECTION,
              },
            },
          }
        )
      );
    } catch (e) {
      next(e);
    }
  });
  app.patch(
    "/users/mypartyguests/:myPartyGuestId",
    auth,
    async (req, res, next) => {
      try {
        validate(MyPartyGuestsSchema.PATCH, req.body);
        const { myPartyGuestId } = req.params;
        const myPartyGuest = await MyPartyGuests.get(myPartyGuestId);
        if (myPartyGuest.user.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
        }
        res.send(await MyPartyGuests.patch(myPartyGuestId, req.body));
      } catch (e) {
        next(e);
      }
    }
  );
};
