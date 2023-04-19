const service = require("feathers-mongoose");
const User = require("../users/usersService.js");
const Transaction = require("../transactions/transactionsService");
const Model = require("../../models/referraltree.model");
const {
  PUSH_MLM_REFERRED_USER,
} = require("../../modules/notifications/push/internationalization");
const {
  sendNotificationToUser,
} = require("../../modules/notifications/push/sendNotification");
const {
  getPartyPointsConfig,
} = require("../configuration/configurationsService");

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
const create = async (data) => {
  const parent = await this.MODEL.updateOne(
    { _id: data.parent },
    { $set: { userData: data.parentData } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  delete data.parentData;
  const result = await this.MODEL.updateOne(
    { _id: data._id },
    { $set: { ...data } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  const treeEntry = await get(data._id);
  const referralChain = await getReferralChain(data._id);
  await incrementMemberCountByReferralChain(
    referralChain,
    treeEntry.memberCount + 1
  );
  return result;
};
const createReferralTreeEntry = async (referredUser, parent) => {
  const result = await create({
    _id: referredUser._id,
    parent: parent._id,
    userData: {
      _id: referredUser._id,
      username: referredUser.username,
      profilePicture: referredUser.profilePicture,
      isDeleted: false,
      referringTransactionsPushEnabled:
        referredUser.settings?.notifications?.referringTransactions || false,
      isPartyKing: referredUser.isPartyKing,
      languageSetting: referredUser.languageSetting,
    },
    parentData: {
      _id: parent._id,
      username: parent.username,
      profilePicture: parent.profilePicture,
      isDeleted: false,
      referringTransactionsPushEnabled:
        parent.settings?.notifications?.referringTransactions || false,
      isPartyKing: parent.isPartyKing,
      languageSetting: parent.languageSetting,
    },
  });
  return result;
};
exports.createReferralTreeEntry = createReferralTreeEntry;
const incrementMemberCountByReferralChain = async (
  referralChain,
  amount = 1
) => {
  return await Promise.all(
    referralChain.map(async (entry) => {
      console.log(
        `incrementing referraltree.memberCount for: ${entry._id} (${entry.userData.username})`
      );
      // TODO updateMany mit id array
      await this.MODEL.updateOne(
        { _id: entry._id },
        { $inc: { memberCount: amount } }
      );
    })
  );
};
exports.incrementMemberCountByReferralChain =
  incrementMemberCountByReferralChain;
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

/**
 * 
 * @param {*} referredUserId 
 * @returns [
  {
    level: 1,
    user: {
      _id: 63458f84f2d1426d33d4aa9f,
      username: 'otherUser3_1_2',
      isPartyKing: false,
      isDeleted: false
    }
  },
  {
    level: 2,
    user: { _id: 63458f84f2d1426d33d4aa87, isDeleted: false }
  },
  {
    level: 3,
    user: {
      _id: 63458f84f2d1426d33d4aa7b,
      username: 'otherUser3',
      isPartyKing: true,
      isDeleted: false
    },
    endOfChain: true
  }
]
 */
const getReferralChain = async (referredUserId) => {
  const referralChain = [];
  let level = 1;
  let currentReferredUser = referredUserId;
  console.log({ currentReferredUser });
  const referralTreeEntry = await this.MODEL.findOne({
    _id: currentReferredUser,
  }).lean();
  if (!referralTreeEntry || referralTreeEntry.parent === null) return [];
  currentReferredUser = referralTreeEntry.parent;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nextReferralTreeEntry = await this.MODEL.findOne({
      _id: currentReferredUser,
    }).lean();
    if (nextReferralTreeEntry === null) break;
    referralChain.push({ ...nextReferralTreeEntry, level });
    if (nextReferralTreeEntry.parent === null) break;
    currentReferredUser = nextReferralTreeEntry.parent;
    level++;
  }
  return referralChain;
};

exports.getReferralChain = getReferralChain;

const isReferralAllowed = async ({ referringUser, referredUser }) => {
  if (referredUser.isSuperAdmin) return false;
  if (referringUser._id.toString() === referredUser._id.toString()) {
    return false;
  }
  if (!referringUser._id || !referredUser._id) return false;
  const referralChain = await getReferralChain(referringUser._id);
  // check if the user to refer is in the tree above the user which is referring
  return !referralChain.find(
    (x) => x._id.toString() === referredUser._id.toString()
  );
};

exports.isReferralAllowed = isReferralAllowed;

const createReferralChainTransactions = async (referralChain, referredUser) => {
  const PERCENTAGE = 0.3;
  const points = (await getPartyPointsConfig()).referral.referrer;
  await Promise.all(
    referralChain.map(async (entry) => {
      if (entry.userData.isDeleted) return;
      const pointsToCredit = (
        points * Math.pow(PERCENTAGE, entry.level - 1)
      ).toFixed(8); // 500*(0,3^(A3-1))
      await Transaction.TYPES.referredUserCreditMLM({
        user: { _id: entry._id },
        referredUser,
        level: entry.level,
        points: pointsToCredit,
      });
      if (entry.userData.referringTransactionsPushEnabledtrue) {
        const msg = PUSH_MLM_REFERRED_USER(
          entry.level,
          entry.userData.languageSetting || "de"
        );
        console.log(
          "SENDING PUSH_MLM_REFERRED_USER:",
          entry._id.toString(),
          entry.userData.username,
          msg.title,
          msg.body
        );
        await sendNotificationToUser(
          entry._id.toString(),
          msg.title,
          msg.body,
          {
            command: "openTransactions",
            contentId: entry._id.toString(),
          }
        );
      }
      // only if it is not the end of the chain
      if (entry.parent !== null) {
        // TODO
        const pointsToDebit = (
          points *
          Math.pow(PERCENTAGE, entry.level) *
          (entry.userData.isPartyKing ? 1 : 0.9) // TODO
        ) // burn 10% when user is not a partyKing
          .toFixed(8);
        await Transaction.TYPES.referredUserDebitMLM({
          user: { _id: entry._id },
          referredUser,
          level: entry.level,
          points: pointsToDebit,
        });
      }
    })
  );
  /*await Transaction.TYPES.referredUserCredit({
    user: referredUser,
  });*/
};

exports.createReferralChainTransactions = createReferralChainTransactions;
const find = async (query) => {
  const result = await service(options).find(query);
  return result;
};

const patch = async (id, data) => {
  const before = await get(id);
  const oldReferralChain = await getReferralChain(id);

  console.log("patchdata:");
  console.log(data);
  const result = await service(options).patch(id, data);

  // decrement the old
  if (before.parent.toString() !== result.parent.toString()) {
    const parent = await User.get(data.parent);
    const referredUser = await User.get(id);
    await createReferralTreeEntry(referredUser, parent);
    await incrementMemberCountByReferralChain(
      oldReferralChain,
      -before.memberCount - 1 // -1 because the user itself is removed from the parents tree
    );
  }
  return result;
};

const remove = async (id) => {
  const result = await service(options).remove(id);
  return result;
};

const calculateLevelCounts = async (referralTree) => {
  const referralTreeWithStringIds = referralTree.map((entry) => ({
    ...entry,
    parent: entry.parent ? entry.parent.toString() : null,
    _id: entry._id ? entry._id.toString() : null,
  }));
  /*
    map to store the levelCount for a specific userId
    value gets only changed when value is undefined or less than the new value
  */
  const result = {};

  function calculateLevelForAllParents(child) {
    let currentChild = child;
    let level = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (
        result[currentChild._id] === undefined ||
        result[currentChild._id] < level
      ) {
        result[currentChild._id] = level;
      }
      const parent = referralTreeWithStringIds.filter(
        (r) => r._id === currentChild.parent
      );
      if (parent.length === 0) break;
      currentChild = parent[0];
      level += 1;
    }
  }

  function calculateChildrenLevel(parent, level = 1) {
    const children = referralTreeWithStringIds.filter(
      (r) => r.parent === parent._id
    );
    if (children.length === 0) {
      calculateLevelForAllParents(parent);
    }
    children.map((c) => calculateChildrenLevel(c, level + 1));
  }

  calculateChildrenLevel({ _id: null });
  return result;
};
exports.calculateLevelCounts = calculateLevelCounts;

const updateLevelCounts = async (oldReferralTree, levelCountMap) => {
  const changedReferraltreeEntries = oldReferralTree.filter(
    (rf) => rf.levelCount !== levelCountMap[rf._id.toString()]
  );
  await Promise.all(
    changedReferraltreeEntries.map((rf) => {
      return this.MODEL.updateOne(
        { _id: rf._id },
        { $set: { levelCount: levelCountMap[rf._id.toString()] } }
      );
    })
  );
};
exports.updateLevelCounts = updateLevelCounts;

const recalculateLevelCountsAndUpdate = async () => {
  const oldReferralTree = await this.MODEL.find(
    {},
    {
      parent: 1,
      levelCount: 1,
      memberCount: 1,
      _id: 1,
    }
  ).lean();
  const levelCounts = await calculateLevelCounts(oldReferralTree);
  await updateLevelCounts(oldReferralTree, levelCounts);
};
exports.recalculateLevelCountsAndUpdate = recalculateLevelCountsAndUpdate;

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
//exports.create = create;
exports.patch = patch;
exports.remove = remove;
/* (async () => {
  setTimeout(async () => {
    console.log(await getReferralChain("6130f830b8723c0603903ad2"));
  }, 3000);
})();
*/
/*
(() => {
  setTimeout(async () => {
    const oldReferralTree = await this.MODEL.find(
      {},
      {
        parent: 1,
        levelCount: 1,
        memberCount: 1,
        _id: 1,
      }
    ).lean();
    const levelCounts = await calculateLevelCounts(oldReferralTree);
    await updateLevelCounts(oldReferralTree, levelCounts);
  }, 2000);
})();
*/
