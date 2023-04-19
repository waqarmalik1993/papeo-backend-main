const getLanguage =
  require("../services/users/modules/authentication/local.js").getLanguage;
const validatePhoneNumber =
  require("../services/users/modules/authentication/local.js").validatePhoneNumber;
const User = require("../services/users/usersService.js");
const AdminLog = require("../services/adminlogs/adminLogsService");

const { removeAccessToken } = require("../services/users/modules/fcmToken");

const Party = require("../services/parties/partiesService");
const PartyGuest = require("../services/partyGuests/partyGuestsService");
const Upload = require("../services/uploads/uploadsService");
const authenticate = require("../services/users/authenticate.js");
const UserSchema = require("../modules/validation/users.js").UserSchema;
const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;
const search = require("feathers-mongodb-fuzzy-search");
const {
  verifyUserEmailOrPhone,
} = require("../services/users/modules/authentication/local");
const { data } = require("../logger.js");
const { BadRequest } = require("@feathersjs/errors");

module.exports = async (app) => {
  app.hooks({
    before: {
      all: [
        search(), // full text search on text indexes
        search({
          // regex search on given fields
          fields: ["username", "firstName", "lastName"],
        }),
      ],
    },
  });

  app.post("/users/authenticate", async (req, res, next) => {
    try {
      console.log("Authentication called!");
      await authenticate(req, res);
    } catch (e) {
      next(e);
    }
  });

  app.post("/callbacks/sign_in_with_apple", (request, response) => {
    const redirect = `intent://callback?${new URLSearchParams(
      request.body
    ).toString()}#Intent;package=${"party.papeo"};scheme=signinwithapple;end`;

    console.log(`Redirecting to ${redirect}`);

    response.redirect(307, redirect);
  });

  // TODO Code auslagern
  app.post("/users/available", auth, async (req, res, next) => {
    let phoneNumber;
    let userId = req.user._id.toString();
    try {
      let data = req.body;
      switch (data?.type) {
      case "email":
        validate(UserSchema.availableValidation.email, data);
        if (await User.alreadyInUseByOtherUser("email", data.email, userId)) {
          throw papeoError(PAPEO_ERRORS.EMAIL_ALREADY_EXISTS);
        }
        return res.send({ available: true });
      case "phoneNumber":
        validate(UserSchema.availableValidation.phoneNumber, data);
        phoneNumber = validatePhoneNumber(data.phoneNumber);
        if (
          await User.alreadyInUseByOtherUser(
            "phoneNumber",
            phoneNumber,
            userId
          )
        ) {
          throw papeoError(PAPEO_ERRORS.USER_WITH_PHONENUMBER_ALREADY_EXISTS);
        }
        break;
      case "username":
        let isAllowed = true;
        try {
          validate(UserSchema.availableValidation.username, data);
        } catch (error) {
          isAllowed = false;
        }
        if (
          (await User.alreadyInUseByOtherUser(
            "username",
            data.username,
            userId
          )) ||
            (await User.alreadyInUseByOtherUser(
              "usernameLowercase",
              data.username.toLowerCase(),
              userId
            ))
        ) {
          throw papeoError(PAPEO_ERRORS.USERNAME_ALREADY_EXISTS);
        }
        return res.send({ available: true, isAllowed });
        break;
      default:
        throw papeoError(PAPEO_ERRORS.TYPE_DOES_NOT_EXIST);
      }
      return res.send({ available: true });
    } catch (e) {
      next(e);
    }
  });

  app.post("/users/logout", auth, async (req, res, next) => {
    try {
      await removeAccessToken(req.user, req.headers.authorization);
      res.send("OK");
    } catch (e) {
      next(e);
    }
  });

  app.patch("/users/verify", auth, async (req, res, next) => {
    try {
      res.send(await verifyUserEmailOrPhone(req));
    } catch (e) {
      next(e);
    }
  });
  app.patch("/users/lastactivity", auth, async (req, res, next) => {
    try {
      res.send({
        lastActivityAt: (await User.updateLastActivity(req.user._id.toString()))
          .lastActivityAt,
      });
    } catch (e) {
      next(e);
    }
  });

  app.get("/users/search", auth, async (req, res, next) => {
    try {
      //console.log(req.query);
      if (req.query.sex) {
        if (!Array.isArray(req.query.sex)) req.query.sex = [req.query.sex];
      }
      if (req.query.include) {
        if (!Array.isArray(req.query.include))
          req.query.include = [req.query.include];
      }
      validate(UserSchema.search, req.query);
      res.send(await User.search(req.user, req.query));
    } catch (e) {
      next(e);
    }
  });
  app.get("/users/artists", async (req, res, next) => {
    try {
      validate(UserSchema.listArtists, req.query);
      if (req.query.text_search) {
        req.query.usernameLowercase = new RegExp(req.query.text_search, "i");
        delete req.query.text_search;
      }
      res.send(
        await User.find({
          query: {
            ...req.query,
            isArtist: true,
            $sort: { isArtistUpdatedDate: -1 },
          },
        })
      );
    } catch (e) {
      next(e);
    }
  });

  app.get("/users/:id/settings", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      if (id !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      return res.send(req.user.settings);
    } catch (e) {
      next(e);
    }
  });

  app.put("/users/:id/settings", auth, async (req, res, next) => {
    try {
      validate(UserSchema.settings.UPDATE, req.body);
      let { id } = req.params;
      if (id !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      await User.patch(id, { settings: req.body });
      res.send(User.filterOwnUser(await User.getRaw(id)));
    } catch (e) {
      next(e);
    }
  });
  app.get("/users/blocked", auth, async (req, res, next) => {
    try {
      const result = await User.get(req.user._id, {
        query: {
          $populate: {
            path: "blockedUsers",
            options: { sort: { createdAt: 1 } },
          },
        },
      });
      res.send(result.blockedUsers);
    } catch (e) {
      next(e);
    }
  });
  app.get("/users/:id", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      if (User.isBlockedBy(req.user, id)) {
        throw papeoError(PAPEO_ERRORS.NOT_FOUND);
      }
      const attendedPartyCount = await PartyGuest.MODEL.countDocuments({
        user: id,
        onSite: "yes",
      });
      const registeredPartyCount = await PartyGuest.MODEL.countDocuments({
        user: id,
        status: "attending",
      });
      if (req.user._id.toString() === id) {
        return res.send(
          User.filterOwnUser({
            ...req.user,
            attendedPartyCount,
            registeredPartyCount,
            partyPoints: parseInt(req.user.partyPoints),
          })
        );
      }
      let user = null;
      if (User.hasAdminRightsTo(req.user, User.adminRights.manageAdmins)) {
        user = await User.getRaw(id);
        if (!user) {
          throw papeoError(PAPEO_ERRORS.NOT_FOUND);
        }
      } else {
        user = await User.get(id);
      }
      const followed = !!(await User.isUserFollowedBy(
        id,
        req.user._id.toString()
      ));
      const followsMe = !!(await User.isUserFollowedBy(
        req.user._id.toString(),
        id
      ));

      // remove tokens from response
      return res.send({
        ...user,
        tokens: undefined,
        followed,
        followsMe,
        attendedPartyCount,
        registeredPartyCount,
        partyPoints: parseInt(user.partyPoints),
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/users/:id/attendedparties", auth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = await User.get(id);
      req.query.$populate = {
        path: "party",
        populate: {
          path: "owner uploads",
        },
      };
      if (req.user._id.toString() !== id) {
        req.query.type = { $ne: "secret" };
      }
      let attendedParties = await PartyGuest.find({
        query: {
          user: id,
          onSite: "yes",
          ...req.query,
        },
      });

      return res.send(attendedParties);
    } catch (e) {
      next(e);
    }
  });
  app.get("/users/:id/ratings", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      return res.send(
        await Party.find({
          query: {
            owner: id,
            "rating.count": { $gt: 0 },
            $populate: {
              path: "owner uploads",
            },
          },
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.get("/users/:id/activeparties", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      return res.send(await Party.getActivePartiesFromUser(id));
    } catch (e) {
      next(e);
    }
  });

  app.get("/users", auth, async (req, res, next) => {
    try {
      console.log({ query: req.query });
      res.send(await User.find({ query: req.query }));
    } catch (e) {
      next(e);
    } 
  });

  app.patch("/users/:id", auth, async (req, res, next) => {
    try {
      validate(UserSchema.PATCH, req.body);
      let { id } = req.params;
      const params = { user: req.user };
      if (id !== req.user._id.toString()) {
        if (!req.body.referredBy) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        if (!req.user.isPartyKing) {
          throw new BadRequest(
            "you cannot refer a user if you are not an partyking"
          );
        }
        const userToPatch = await User.get(id);
        if (userToPatch.referredBy) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        // delete all other fields than referredBy
        req.body = { referredBy: req.body.referredBy };
        const inTwoWeeks = new Date();
        inTwoWeeks.setTime(inTwoWeeks.getTime() + 14 * 24 * 60 * 60 * 1000);
        req.body.referredByEditableUntil = inTwoWeeks;
      }
      await User.patch(id, req.body, params);
      res.send(User.filterOwnUser(await User.getRaw(id)));
    } catch (e) {
      next(e);
    }
  });

  app.patch("/users/:id/phonenumber", auth, async (req, res, next) => {
    try {
      validate(UserSchema.PATCH_phonenumber, req.body);
      let { id } = req.params;
      const params = { user: req.user };

      if (!req.user.isAdmin && !req.user.isSuperAdmin) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      await User.patch(
        id,
        {
          email: null,
          phoneNumber: validatePhoneNumber(req.body.phoneNumber),
          successfulLoginCount: 3,
        },
        params
      );
      res.send(User.filterOwnUser(await User.getRaw(id)));
    } catch (e) {
      next(e);
    }
  });

  app.delete("/users/:id", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      if (id !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      const result =
        process.env.STAGE === "staging"
          ? await User.remove(id)
          : await User.patch(id, {
            locked: true,
            deletedAt: new Date(),
          });
      res.send(result);
      await AdminLog.TYPES.userDeletedHimself({ affectedUser: result });
    } catch (e) {
      next(e);
    }
  });

  app.post("/users/:id/block", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      if (req.user._id.toString() === id) {
        throw papeoError(PAPEO_ERRORS.YOU_CANNOT_BLOCK_YOURSELF);
      }
      await User.get(id);
      await User.blockUser(req.user._id, id);
      const result = await User.get(req.user._id, {
        query: {
          $populate: {
            path: "blockedUsers",
            options: { sort: { createdAt: 1 } },
          },
        },
      });
      res.send(result.blockedUsers);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/users/:id/block", auth, async (req, res, next) => {
    try {
      let { id } = req.params;
      await User.get(id);
      await User.unblockUser(req.user._id, id);
      const result = await User.get(req.user._id, {
        query: {
          $populate: {
            path: "blockedUsers",
            options: { sort: { createdAt: 1 } },
          },
        },
      });
      res.send(result.blockedUsers);
    } catch (e) {
      next(e);
    }
  });

  ////#region PROFILE BANNER
  app.put("/users/:userId/profilebanner", auth, async (req, res, next) => {
    try {
      validate(UserSchema.putProfileBanner, req.body);
      let { userId } = req.params;
      const profileBanner = req.body;
      if (!req.user.isAdmin) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      const user = await User.get(userId);
      if (!user.isPartyKing && !user.isArtist) {
        throw papeoError(PAPEO_ERRORS.USER_MUST_BE_PARTYKING_TO_CHANGE_BANNER);
      }
      if (req.body.upload) {
        const dbUpload = await Upload.get(req.body.upload);
        if (dbUpload.user.toString() !== req.user._id.toString()) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }
        await Upload.patch(dbUpload._id, {
          profileBannerFromUser: user._id,
        });
      }
      res.send(
        (
          await User.patch(user._id, {
            profileBanner,
          })
        ).profileBanner
      );
    } catch (e) {
      next(e);
    }
  });
  app.delete("/users/:userId/profilebanner", auth, async (req, res, next) => {
    try {
      let { userId } = req.params;
      if (!req.user.isAdmin) {
        throw papeoError(PAPEO_ERRORS.NOT_ENOUGH_RIGHTS);
      }
      const user = await User.get(userId);

      await User.patch(user._id, {
        profileBanner: null,
      });

      if (user.profileBanner?.upload) {
        try {
          await Upload.remove(user.profileBanner?.upload);
          // eslint-disable-next-line no-empty
        } catch {}
      }
      res.send({});
    } catch (e) {
      next(e);
    }
  });
  ////#endregion
};

/*
setTimeout(async () => {
  console.log(
    JSON.stringify(
      await User.find({
        query: { _id: "6130f0f0d3b8c00008099e71", $select: "tokens" },
      }),
      null,
      2
    )
  );
}, 1500);
*/
