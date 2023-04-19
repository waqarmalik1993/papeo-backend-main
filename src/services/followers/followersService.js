const service = require("feathers-mongoose");
const Model = require("../../models/followers.model.js");
const mongoose = require("mongoose");

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

/**
 * 
 * @param {*} userId 
 * @returns the users that the user with "userId" follows
 */
const getFollowerIdsForAUser = async (userId) => {
  let result = await options.Model.find({
    user: userId,
  });
  return result ? result.map((r) => r.followedUser) : [];
};
exports.getFollowerIdsForAUser = getFollowerIdsForAUser;

const getFollowedUserIdsForAUser = async (userId) => {
  let result = await options.Model.find({
    followedUser: userId,
  });
  return result ? result.map((r) => r.user) : [];
};
exports.getFollowedUserIdsForAUser = getFollowedUserIdsForAUser;

const getFollowerCount = async (userId) => {
  let result = await options.Model.countDocuments({
    followedUser: userId,
  });
  return result;
};
exports.getFollowerCount = getFollowerCount;

const find = async (query) => {
  const result = await service(options).find(query);
  return result;
};

const create = async (data) => {
  // we assume that the owner of the post exists before creating the post
  const result = await service(options).create(data);
  console.log(`Created Follower ${result._id}`);
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

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
