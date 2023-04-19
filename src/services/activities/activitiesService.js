const service = require("feathers-mongoose");
const Model = require("../../models/activities.model.js");
const mongoose = require("mongoose");
const { translateActivity } = require("./helper/translation");
const {
  checkIfNotificationShouldBeSendAndSend,
} = require("./helper/processNotifications");
const User = require("../users/usersService");

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

let populationOptions = [
  {
    path: "posts",
    populate: {
      path: "uploads user",
      select: {
        mimetype: 1,
        username: 1,
        profilePicture: 1,
      },
    },
    select: {
      description: 1,
      type: 1,
    },
  },
  {
    path: "user",
    select: {
      username: 1,
      profilePicture: 1,
    },
  },
  {
    path: "otherUsers",
    select: {
      username: 1,
      profilePicture: 1,
    },
  },
  {
    path: "postComments",
    select: {
      post: 1,
      comment: 1,
      username: 1,
      profilePicture: 1,
    },
  },
  {
    path: "ratings",
    select: {
      value: 1,
      comment: 1,
      username: 1,
      profilePicture: 1,
      partyOwner: 1,
    },
  },
  {
    path: "parties",
    populate: {
      path: "uploads owner",
      select: {
        mimetype: 1,
        username: 1,
        profilePicture: 1,
      },
    },
    select: {
      name: 1,
      uploads: 1,
      startDate: 1,
      endDate: 1,
    },
  },
  {
    path: "userTickets",
  },
  {
    path: "competitions",
    populate: {
      path: "owner",
      select: {
        mimetype: 1,
        username: 1,
        profilePicture: 1,
      },
    },
    select: {
      name: 1,
    },
  },
  {
    path: "newsletter",
    select: {
      title: 1,
      upload: 1,
    },
  },
];

const get = async (id, params) => {
  const result = await service(options).get(id, params);
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

//parties

const find = async (params) => {
  params.query.$populate = populationOptions;
  const lang = params.lang;
  const result = await service(options).find(params);
  result.data = await Promise.all(
    result.data.map(async (element) => {
      return await translateActivity(element, lang || "de");
    })
  );
  return result;
};

const create = async (data, invitedUser) => {
  if (data.sendNotification === undefined) {
    console.log(
      "ERROR: check for sendNotification attribute on activityType",
      data.type
    );
  }
  let user = invitedUser;
  if (!invitedUser) {
    user = await User.getRaw(data.user._id ? data.user._id : data.user);
  }
  const result = await service(options).create(data);
  if (result.sendNotification) {
    let activity = await get(result._id, {
      query: {
        $populate: populationOptions,
      },
    });
    let translatedActivity = await translateActivity(
      activity,
      user.languageSetting
    );
    try {
      console.log(
        `NOTIFICATION: ${translatedActivity.type} to: ${translatedActivity.user.username} (${translatedActivity.user._id}): TITLE: ${translatedActivity.title}; BODY: ${translatedActivity.body}; NOTIFICATION_CATEGORIES: ${translatedActivity.notificationCategories}`
      );
    } catch (error) {
      console.log(error);
    }
    try {
      await checkIfNotificationShouldBeSendAndSend(translatedActivity, user);
    } catch (error) {
      console.log(error);
    }
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

exports.get = get;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
