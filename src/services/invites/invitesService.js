const service = require("feathers-mongoose");
const Model = require("../../models/invites.model.js");
const Party = require("../parties/partiesService.js");
const User = require("../users/usersService.js");
const Transaction = require("../transactions/transactionsService");
const Follower = require("../followers/followersService");
const Activity = require("../activities/activitiesService");
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../../modules/errors/errors.js").papeoError;
const searchModule = require("./modules/search/search");
const searchModuleV2 = require("./modules/search/searchv2");
const PartyGuest = require("../partyGuests/partyGuestsService");
const AWS_LAMBDA = require("aws-sdk/clients/lambda");
const LAMBDA = new AWS_LAMBDA();
const {
  getPartyPointsConfig,
} = require("../configuration/configurationsService");
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

const search = async (user, query) => {
  console.log("query:", query);
  let result = await searchModule.search(user, query || {});
  return result;
};
exports.search = search;
const searchV2 = async (user, query, paginate = true) => {
  console.log("query:", query);
  let result = await searchModuleV2.search(user, query || {}, paginate);
  return result;
};
exports.searchV2 = searchV2;

const createRaw = async (data) => {
  const result = await service(options).create(data);
  return result;
};
exports.createRaw = createRaw;

const create = async (
  data,
  attendingPartyGuestsIdArray = undefined,
  invitedPartyGuestsIdArray = undefined
) => {
  const partyId = data.party;
  const userId = data.user;
  const invitedUserId = data.invitedUser;
  if (invitedUserId === userId) {
    throw papeoError(PAPEO_ERRORS.YOU_CANNOT_INVITE_YOURSELF_TO_A_PARTY);
  }

  const invitedUser = await User.getRaw(invitedUserId);
  if (!invitedUser) {
    throw papeoError(PAPEO_ERRORS.USER_DOES_NOT_EXIST);
  }
  let isInvited = false;
  // if cached invitedPartyGuestsIdArray is present, we use it for performance reasons for bulk invites
  if (invitedPartyGuestsIdArray) {
    isInvited = !!invitedPartyGuestsIdArray.find(
      (id) => id.toString() === invitedUserId.toString()
    );
  } else {
    isInvited = await isUserInvited(partyId, invitedUserId);
  }

  let isAttending = false;
  // if cached attendingPartyGuestsIdArray is present, we use it for performance reasons for bulk invites
  if (attendingPartyGuestsIdArray) {
    isAttending = !!attendingPartyGuestsIdArray.find(
      (id) => id.toString() === invitedUserId.toString()
    );
  } else {
    isAttending = await PartyGuest.isUserAttendingPartyGuest(
      partyId,
      invitedUserId
    );
  }

  let result = {
    user: userId,
    invitedUser: invitedUserId,
    party: partyId,
  };
  if (!isInvited && !isAttending) {
    result = await service(options).create({
      user: userId,
      invitedUser: invitedUserId,
      party: partyId,
    });
  }

  await Activity.create(
    {
      notificationCategories: ["parties"],
      user: invitedUserId,
      otherUsers: [userId],
      type: "invitedParty",
      parties: [partyId],
      sendNotification: true,
    },
    invitedUser
  );
  console.log(`Created Invite ${result?._id}`);
  return result;
};
const getUserRelationShipCategories = async (
  invitingUser,
  invitedUser,
  invitingUsersFollowers = undefined,
  invitingUsersFollowedUsers = undefined
) => {
  const relationship = {
    following: false,
    followers: false,
    partyFriends: false,
    others: false,
  };
  if (
    invitingUser.partyFriends.find(
      (u) =>
        u.friend.toString() === invitedUser._id.toString() &&
        u.status === "accepted"
    )
  ) {
    relationship.partyFriends = true;
  }

  if (invitingUsersFollowers) {
    relationship.followers = !!invitingUsersFollowers.find(
      (id) => id.toString() === invitedUser._id.toString()
    );
  } else {
    relationship.following = !!(await User.isUserFollowedBy(
      invitingUser._id,
      invitedUser._id
    ));
  }
  if (invitingUsersFollowedUsers) {
    relationship.followers = !!invitingUsersFollowedUsers.find(
      (id) => id.toString() === invitedUser._id.toString()
    );
  } else {
    relationship.followers = !!(await User.isUserFollowedBy(
      invitedUser._id,
      invitingUser._id
    ));
  }
  if (
    !relationship.following &&
    !relationship.followers &&
    !relationship.partyFriends
  ) {
    relationship.others = true;
  }
  return relationship;
};
exports.getUserRelationShipCategories = getUserRelationShipCategories;
const userCanBeInvited = (relationShipBetweenUsers, invitedUser) => {
  const { following, followers, others } = invitedUser.settings.invitations;
  if (following && followers && others) {
    return true;
  }
  if (relationShipBetweenUsers.following && following) return true;
  if (relationShipBetweenUsers.followers && followers) return true;
  if (relationShipBetweenUsers.others && others) return true;
  // NEW: partyFriends can be invited despite settings
  if (relationShipBetweenUsers.partyFriends) return true;

  return false;
};
exports.userCanBeInvited = userCanBeInvited;

const calculateInvitationCost = async (
  invitingUser,
  invitedUser,
  cachedPartyPointsConfig = undefined,
  cachedInvitingUsersFollowers = undefined,
  cachedInvitingUsersFollowedUsers = undefined
) => {
  const relationship = await getUserRelationShipCategories(
    invitingUser,
    invitedUser,
    cachedInvitingUsersFollowers,
    cachedInvitingUsersFollowedUsers
  );
  let PARTY_POINTS_CONFIG = cachedPartyPointsConfig;
  if (!cachedPartyPointsConfig) {
    PARTY_POINTS_CONFIG = await getPartyPointsConfig();
  }
  let cost = PARTY_POINTS_CONFIG.invites.friends;
  if (!relationship.partyFriends) {
    if (invitingUser.isPartyKing) {
      cost = PARTY_POINTS_CONFIG.invites.partyKing;
    } else {
      cost = PARTY_POINTS_CONFIG.invites.noPartyKing;
    }
  }
  return cost;
};
exports.calculateInvitationCost = calculateInvitationCost;
const calculateInvitationCostWithRelationShip = ({
  isInvitingUserPartyKing,
  relationship,
  partyPointsConfig,
}) => {
  const PARTY_POINTS_CONFIG = partyPointsConfig;
  let cost = PARTY_POINTS_CONFIG.invites.friends;
  if (!relationship.partyFriends) {
    if (isInvitingUserPartyKing) {
      cost = PARTY_POINTS_CONFIG.invites.partyKing;
    } else {
      cost = PARTY_POINTS_CONFIG.invites.noPartyKing;
    }
  }
  return cost;
};
exports.calculateInvitationCostWithRelationShip =
  calculateInvitationCostWithRelationShip;
const checkInviteCosts = async (invitingUser, invitedUserIds) => {
  const cachedPartyPointsConfig = await getPartyPointsConfig();
  const cachedInvitingUsersFollowers = await Follower.MODEL.find({
    followedUser: invitingUser._id,
  })
    .select("user")
    .lean();
  const cachedInvitingUsersFollowedUsers = await Follower.MODEL.find({
    user: invitingUser._id,
  })
    .select("followedUser")
    .lean();
  let estimatedCosts = (
    await Promise.all(
      invitedUserIds.map((iuid) =>
        calculateInvitationCost(
          invitingUser,
          { _id: iuid },
          cachedPartyPointsConfig,
          cachedInvitingUsersFollowers,
          cachedInvitingUsersFollowedUsers
        )
      )
    )
  ).reduce((a, b) => a + b, 0);
  if (
    User.hasAdminRightsTo(invitingUser, User.adminRights.inviteGuestsToParties)
  ) {
    estimatedCosts = 0;
  }
  if (estimatedCosts > invitingUser.partyPoints) {
    throw papeoError(PAPEO_ERRORS.YOU_DONT_HAVE_ENOUGH_PP_TO_INVITE_USERS);
  }
  return { estimatedCosts };
};
exports.checkInviteCosts = checkInviteCosts;
const inviteUsers = async (invitingUserId, invitedUserIds, partyId) => {
  const invitingUser = await User.get(invitingUserId);
  const cachedPartyPointsConfig = await getPartyPointsConfig();
  // getting attending guests and invited guests beforehand for performance reasons
  const attendingPartyGuestsIdArray = (
    await PartyGuest.MODEL.find({
      party: partyId,
      status: "attending",
    })
      .select("user")
      .lean()
  ).map((pg) => pg.user);

  const invitedPartyGuestsIdArray = (
    await options.Model.find({
      party: partyId,
    })
      .select("invitedUser")
      .lean()
  ).map((invite) => invite.invitedUser);
  const res = await Promise.allSettled(
    invitedUserIds.map((invitedUserId) => {
      return create(
        {
          user: invitingUser._id.toString(),
          invitedUser: invitedUserId,
          party: partyId,
        },
        // optional, but performs much better for bulk invites, see create implementation
        attendingPartyGuestsIdArray,
        invitedPartyGuestsIdArray
      );
    })
  );
  const sucessfullyInvitedUsers = res.filter((i) => i.status === "fulfilled");

  const actualCost = (
    await Promise.all(
      sucessfullyInvitedUsers.map((result) =>
        calculateInvitationCost(
          invitingUser,
          { _id: result.value.invitedUser },
          cachedPartyPointsConfig
        )
      )
    )
  ).reduce((a, b) => a + b, 0);
  const peopleCount = sucessfullyInvitedUsers.length;
  if (
    !User.hasAdminRightsTo(invitingUser, User.adminRights.inviteGuestsToParties)
  ) {
    await Transaction.TYPES.invitedPeopleToParty({
      user: invitingUser,
      points: actualCost,
      peopleCount,
      party: await Party.get(partyId),
    });
  }
  return res.map((invite) => {
    if (invite.status === "fulfilled") {
      return invite.value;
    }
    if (invite.status === "rejected") {
      return { error: invite.reason };
    }
  });
};
exports.inviteUsers = inviteUsers;

const inviteUsersAsync = async (invitingUser, invitedUserIds, partyId) => {
  if (process.env.TEST === "TRUE") {
    return await inviteUsers(invitingUser, invitedUserIds, partyId);
  }
  return await LAMBDA.invoke({
    InvocationType: "Event",
    Payload: Buffer.from(
      JSON.stringify({
        action: "inviteUsers",
        invitingUserId: invitingUser._id.toString(),
        invitedUserIds,
        partyId,
      })
    ),
    FunctionName: process.env.ASYNC_WORKER_ARN,
  }).promise();
};
exports.inviteUsersAsync = inviteUsersAsync;
const patch = async (id, data) => {
  const result = await service(options).patch(id, data);
  return result;
};

const remove = async (id) => {
  const result = await service(options).remove(id);
  return result;
};

const removeManyByPartyId = async (partyId) => {
  const result = await options.Model.deleteMany({ party: partyId });
  return result;
};

const isUserInvitedByMe = async (partyId, userId, invitedUserId) => {
  const result = await find({
    query: {
      party: partyId,
      user: userId,
      invitedUser: invitedUserId,
    },
  });
  return result.data.length > 0;
};
const isUserInvited = async (partyId, invitedUserId) => {
  const result = await find({
    query: {
      party: partyId,
      invitedUser: invitedUserId,
    },
  });
  return result.data.length > 0;
};

exports.get = get;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
exports.removeManyByPartyId = removeManyByPartyId;
exports.isUserInvitedByMe = isUserInvitedByMe;
exports.isUserInvited = isUserInvited;
