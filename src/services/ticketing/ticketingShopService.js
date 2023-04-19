const service = require("feathers-mongoose");
const Model = require("../../models/ticketingShops.model");
const options = {
  Model: Model(),
  paginate: {
    default: 10,
    max: 1000,
  },
  multi: [],
  whitelist: [],
};
exports.MODEL = options.Model;

const create = async (data) => {
  if (!data.user || (await getTicketingShopForUser(data.user))) {
    throw new Error("A user can have only one ticket shop");
  }
  const result = await service(options).create(data);
  return result;
};
const get = async (id) => {
  const result = await service(options).get(id);
  return result;
};
const find = async (params) => {
  const result = await service(options).find(params);
  return result;
};
const patch = async (id, data, params) => {
  let result = await service(options).patch(id, data, params);
  // calculate isActive attribute
  if (result.cardPaymentsEnabled && result.transfersEnabled && !result.isActive) {
    result = await service(options).patch(id, { isActive: true }, params);
  }
  if (
    result.isActive &&
    (!result.cardPaymentsEnabled || !result.transfersEnabled)
  ) {
    result = await service(options).patch(id, { isActive: false }, params);
  }
  return result;
};
exports.patch = patch;
const getTicketingShopForUser = async (userId) => {
  const ticketShop = await service(options).find({
    query: {
      user: userId,
    },
  });
  return ticketShop.data[0] || null;
};
exports.getTicketingShopForUser = getTicketingShopForUser;
const getTicketingShopByAccountId = async (stripeAccountId) => {
  return this.MODEL.findOne({ stripeAccountId });
};
exports.getTicketingShopByAccountId = getTicketingShopByAccountId;

exports.get = get;
exports.find = find;

exports.create = create;
