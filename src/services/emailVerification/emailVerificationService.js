const service = require("feathers-mongoose");
const usersService = require("../users/usersService.js");
const Model = require("../../models/emailVerification.model.js");
const sendEmailVerificationCode =
  require("../../modules/notifications/emails/sendUserNotifications.js").sendEmailVerificationCode;
const papeoError = require("../../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
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
  let result = await service(options).get(id);
  return result;
};

const getByOneAttribute = async (attributeName, value) => {
  let result = await service(options).find({
    query: {
      [attributeName]: value,
    },
  });
  return result.data.length ? result.data[0] : null;
};

const find = async (query) => {
  let result = await service(options).find(query);
  return result;
};

const create = async (data) => {
  let result = await service(options).create(data);
  console.log(`Created Email Verification ${result._id}`);
  return result;
};

const patch = async (id, data) => {
  let result = await service(options).patch(id, data);
  return result;
};

const remove = async (id) => {
  let result = await service(options).remove(id);
  await usersService.patch(result.owner, {
    $pull: {
      parties: result._id,
    },
  });
  return result;
};

const createAndSendVerificationCode = async (user, email) => {
  const existingCodes = await find({
    query: {
      user: user._id,
      email: email,
    },
  });
  // no leading zero 6-digit number
  const random = `${Math.floor(Math.random() * 899999 + 100000)}`;
  // if user has a verification code that is not expired yet, send it
  let verificationCode = existingCodes.data[0]?.code || random;
  if (!existingCodes.data[0]?.code) {
    await create({
      user: user._id,
      email,
      code: verificationCode,
    });
  }
  if (!process.env.TEST) {
    await sendEmailVerificationCode(user, email, verificationCode);
  }
  console.log(`Sent verification code to ${email}`);
  return {
    channel: "email",
  };
};

const validateVerificationCode = async (user, email, verificationCode) => {
  const codes = await find({
    query: {
      user: user._id,
      email: email,
      code: verificationCode,
    },
  });
  const verified = codes.data.length > 0;
  if (!verified) {
    throw papeoError(PAPEO_ERRORS.EMAIL_VERIFICATION_CODE_NOT_VALID);
  }
  return { verified, email };
};

exports.get = get;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.patch = patch;
exports.remove = remove;
exports.createAndSendVerificationCode = createAndSendVerificationCode;
exports.validateVerificationCode = validateVerificationCode;
