const service = require("feathers-mongoose");
const Model = require("../../models/newsletter.model");
const User = require("../users/usersService.js");
const Upload = require("../uploads/uploadsService");
const Activity = require("../activities/activitiesService");
const { BadRequest } = require("@feathersjs/errors");
const AWS_LAMBDA = require("aws-sdk/clients/lambda");
const LAMBDA = new AWS_LAMBDA();
const {
  createActivityTargetGroup,
} = require("../activities/createActivityTargetGroup");
const {
  getAllNewUsers,
  getAllNotNewUsers,
  getAllUsers,
} = require("../activities/helper/getTargetGroup");
const e = require("express");
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
  if (data.upload) {
    await Upload.MODEL.updateOne(
      { _id: data.upload },
      { newsletter: result._id }
    );
  }
  console.log(`Created Newsletter ${result._id}`);
  return result;
};

const patch = async (id, data) => {
  const before = await get(id);
  const result = await service(options).patch(id, data);
  if (data.upload) {
    await Upload.MODEL.updateOne(
      { _id: data.upload },
      { newsletter: result._id }
    );
  }

  return result;
};
const sendNotificationsAsync = async (newsletterId) => {
  const newsletter = await get(newsletterId);
  if (newsletter.isDraft) {
    throw new BadRequest("newsletter must be published to send notifications");
  }
  if (!newsletter.title) {
    throw new BadRequest("newsletter must have a title to be published");
  }
  if (!newsletter.content) {
    throw new BadRequest("newsletter must have content to be published");
  }
  if (process.env.TEST === "TRUE") return {};
  return await LAMBDA.invoke({
    InvocationType: "Event",
    Payload: Buffer.from(
      JSON.stringify({
        action: "publishNewsletter",
        newsletterId: newsletterId.toString(),
      })
    ),
    FunctionName: process.env.ASYNC_WORKER_ARN,
  }).promise();
  /*if (data.status === "published") {
    await createActivityTargetGroup({
      type: "newsletter",
      notificationCategories: ["other"],
      newsletter: [result._id],
      targetGroups: {
        other: await getAllUsers(),
      },
      sendNotification: true,
    });
  }*/
};
exports.sendNotificationsAsync = sendNotificationsAsync;

const sendNotifications = async (newsletterId) => {
  const newsletter = await get(newsletterId);
  if (newsletter.isDraft) {
    throw new BadRequest("newsletter must be published to send notifications");
  }
  let audience = [];
  if (newsletter.audience === "all_users") {
    audience = await getAllUsers();
    // + new_users: new users get a notification when they create an account, logic in user.create
  }
  /* new users get a notification when they create an account, logic in user.create
  if (newsletter.audience === "new_users") {
    audience = await getAllNewUsers();
  }
  */
  if (newsletter.audience === "existing_users") {
    audience = await getAllUsers();
  }
  console.log(`SENDING NEWSLETTER TO ${audience.length} USERS`);
  await createActivityTargetGroup({
    type: "newsletter",
    notificationCategories: ["other"],
    newsletter: [newsletter._id],
    targetGroups: {
      other: audience,
    },
    sendNotification: true,
  });
};
exports.sendNotifications = sendNotifications;

const createNewsletterForNewUser = async (userId) => {
  const newsletters = await options.Model.find({
    $or: [
      { audience: "new_users", isDraft: false },
      { audience: "all_users", isDraft: false },
    ],
  });
  await Promise.all(
    newsletters.map(async (nl) => {
      return await Activity.create({
        user: userId,
        type: "newsletter",
        notificationCategories: ["other"],
        newsletter: [nl._id],
        sendNotification: true,
      });
    })
  );
};
exports.createNewsletterForNewUser = createNewsletterForNewUser;

const remove = async (id) => {
  const result = await service(options).remove(id);
  // TODO remove upload
  await Activity.MODEL.deleteMany({ newsletter: id });
  return result;
};

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
