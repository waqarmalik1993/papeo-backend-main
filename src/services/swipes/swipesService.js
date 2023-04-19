const service = require("feathers-mongoose");
const Model = require("../../models/swipes.model.js");
const papeoError = require("../../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const User = require("../users/usersService.js");
const Bookmark = require("../bookmarks/bookmarksService.js");
const options = {
  Model: Model(),
  paginate: {
    default: 10,
    max: 1000,
  },
  multi: ["patch"],
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

const create = async (data) => {
  const swipedPartyId = data.swipedParty;
  const swipedUserId = data.swipedUser;
  const userId = data.user;
  const swipe = data.swipe;

  // check if user has an swipes entry for this or user
  const isSwipedResult = await isSwiped(userId, swipedUserId, swipedPartyId);
  if (isSwipedResult) {
    throw papeoError(PAPEO_ERRORS.ENTITY_ALREADY_SWIPED);
  }

  const result = await service(options).create({
    user: userId,
    swipedUser: swipedUserId,
    swipedParty: swipedPartyId,
    swipe,
  });

  // add follower
  if (swipe && swipedUserId) {
    await User.addFollower(userId, swipedUserId);
  }

  // bookmark party
  if (swipe && swipedPartyId) {
    await Bookmark.create({
      user: userId,
      party: swipedPartyId,
    });
  }

  console.log(`Created Swipe ${result._id}`);

  return result;
};

const patch = async (id, data) => {
  const result = await service(options).patch(id, data);
  return result;
};

const remove = async (id) => {
  const result = await service(options).remove(id);
  return result;
};

const removeManyByPartyId = async (partyId) => {
  const result = await options.Model.deleteMany({ swipedParty: partyId });
  return result;
};

const isSwiped = async (userId, swipedUser, swipedParty) => {
  const query = {
    user: userId,
  };
  if (swipedUser) query.swipedUser = swipedUser;
  if (swipedParty) query.swipedParty = swipedParty;
  const result = await find({
    query,
  });
  console.log(result.data);
  return result.data.length > 0;
};

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
exports.removeManyByPartyId = removeManyByPartyId;
exports.isSwiped = isSwiped;
