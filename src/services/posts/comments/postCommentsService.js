const service = require("feathers-mongoose");
const User = require("../../users/usersService.js");
const Upload = require("../../uploads/uploadsService.js");
const Post = require("../../posts/postsService");
const Party = require("../../parties/partiesService");
const Model = require("../../../models/postComments.model.js");
const { papeoError, PAPEO_ERRORS } = require("../../../modules/errors/errors.js");
const Activity = require("../../activities/activitiesService");
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

const find = async (query) => {
  const result = await service(options).find(query);
  return result;
};

const create = async (data) => {
  if(data.parentComment) {
    let parentComment = await get(data.parentComment);
    if(parentComment?.parentComment) {
      throw papeoError(PAPEO_ERRORS.NOT_FOUND);
    }
  }
  const result = await service(options).create(data);
  return result;
};

const patch = async (id, data) => {
  const result = await service(options).patch(id, data);
  return result;
};

const remove = async (id) => {
  await Activity.MODEL.deleteMany({
    postComments: id
  });
  await options.Model.deleteMany({
    parentComment: id
  });
  const result = await service(options).remove(id);
  return result;
};

const removeManyByPostId = async (postId) => {
  const result = await options.Model.deleteMany({ post: postId });
  return result;
};

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
exports.removeManyByPostId = removeManyByPostId;
