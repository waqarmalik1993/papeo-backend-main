const service = require("feathers-mongoose");
const Model = require("../../models/restrictions.model");
const papeoError = require("../../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const User = require("../users/usersService.js");
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
  const result = await service(options).create(data);
  console.log(`Created Restriction ${result._id}`);
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

const restrictUser = async ({
  userId,
  adminUserId,
  restriction,
  durationInMinutes,
  messageToUser,
  reason,
}) => {
  if (!restriction || durationInMinutes === undefined) {
    throw new Error();
  }
  let expiresAt = null;
  if (durationInMinutes !== -1) {
    expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationInMinutes);
  }
  const result = await create({
    user: userId,
    admin: adminUserId,
    expiresAt,
    restriction,
    durationInMinutes,
    messageToUser,
    reason,
  });
  const user = await User.get(userId);
  console.log(`restrictionAdded_${result.restriction}`);
  await Activity.create({
    type: `restrictionAdded_${result.restriction}`,
    notificationCategories: ["myProfileActivity"],
    user: result.user,
    otherUsers: [result.user],
    additionalInformation: {
      restrictionStartTime: result.createdAt.toLocaleString(
        user.languageSetting || "de"
      ),
      restrictionEndTime: result.expiresAt.toLocaleString(
        user.languageSetting || "de"
      ),
      messageToUser,
    },
    sendNotification: true,
  });

  return await User.patch(userId, {
    $set: {
      [`restrictions.${restriction}`]: true,
    },
  });
};
exports.restrictUser = restrictUser;

const removeRestrictionFromUser = async (userId, restriction) => {
  if (!restriction) {
    throw new Error();
  }

  // is there another active restriction?
  const activeRestrictions = await options.Model.find({
    user: userId,
    restriction: restriction.restriction,
    expired: false,
    $or: [
      {
        expiresAt: {
          $gt: new Date(),
        },
      },
      {
        expiresAt: null,
      },
    ],
  });
  const result = await patch(restriction._id, {
    expired: true,
  });
  /*console.log(
    activeRestrictions.filter(
      (r) => r._id.toString() !== restriction._id.toString()
    )
  );*/
  // only remove restriction when there is no other active restriction
  if (
    activeRestrictions.filter(
      (r) => r._id.toString() !== restriction._id.toString()
    ).length === 0
  ) {
    const user = await User.patch(userId, {
      $set: {
        [`restrictions.${restriction.restriction}`]: false,
      },
    });
    await Activity.create({
      type: `restrictionRemoved_${restriction.restriction}`,
      notificationCategories: ["myProfileActivity"],
      user: restriction.user,
      otherUsers: [restriction.user],
      additionalInformation: {
        restrictionStartTime: restriction.createdAt.toLocaleString(
          user.languageSetting || "de"
        ),
        restrictionEndTime: new Date().toLocaleString(
          user.languageSetting || "de"
        ),
      },
      sendNotification: true,
    });
  }
  return result;
};
exports.removeRestrictionFromUser = removeRestrictionFromUser;

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
