const service = require("feathers-mongoose");
const Model = require("../../models/payouts.model");
const User = require("../users/usersService.js");
const AdminLog = require("../adminlogs/adminLogsService");
const Transaction = require("../transactions/transactionsService");
const { BadRequest } = require("@feathersjs/errors");
const {
  PUSH_PAYOUT_PAID,
  PUSH_PAYOUT_REJECTED,
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
  const payoutCount = await this.MODEL.countDocuments({
    user: data.user,
    status: { $ne: "rejected"}, 
  });
  const rejectedPayoutCount = await this.MODEL.countDocuments({
    user: data.user,
    status: "rejected", 
  });
  if(rejectedPayoutCount > 0) {
    throw new BadRequest("You have rejected payout requests");
  }
  if (payoutCount === 0 && data.amount !== 500) {
    throw new BadRequest("amount must be 500 party points");
  }
  if (payoutCount === 1 && data.amount !== 5000) {
    throw new BadRequest("amount must be 5000 party points");
  }
  if (payoutCount === 2 && data.amount !== 25000) {
    throw new BadRequest("amount must be 25000 party points");
  }
  if (payoutCount >= 3 && data.amount < 25000) {
    throw new BadRequest("amount must be at least 25000 party points");
  }
  const result = await service(options).create(data);

  await Transaction.TYPES.payoutRequested({
    user: { _id: data.user },
    points: data.amount,
  });
  console.log(`Created Payout ${result._id}`);
  return result;
};

const patch = async (id, data, params) => {
  const before = await get(id);
  if (data.status === "rejected" && before.status !== "rejected") {
    await AdminLog.TYPES.payoutRejected({
      userId: params.admin._id,
      affectedUser: await User.get(before.user),
      ppAmount: before.amount,
    });
    await Transaction.TYPES.payoutRejected({
      user: { _id: before.user },
      points: before.amount,
    });
    const user = await User.get(before.user);
    const msg = PUSH_PAYOUT_REJECTED(user.languageSetting || "de");
    await sendNotificationToUser(user._id, msg.title, msg.body, {
      command: "openTransactions",
      contentId: user._id.toString(),
    });
  }
  if (data.status === "enabled" && before.status !== "enabled") {
    await AdminLog.TYPES.payoutEnabled({
      userId: params.admin._id,
      affectedUser: await User.get(before.user),
      ppAmount: before.amount,
    });
  }
  if (data.status === "paid" && before.status !== "paid") {
    await AdminLog.TYPES.payoutPaid({
      userId: params.admin._id,
      affectedUser: await User.get(before.user),
      ppAmount: before.amount,
    });
    const user = await User.get(before.user);
    const msg = PUSH_PAYOUT_PAID(user.languageSetting || "de");
    await sendNotificationToUser(user._id, msg.title, msg.body, {
      command: "openTransactions",
      contentId: user._id.toString(),
    });
  }
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
