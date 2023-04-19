const axios = require("axios");
const Transaction = require("../../transactions/transactionsService");
const User = require("../../users/usersService.js");
const Activity = require("../../activities/activitiesService");
const {
  createActivityTargetGroup,
} = require("../../activities/createActivityTargetGroup");
const {
  getFriendIdsFromUser,
  getFollowerIdsFromUser,
} = require("../../activities/helper/getTargetGroup");
const _ = require("lodash");
let revenuecatApiKey = process.env.REVENUECAT_API_KEY;
// eslint-disable-next-line no-undef
exports.processRevenuecat = async (webhook) => {
  let event = webhook.event;

  console.log(event);

  if (event.type === "TRANSFER") {
    await transferSubscriptionCheck(event);
  } else {
    let userId = event?.app_user_id;
    if (userId) {
      let user = await User.getRaw(userId);

      switch (event.product_id) {
      case "party.papeo.points.1000":
      case "prod_K4QO0vqshNY0NU":
      case "prod_K53GtjRHDkYw4O": // production
        await Transaction.TYPES.boughtPartyPoints({ user, points: 1000 });
        break;
      case "party.papeo.points.5250":
      case "prod_K4QO6mi5ItXlsu":
      case "prod_K53GTxsHVv4iXO": // production
        await Transaction.TYPES.boughtPartyPoints({ user, points: 5250 });
        break;
      case "party.papeo.points.11000":
      case "prod_K4QPIjhxLBzt6F":
      case "prod_K53HIC7FplgGIJ": // production
        await Transaction.TYPES.boughtPartyPoints({ user, points: 11000 });
        break;
      case "party.papeo.points.42000":
      case "prod_K4QQfx8mGyIkjE":
      case "prod_K53Hvrvek8GsiP": // production
        await Transaction.TYPES.boughtPartyPoints({ user, points: 42000 });
        break;
      default:
        await checkSubscriptionStatusUser(user);
      }
    }
  }
};

const transferSubscriptionCheck = async (event) => {
  let userArray = _.flatten([event.transferred_from, event.transferred_to]);
  let promiseArray = [];
  userArray.forEach((userId) => {
    promiseArray.push(
      User.getRaw(userId).then((user) => {
        checkSubscriptionStatusUser(user);
      })
    );
  });
  await Promise.all(promiseArray);
};

/*
  "event": {
    "event_timestamp_ms": 1629930059531,
    "store": "APP_STORE",
    "transferred_from": [
      "61269cde7996bf0008f90fd7"
    ],
    "transferred_to": [
      "6126be600a3d460009c293fc"
    ],
    "type": "TRANSFER",
    "id": "7ECB36F5-319A-4812-8EF0-5AF058EE3C81",
    "app_id": "app1661003c8d"
  },
  "api_version": "1.0"
}

 */

const checkSubscriptionStatusUser = async (user) => {
  let result = await revenuecatGetSubscriber(user._id);
  let subscriptions = result.subscriber.subscriptions;
  console.log({ subscriptions });
  let subscription;
  let data = {
    store: null,
    isPartyKing: false,
    expiresDate: null,
  };

  if (subscriptions["party.papeo.membership.king.yearly"]) {
    subscription = subscriptions["party.papeo.membership.king.yearly"];
    data = calculateSubscriptionStatus(data, subscription);
  }
  if (subscriptions["party.papeo.membership.king.monthly"]) {
    subscription = subscriptions["party.papeo.membership.king.monthly"];
    data = calculateSubscriptionStatus(data, subscription);
  }
  if (subscriptions["prod_K4HLr7w6cx99w5"]) {
    subscription = subscriptions["prod_K4HLr7w6cx99w5"];
    data = calculateSubscriptionStatus(data, subscription);
  }
  // production
  if (subscriptions["prod_K53GseuxosQ3GV"]) {
    subscription = subscriptions["prod_K53GseuxosQ3GV"];
    data = calculateSubscriptionStatus(data, subscription);
  }
  const key = Object.keys(subscriptions).find((k) =>
    k.startsWith("rc_promo_king_")
  );
  if (key) {
    subscription = subscriptions[key];
    data = calculateSubscriptionStatus(data, subscription);
  }
  await updateSubscriptionUser(data, user);
};

const calculateSubscriptionStatus = (data, subscription) => {
  let expiresDate =
    subscription.grace_period_expires_date || subscription.expires_date;

  if (
    (data.expiresDate === null ||
      new Date(expiresDate) > new Date(data.expiresDate)) &&
    new Date(expiresDate) > new Date()
  ) {
    data = {
      store: subscription.store,
      isPartyKing: true,
      expiresDate,
    };
  }
  return data;
};

const updateSubscriptionUser = async (data, user) => {
  let patchData = {
    subscription: data,
    isPartyKing: data.isPartyKing,
  };
  if (!data.isPartyKing) {
    patchData.isArtist = false;
  }
  await User.patch(user._id, patchData);

  if (data.isPartyKing !== user.isPartyKing) {
    if (data.isPartyKing) {
      await createActivityMembershipUpgrade(user);
    } else {
      await createActivityMembershipDowngrade(user);
    }
  }
};

const revenuecatGetSubscriber = async (userId) => {
  let options = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${revenuecatApiKey}`,
    },
    url: `https://api.revenuecat.com/v1/subscribers/${userId.toString()}`,
  };
  const response = await axios(options);
  return response?.data;
};
exports.revenuecatGetSubscriber = revenuecatGetSubscriber;

const revenuecatCreatePromotionalEntitlement = async (userId, duration) => {
  await revenuecatGetSubscriber(userId);
  let options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${revenuecatApiKey}`,
      "Content-Type": "application/json",
    },
    data: {
      duration,
    },
    url: `https://api.revenuecat.com/v1/subscribers/${userId.toString()}/entitlements/king/promotional`,
  };
  const response = await axios(options);
  return response?.data;
};
exports.revenuecatCreatePromotionalEntitlement =
  revenuecatCreatePromotionalEntitlement;

const revenuecatRevokePromotionalEntitlement = async (userId) => {
  let options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${revenuecatApiKey}`,
      "Content-Type": "application/json",
    },
    url: `https://api.revenuecat.com/v1/subscribers/${userId.toString()}/entitlements/king/revoke_promotionals`,
  };
  const response = await axios(options);
  return response?.data;
};
exports.revenuecatRevokePromotionalEntitlement =
  revenuecatRevokePromotionalEntitlement;

const createActivityMembershipUpgrade = async (user) => {
  await Activity.create({
    notificationCategories: ["membership"],
    user: user._id,
    type: "membershipUpgrade",
    otherUsers: [user._id],
    sendNotification: true,
  });

  await createActivityTargetGroup({
    type: "membershipUpgrade",
    otherUsers: [user._id],
    targetGroups: {
      friends: getFriendIdsFromUser(user),
      following: await getFollowerIdsFromUser(user._id),
    },
    sendNotification: true,
  });
};

const createActivityMembershipDowngrade = async (user) => {
  await Activity.create({
    notificationCategories: ["membership"],
    user: user._id,
    type: "membershipDowngrade",
    otherUsers: [user._id],
    sendNotification: true,
  });
};

exports.checkSubscriptionStatusUser = checkSubscriptionStatusUser;
