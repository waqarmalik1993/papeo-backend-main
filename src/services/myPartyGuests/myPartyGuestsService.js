const service = require("feathers-mongoose");
const Model = require("../../models/myPartyGuests.model");
const Party = require("../parties/partiesService.js");
const User = require("../users/usersService");
const Bookmark = require("../bookmarks/bookmarksService");
const Activity = require("../activities/activitiesService");
const Invite = require("../invites/invitesService");
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../../modules/errors/errors.js").papeoError;

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

const create = async (data, query) => {
  if (!query) query = {};
  if (!query.query) query.query = {};
  const myPartyGuests = await find({
    query: {
      user: data.user,
      guest: data.guest,
      ...query.query,
    },
  });

  let result = null;
  if (myPartyGuests.data[0]) {
    result = myPartyGuests.data[0];
    if (myPartyGuests.data[0].isDeleted) {
      await service(options).patch(myPartyGuests.data[0]._id, {
        isDeleted: false,
      });
      result = { ...result, isDeleted: false };
    }
  } else {
    result = await service(options).create(
      {
        user: data.user,
        guest: data.guest,
      },
      { query: query.query }
    );
  }
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

const getMyPartyGuestIsDeletedFalseIds = async (userId) => {
  const result = (
    await this.MODEL.find({ user: userId, isDeleted: false }).select({ guest: 1 }).lean()
  ).map((u) => u.guest);
  return result;
};
exports.getMyPartyGuestIsDeletedFalseIds = getMyPartyGuestIsDeletedFalseIds;

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
