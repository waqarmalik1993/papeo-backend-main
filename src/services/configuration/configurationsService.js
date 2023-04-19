const service = require("feathers-mongoose");
const Model = require("../../models/configurations.model");
const mongoose = require("mongoose");
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

const find = async (params) => {
  const result = await service(options).find(params);
  return result;
};

const create = async (data) => {
  const result = await service(options).create(data);
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

const getPartyPointsConfig = async () => {
  const res = await this.MODEL.findOne({
    key: "partyPoints",
  }).lean();
  if (!res) {
    console.log("Error: no configuration for partyPoints found");
    return {
      invites: { friends: 0, partyKing: 6, noPartyKing: 8 },
      createAdditionalParties: { partyKing: 75, noPartyKing: 100 },
      broadcastMessage: 1,
      referral: { referredUser: 500, referrer: 500 },
    };
  }
  return res.value;
};
exports.getPartyPointsConfig = getPartyPointsConfig;

exports.get = get;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
