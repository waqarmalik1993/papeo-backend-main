const service = require("feathers-mongoose");
const Model = require("../../models/ratings.model.js");
const mongoose = require("mongoose");
const Party = require("../parties/partiesService.js");
const PartyGuests = require("../partyGuests/partyGuestsService");
const User = require("../users/usersService.js");
const Activity = require("../activities/activitiesService");
const papeoError = require("../../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const {
  sendNotificationToUser,
} = require("../../modules/notifications/push/sendNotification");
const {
  PUSH_PARTY_RATING,
} = require("../../modules/notifications/push/internationalization.js");
const {
  createActivityTargetGroup,
} = require("../activities/createActivityTargetGroup.js");
const {
  getGuestListUserIds,
} = require("../activities/helper/getTargetGroup.js");
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
  ],
};

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

const create = async (data) => {
  // we assume that the owner of the post exists before creating the post
  const isPartyRatedByUserResult = await isPartyRatedByUser(
    data.party,
    data.user
  );
  if (isPartyRatedByUserResult) {
    throw papeoError(PAPEO_ERRORS.PARTY_ALREADY_RATED);
  }
  const result = await service(options).create(data);
  await Party.recalculateRating(data.party);
  await User.recalculateRating(data.partyOwner);
  await Activity.create({
    type: "partyRatingCreated",
    user: result.partyOwner,
    notificationCategories: ["parties"],
    sendNotification: true,
    parties: [result.party],
    otherUsers: [result.user],
    ratings: [result._id],
  });
  await createActivityTargetGroup({
    excludeUsers: [result.user],
    type: "partyRatingCreated",
    targetGroups: {
      parties: await getGuestListUserIds(result.party),
    },
    sendNotification: true,
    parties: [result.party],
    otherUsers: [result.user],
    ratings: [result._id],
  });
  console.log(`Created Rating ${result._id}`);
  return result;
};

const patch = async (id, data) => {
  const result = await service(options).patch(id, data);
  await Party.recalculateRating(result.party);
  await User.recalculateRating(result.partyOwner);
  return result;
};

const remove = async (id) => {
  await Activity.MODEL.deleteMany({
    ratings: id,
  });
  const result = await service(options).remove(id);
  await Party.recalculateRating(result.party);
  await User.recalculateRating(result.partyOwner);
  return result;
};

const removeManyByPartyId = async (partyId) => {
  const result = await options.Model.deleteMany({ party: partyId });
  return result;
};

const isPartyRatedByUser = async (partyId, userId) => {
  const result = await find({
    query: {
      party: partyId,
      user: userId,
    },
  });
  return result.data.length > 0;
};
exports.MODEL = options.Model;

const getAveragePartyRating = async (partyId) => {
  // TODO refator to one aggregation pipeline
  const [avgResult, countResult] = await Promise.all([
    options.Model.aggregate([
      {
        $match: { party: mongoose.Types.ObjectId(partyId) },
      },
      {
        $group: {
          _id: null,
          avgRating: {
            $avg: "$value",
          },
        },
      },
    ]),
    options.Model.aggregate([
      {
        $match: { party: mongoose.Types.ObjectId(partyId) },
      },
      {
        $count: "count",
      },
    ]),
  ]);
  if (avgResult.length === 0) return { avg: null, count: 0 };
  return { avg: avgResult[0].avgRating, count: countResult[0].count };
};
const getAverageUserRating = async (userId) => {
  // TODO refator to one aggregation pipeline
  const [avgResult, countResult] = await Promise.all([
    options.Model.aggregate([
      {
        $match: { partyOwner: mongoose.Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: null,
          avgRating: {
            $avg: "$value",
          },
        },
      },
    ]),
    options.Model.aggregate([
      {
        $match: { partyOwner: mongoose.Types.ObjectId(userId) },
      },
      {
        $count: "count",
      },
    ]),
  ]);
  if (avgResult.length === 0) return { avg: null, count: 0 };
  return { avg: avgResult[0].avgRating, count: countResult[0].count };
};

exports.handlePartyRatingPush = async () => {
  console.log("executing party rating push notifications check...");
  const before12h = new Date();
  before12h.setHours(before12h.getHours() - 12);
  const before96h = new Date();
  before96h.setHours(before96h.getHours() - 96);
  const parties = await Party.MODEL.find({
    $and: [
      { startDate: { $lte: before12h } },
      { startDate: { $gte: before96h } },
    ],
  });
  const partyIds = parties.map((p) => p._id);
  const partyGuests = await PartyGuests.MODEL.find({
    party: {
      $in: partyIds,
    },
    showedPartyRatingNotification: false,
    onSite: "yes",
  });
  for (const pg of partyGuests) {
    console.log(
      `sending rateParty to ${pg.user.toString()} for party ${pg.party.toString()}`
    );
    const party = parties.find((p) => p._id.toString() === pg.party.toString());
    //I18N
    const user = await User.get(pg.user);
    const msg = PUSH_PARTY_RATING(party, user.languageSetting || "de");
    console.log(msg);
    await sendNotificationToUser(pg.user.toString(), msg.title, msg.body, {
      command: "rateParty",
      contentId: pg.party.toString(),
    });
    await PartyGuests.patch(pg._id, { showedPartyRatingNotification: true });
  }
};

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
exports.removeManyByPartyId = removeManyByPartyId;
exports.isPartyRatedByUser = isPartyRatedByUser;
exports.getAveragePartyRating = getAveragePartyRating;
exports.getAverageUserRating = getAverageUserRating;
