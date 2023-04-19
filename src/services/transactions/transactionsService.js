const service = require("feathers-mongoose");
const Model = require("../../models/transactions.model");
const papeoError = require("../../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const User = require("../users/usersService.js");
const Bookmark = require("../bookmarks/bookmarksService.js");
const {
  sendNotificationToUser,
} = require("../../modules/notifications/push/sendNotification");
const {
  getPartyPointsConfig,
} = require("../configuration/configurationsService");
const {
  PUSH_BOUGHT_PP,
} = require("../../modules/notifications/push/internationalization");
const i18n = require("./internationalization").Transactions;
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
  console.log(`Created Transaction ${result._id}`);
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

const addPartyPoints = async (user, points, type, data = {}) => {
  let userId = user._id;
  console.log("addPartyPoints", userId, points);
  await User.patch(userId, {
    $inc: {
      partyPoints: points,
    },
  });
  return await create({
    type,
    user: userId,
    amount: points,
    direction: "credit",
    data,
  });
};
const removePartyPoints = async (user, points, type, data = {}) => {
  let userId = user._id;
  if (points > 0) points = -points;
  console.log("removePartyPoints", userId, points);

  await User.patch(userId, {
    $inc: {
      partyPoints: points,
    },
  });

  await create({
    type,
    user: userId,
    amount: points,
    direction: "debit",
    data,
  });
};

const TYPES = {
  boughtPartyPoints: async ({ user, points }) => {
    await addPartyPoints(user, points, "boughtPartyPoints");

    const msg = PUSH_BOUGHT_PP(points, user.languageSetting || "de");
    await sendNotificationToUser(user._id.toString(), msg.title, msg.body, {
      command: "openPartyPoints",
      contentId: user._id.toString(),
    });
  },
  invitedPeopleToParty: async ({ user, points, peopleCount, party }) => {
    await removePartyPoints(user, points, "invitedPeopleToParty", {
      peopleCount,
      partyId: party._id.toString(),
      partyName: party.name,
    });
  },
  createdAdditionalParty: async ({ user, points, party }) => {
    await removePartyPoints(user, points, "createdAdditionalParty", {
      partyId: party._id.toString(),
      partyName: party.name,
    });
  },
  broadCastedMessage: async ({ user, points, peopleCount, party }) => {
    await removePartyPoints(user, points, "broadCastedMessage", {
      peopleCount,
      partyId: party._id.toString(),
      partyName: party.name,
    });
  },
  adminDebit: async ({ user, points, reason }) => {
    await removePartyPoints(user, points, "adminDebit", {
      reason,
    });
  },
  adminCredit: async ({ user, points, reason }) => {
    return await addPartyPoints(user, points, "adminCredit", {
      reason,
    });
  },
  referredUserCreditMLM: async ({ user, referredUser, points, level }) => {
    return await addPartyPoints(user, points, "referredUserCreditMLM", {
      referredUserId: referredUser._id,
      referredUserName: referredUser.username,
      level,
    });
  },
  referredUserDebitMLM: async ({ user, referredUser, points, level }) => {
    return await removePartyPoints(user, points, "referredUserDebitMLM", {
      referredUserId: referredUser._id,
      referredUserName: referredUser.username,
      level,
    });
  },
  referredByAUserCredit: async ({ user }) => {
    const points = (await getPartyPointsConfig()).referral.referredUser;
    return await addPartyPoints(user, points, "referredByAUserCredit", {});
  },
  payoutRequested: async ({ user, points }) => {
    return await removePartyPoints(user, points, "payoutRequested", {});
  },
  payoutRejected: async ({ user, points }) => {
    return await addPartyPoints(user, points, "payoutRejected", {});
  },
  menuCardPayment: async ({ user, points, menuCardOrderId }) => {
    return await removePartyPoints(user, points, "menuCardPayment", {
      menuCardOrderId,
    });
  },
  menuCardPaymentCredit: async ({ user, points, menuCardOrderId }) => {
    return await addPartyPoints(user, points, "menuCardPaymentCredit", {
      menuCardOrderId,
    });
  },
};
exports.TYPES = TYPES;

exports.translate = (transaction, lang = "de") => {
  return {
    ...transaction,
    translation: i18n[transaction.type](transaction)[lang],
  };
};

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;

// MLM Transactions data.referredUserName check and fix
/*
(() => {
  setTimeout(async () => {
    console.log("userlist");
    const allMLMTransactions = [
      ...(await options.Model.find({
        type: "referredUserCreditMLM",
      }).lean()),
      ...(await options.Model.find({
        type: "referredUserDebitMLM",
      }).lean()),
    ];
    for (const trx of allMLMTransactions) {
      try {
        const user = await User.get(trx.data.referredUserId);
        console.log(user.username, trx.data.referredUserName);
        if (user.username !== trx.data.referredUserName) {
          await options.Model.updateOne(
            { _id: trx._id },
            { $set: { "data.referredUserName": user.username } }
          );
        }
      } catch (error) {
        console.log(
          trx._id,
          trx.data.referredUserId,
          "user with id: data.referredUserId not found"
        );
      }
    }
  }, 1500);
})();
*/
