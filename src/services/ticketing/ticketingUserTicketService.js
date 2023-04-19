const { NotFound } = require("@feathersjs/errors");
const service = require("feathers-mongoose");
const { Types } = require("mongoose");
const Model = require("../../models/ticketingUserTickets.model");
const stripeTicketing = require("../integrations/stripe/ticketingStripe");
const TicketingShop = require("../ticketing/ticketingShopService");
const Activity = require("../activities/activitiesService");
const crypto = require("crypto");
const User = require("../users/usersService");
const {
  PUSH_PARTY_REMINDER,
} = require("../../modules/notifications/push/internationalization");
const {
  sendNotificationToUser,
} = require("../../modules/notifications/push/sendNotification");

const options = {
  Model: Model(),
  paginate: {
    default: 10,
    max: 1000,
  },
  multi: [],
  whitelist: ["$populate"],
};
exports.MODEL = options.Model;

const create = async (data) => {
  const user = await User.get(data.user);
  data.usernameLowercase = user.username.toLowerCase();
  data.qrCodeValue = `T#${crypto.randomUUID()}`;
  const result = await service(options).create(data);
  return result;
};
const get = async (id, params) => {
  const result = await service(options).get(id, params);
  return result;
};
const find = async (params) => {
  const result = await service(options).find(params);
  return result;
};
const patch = async (id, data, params) => {
  const before = await get(id);
  if (data.user) {
    if (data.user.toString() !== before.user.toString()) {
      data.sharedWith = null;
      const newUser = await User.get(data.user);
      data.usernameLowercase = newUser.usernameLowercase;
      await Activity.create({
        user: before.user,
        otherUsers: [data.user],
        type: "userTicketSharedAccepted",
        additionalInformation: {},
        notificationCategories: ["other"],
        parties: [before.party],
        userTickets: [before._id],
        sendNotification: true,
      });
    }
  }
  let result = await service(options).patch(id, data, params);
  if (data.sharedWith) {
    const user = await User.get(result.sharedWith);
    await Activity.create({
      user: result.sharedWith,
      otherUsers: [result.user],
      type: "userTicketShared",
      additionalInformation: { userTicketId: id },
      notificationCategories: ["other"],
      parties: [result.party],
      userTickets: [before._id],
      sendNotification: true,
    });
  }
  if (
    data.sharedWith === null &&
    params.user._id.toString() !== result.user.toString()
  ) {
    // TODO remove userTicketShared Activity
    await Activity.create({
      user: result.user,
      otherUsers: [params.user._id],
      type: "userTicketSharedRejected",
      additionalInformation: {},
      notificationCategories: ["other"],
      parties: [result.party],
      userTickets: [before._id],
      sendNotification: true,
    });
  }
  return result;
};
exports.patch = patch;

exports.get = get;
exports.find = find;

exports.create = create;
