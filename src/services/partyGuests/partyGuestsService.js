const service = require("feathers-mongoose");
const Model = require("../../models/partyGuests.model.js");
const Party = require("../parties/partiesService.js");
const MyPartyGuests = require("../myPartyGuests/myPartyGuestsService");
const User = require("../users/usersService");
const Bookmark = require("../bookmarks/bookmarksService");
const Activity = require("../activities/activitiesService");
const Invite = require("../invites/invitesService");
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../../modules/errors/errors.js").papeoError;
const {
  createActivityTargetGroup,
} = require("../activities/createActivityTargetGroup");
const {
  getPartyAdmins,
  getFriendIdsFromUser,
  getFollowerIdsFromUser,
  getGuestListUserIds,
} = require("../activities/helper/getTargetGroup");
const {
  createPartyConversationAndSendMessage,
} = require("../users/modules/firebase/users");
const options = {
  Model: Model(),
  paginate: {
    default: 10,
    max: 1000,
  },
  multi: ["patch", "remove"],
  whitelist: [
    "$populate",
    "$regex",
    "$options",
    "$geoWithin",
    "$centerSphere",
    "$geometry",
    "$near",
    "$maxDistance",
    "$minDistance",
    "$nearSphere",
    "$geoNear",
    "$sort",
  ],
};
exports.MODEL = options.Model;

const get = async (id) => {
  const result = await service(options).get(id);
  return result;
};

const exists = async (id) => {
  const result = await options.Model.exists({ _id: id });
  return result;
};

const getByOneAttribute = async (attributeName, value) => {
  const result = await service(options).find({
    query: {
      [attributeName]: value,
    },
  });
  return result.data.length ? result.data[0] : null;
};

const find = async (query) => {
  const result = await service(options).find(query);
  return result;
};

const create = async (data, params) => {
  const partyId = data.party;
  const userId = data.user;
  const party = await Party.get(partyId);

  // check if seat is free
  const partyIsFull = (await getPartyGuestCount(partyId)) >= party.capacity;
  if (partyIsFull) throw papeoError(PAPEO_ERRORS.GUESTLIST_IS_FULL);

  // check if user has an partyGuest entry for this party
  const isUserAnyPartyGuestResult = await isUserAnyPartyGuest(partyId, userId);
  if (isUserAnyPartyGuestResult) {
    throw papeoError(PAPEO_ERRORS.USER_IS_ALREADY_GUEST);
  }
  const user = await User.get(userId);
  let isNewUser = false;
  if (
    user.attendedCompetitionParty &&
    user.attendedCompetitionParty.toString() === partyId
  ) {
    isNewUser = true;
  }

  const result = await service(options).create({
    party: partyId,
    user: userId,
    username: user.usernameLowercase,
    sex: user.sex,
    status: party.privacyLevel === "open" ? "attending" : "requested",
    isNewUser,
    isUserVerified: user.verification.verified,
    isNewPartyGuest: party.privacyLevel === "open",
  });
  if (result.status === "attending") {
    await MyPartyGuests.create({
      user: party.owner,
      guest: result.user,
    });
  }
  if (result.status === "requested") {
    await Activity.create({
      type: "partyGuestRequested",
      notificationCategories: ["parties"],
      user: party.owner,
      otherUsers: [userId],
      parties: [party._id],
      sendNotification: true,
    });
    // send partyGuestRequested to all partyadmins
    await Promise.all(
      party.admins.map((pa) => {
        return Activity.create({
          type: "partyGuestRequested",
          notificationCategories: ["parties"],
          user: pa.user,
          otherUsers: [userId],
          parties: [party._id],
          sendNotification: true,
        });
      })
    );
  }

  if (party.informationForAcceptedGuests && party.privacyLevel === "open") {
    await createPartyConversationAndSendMessage({
      party,
      receiverId: userId,
      message: party.informationForAcceptedGuests,
      senderId: party.owner.toString(),
    });
  }
  // remove bookmark if existing
  await Bookmark.MODEL.deleteOne({ party: partyId, user: userId });

  console.log(`Created PartyGuest ${result._id}`);
  return result;
};

const patch = async (id, data) => {
  const partyGuest = await get(id);
  const result = await service(options).patch(id, data);
  const party = await Party.get(result.party);
  if (result.status === "attending" && partyGuest.status !== "attending") {
    await MyPartyGuests.create({
      user: party.owner,
      guest: result.user,
    });
  }

  if (data.onSite && data.onSite === "yes" && partyGuest.onSite !== "yes") {
    const targetGroups = {
      parties: await getPartyAdmins(party),
    };
    if (party.privacyLevel !== "secret") {
      targetGroups.friends = getFriendIdsFromUser(await User.get(result.user));
      targetGroups.following = await getFollowerIdsFromUser(result.user);
    }
    if (party.calculatedEndDate > new Date()) {
      await createActivityTargetGroup({
        type: "partyGuestOnSite",
        otherUsers: [result.user],
        parties: [result.party],
        targetGroups,
        sendNotification: true,
      });
    }
  }
  return result;
};

const remove = async (id) => {
  const result = await service(options).remove(id);
  return result;
};

const removeManyByPartyId = async (partyId) => {
  const result = await options.Model.deleteMany({ party: partyId });
  return result;
};

const isUserAnyPartyGuest = async (partyId, userId) => {
  const result = await find({
    query: {
      party: partyId,
      user: userId,
    },
  });
  return result.data.length > 0;
};

const isUserAttendingPartyGuest = async (partyId, userId) => {
  if (!userId) return false;
  const result = await options.Model.findOne({
    party: partyId,
    user: userId,
    status: "attending",
  });
  return !!result;
};

const getPartyGuestCount = async (partyId) => {
  return await options.Model.countDocuments({
    party: partyId,
    status: "attending",
  });
};

const getNewUserCount = async (partyId) => {
  return await options.Model.countDocuments({
    party: partyId,
    isNewUser: true,
    isUserVerified: true,
  });
};
exports.getNewUserCount = getNewUserCount;

const getNewUserCountOnsite = async (partyId) => {
  return await options.Model.countDocuments({
    party: partyId,
    isNewUser: true,
    onSite: "yes",
    isUserVerified: true,
  });
};
exports.getNewUserCountOnsite = getNewUserCountOnsite;

const getAllAttendingPartyGuestsWhichOnsiteStatusIsUnknown = async () => {
  return await options.Model.find({
    onSite: "unknown",
    status: "attending",
  });
};
exports.getAllAttendingPartyGuestsWhichOnsiteStatusIsUnknown =
  getAllAttendingPartyGuestsWhichOnsiteStatusIsUnknown;
const getAllNewPartyGuests = async () => {
  return await options.Model.find({
    isNewPartyGuest: true,
  });
};
exports.getAllNewPartyGuests = getAllNewPartyGuests;

const sendNewPartyGuestsNotificationToPartyGuests = async () => {
  const newPartyGuests = await options.Model.find({ isNewPartyGuest: true });
  const parties = {};
  for (const pg of newPartyGuests) {
    if (parties[pg.party.toString()] === undefined) {
      parties[pg.party.toString()] = 0;
    }
    parties[pg.party.toString()] = parties[pg.party.toString()] + 1;
  }
  await options.Model.updateMany({}, { isNewPartyGuest: false });
  await Promise.all(
    Object.keys(parties).map(async (partyId) => {
      console.log({ partyId });
      return await createActivityTargetGroup({
        type: "newPartyGuests",
        parties: [partyId],
        targetGroups: {
          parties: await getGuestListUserIds(partyId),
        },
        additionalInformation: {
          newPartyGuestCount: parties[partyId],
        },
        sendNotification: true,
      });
    })
  );
};
exports.sendNewPartyGuestsNotificationToPartyGuests =
  sendNewPartyGuestsNotificationToPartyGuests;

const getFriendsAttendingThisParty = async (user, partyId) => {
  let res = await options.Model.find({
    party: partyId,
    status: "attending",
    user: {
      $in: user.partyFriends
        .filter((pf) => pf.status === "accepted")
        .map((pf) => pf.friend),
    },
  }).populate({
    path: "user",
  });
  res = res.map((r) => r.user);
  return res;
};
exports.getFriendsAttendingThisParty = getFriendsAttendingThisParty;

const getAnyPartyGuestsIdsByParty = async (partyId) => {
  const res = await options.Model.find({
    party: partyId,
  })
    .select({ user: 1 })
    .lean();

  return res.map((r) => r.user);
};
exports.getAnyPartyGuestsIdsByParty = getAnyPartyGuestsIdsByParty;

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
exports.removeManyByPartyId = removeManyByPartyId;
exports.isUserAnyPartyGuest = isUserAnyPartyGuest;
exports.isUserAttendingPartyGuest = isUserAttendingPartyGuest;
exports.getPartyGuestCount = getPartyGuestCount;
