const service = require("feathers-mongoose");
const User = require("../users/usersService.js");
const Upload = require("../uploads/uploadsService.js");
const Model = require("../../models/posts.model.js");
const PostComments = require("../posts/comments/postCommentsService.js");
const Activity = require("../activities/activitiesService");
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

const get = async (id, params) => {
  const result = await service(options).get(id, params);
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
  const result = await service(options).create(data);
  console.log(`Created Post ${result._id}`);
  return result;
};

const patch = async (id, data) => {
  const result = await service(options).patch(id, data);
  return result;
};

const addUpload = async (postId, upload) => {
  return await patch(postId, {
    $addToSet: {
      uploads: upload,
    },
  });
};

const like = async (postId, userId) => {
  let post = await patch(postId, {
    $addToSet: {
      likedBy: userId,
    },
  });
  return post;
};
exports.like = like;
const unlike = async (postId, userId) => {
  return await patch(postId, {
    $pull: {
      likedBy: userId,
    },
  });
};
exports.unlike = unlike;

const removeUploadFile = async (postId, uploadId) => {
  console.log("removing uploaded file:", uploadId);
  return await patch(postId, {
    $pull: {
      uploads: uploadId,
    },
  });
};

const remove = async (id) => {
  // remove all uploads for a post
  const post = await service(options).get(id);
  await Promise.all(
    post.uploads.map(async (upload) => {
      return await Upload.remove(upload);
    })
  );
  // remove all comments
  
  await Activity.MODEL.deleteMany({
    posts: id
  });
  
  await PostComments.removeManyByPostId(id);
  const result = await service(options).remove(id);
  return result;
};

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.addUpload = addUpload;
exports.removeUploadFile = removeUploadFile;
exports.remove = remove;
