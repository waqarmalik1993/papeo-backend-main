const service = require("feathers-mongoose");
const Model = require("../../models/imageMentions.model.js");
const User = require("../users/usersService");
const Post = require("../posts/postsService");

const { papeoError, PAPEO_ERRORS } = require("../../modules/errors/errors");
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

const findRaw = async (query) => {
  const result = await options.Model.find(query).exec();
  return result;
};
exports.findRaw = findRaw;

const create = async (data) => {
  return service(options).create(data);
};

const patch = async (id, data) => {
  return service(options).patch(id, data);
};

const remove = async (id) => {
  return service(options).remove(id);
};

const mentionUser = async (
  userId,
  mentionedUserId,
  uploadId,
  location,
  postId
) => {
  const mentionedUser = await User.getRaw(mentionedUserId);
  if (!mentionedUser) {
    throw papeoError(PAPEO_ERRORS.USER_DOES_NOT_EXIST);
  }
  if (userId.toString() !== mentionedUserId.toString()) {
    const friend = mentionedUser.partyFriends.find(
      (f) =>
        f.friend.toString() === userId.toString() && f.status === "accepted"
    );
    if (!friend) {
      throw papeoError(PAPEO_ERRORS.USER_IS_NOT_IN_YOUR_FRIEND_LIST);
    }
  }
  const existingMentions = await find({
    query: {
      user: userId,
      mentionedUser: mentionedUserId,
      upload: uploadId,
    },
  });
  if (existingMentions.data.length > 0) {
    throw papeoError(PAPEO_ERRORS.YOU_ALREADY_MENTIONED_THIS_USER);
  }
  const post = await Post.get(postId, {
    query: { $populate: { path: "party" } },
  });
  const isPostInSecretParty = post.party.privacyLevel === "secret";
  return await create({
    user: userId,
    mentionedUser: mentionedUserId,
    upload: uploadId,
    location,
    post: postId,
    isPostInSecretParty,
  });
};
exports.mentionUser = mentionUser;

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
