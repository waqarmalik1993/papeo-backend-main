const service = require("feathers-mongoose");
const Model = require("../../models/bookmarks.model.js");
const User = require("../users/usersService.js");
const papeoError = require("../../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;

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

const create = async (data) => {
  const partyId = data.party;
  const userId = data.user;

  // check if user has an partyGuest entry for this party
  const isPartyBookmarkedResult = await isPartyBookmarked(partyId, userId);
  if (isPartyBookmarkedResult) {
    throw papeoError(PAPEO_ERRORS.PARTY_ALREADY_BOOKMARKED);
  }
  const result = await service(options).create({
    party: partyId,
    user: userId,
  });
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
  const result = await options.Model.deleteMany({ party: partyId });
  return result;
};

const removeByUserIdAndPartyId = async (userId, partyId) => {
  const bookmarks = await find({
    query: {
      party: partyId,
      user: userId,
    },
  });
  if (bookmarks.data.length === 0) {
    throw papeoError(PAPEO_ERRORS.BOOKMARK_ALREADY_DELETED);
  }
  const result = await remove(bookmarks.data[0]._id);
  return result;
};

const isPartyBookmarked = async (partyId, userId) => {
  const result = await find({
    query: {
      party: partyId,
      user: userId,
    },
  });
  return result.data.length > 0;
};

const getBookmarkCountForAParty = async (partyId) => {
  const result = await options.Model.countDocuments({
    party: partyId,
  });
  return result;
};
exports.getBookmarkCountForAParty = getBookmarkCountForAParty;
const getBookmarkCountForFriendsForAParty = async (user, partyId) => {
  const friendIds = user.partyFriends
    .filter((pf) => pf.status === "accepted")
    .map((pf) => pf.friend);
  const result = await options.Model.countDocuments({
    party: partyId,
    user: {
      $in: friendIds,
    },
  });
  return result;
};
exports.getBookmarkCountForFriendsForAParty =
  getBookmarkCountForFriendsForAParty;

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
exports.removeManyByPartyId = removeManyByPartyId;
exports.removeByUserIdAndPartyId = removeByUserIdAndPartyId;
exports.isPartyBookmarked = isPartyBookmarked;
