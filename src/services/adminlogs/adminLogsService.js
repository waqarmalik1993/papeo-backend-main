const service = require("feathers-mongoose");
const Model = require("../../models/adminLogs.model");
const mongoose = require("mongoose");
const User = require("../users/usersService");
const i18n = require("./helpers/internationalization").Activities;

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
  data.adminRightUsed = typesToRightsMap[data.type];
  data.affectedUserNameLowercase = data.affectedUser?.usernameLowercase || null;
  data.affectedUser = data.affectedUser?._id || null;
  try {
    data.usernameLowercase = (await User.get(data.user)).usernameLowercase;
  } catch (error) {
    data.usernameLowercase = "DELETED USER";
  }
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

const TYPES = {
  addedAdmin: async ({ userId, admin }) => {
    await create({
      type: "addedAdmin",
      affectedUser: admin,
      user: userId,
      data: {
        admin: admin,
      },
    });
  },
  removedAdmin: async ({ userId, admin }) => {
    await create({
      type: "removedAdmin",
      affectedUser: admin,
      user: userId,
      data: {
        admin: admin,
      },
    });
  },
  changedAdminRights: async ({ userId, admin, oldRights, newRights }) => {
    await create({
      type: "changedAdminRights",
      affectedUser: admin,
      user: userId,
      data: {
        admin: admin,
        old: oldRights,
        new: newRights,
      },
    });
  },
  removedImageMention: async ({ userId, upload, mentionedUser }) => {
    await create({
      type: "removedImageMention",
      affectedUser: mentionedUser,
      user: userId,
      data: {
        upload: upload,
        mentionedUser: mentionedUser,
      },
    });
  },
  votedForUser: async ({ userId, votedUser, vote }) => {
    await create({
      type: "votedForUser",
      user: userId,
      affectedUser: votedUser,
      data: {
        votedUser: votedUser,
        vote,
      },
    });
  },
  lockedUser: async ({ userId, lockedUser, reason, messageToUser }) => {
    await create({
      type: "lockedUser",
      user: userId,
      affectedUser: lockedUser,
      data: {
        lockedUser: lockedUser,
        reason,
        messageToUser,
      },
    });
  },
  unlockedUser: async ({ userId, unlockedUser }) => {
    await create({
      type: "unlockedUser",
      user: userId,
      affectedUser: unlockedUser,
      data: {
        unlockedUser: unlockedUser,
      },
    });
  },
  deletedRating: async ({ userId, rating, reason }) => {
    const ratingUser = await User.get(rating.user);
    rating.user = ratingUser;
    await create({
      type: "deletedRating",
      user: userId,
      data: {
        rating,
        reason,
      },
    });
  },
  deletedMedia: async ({ userId, upload, reason }) => {
    await create({
      type: "deletedMedia",
      user: userId,
      affectedUser: await User.get(upload.user),
      data: {
        upload,
        reason,
      },
    });
  },
  deletedPost: async ({ userId, post, reason }) => {
    const user = await User.get(post.user);
    await create({
      type: "deletedPost",
      user: userId,
      affectedUser: user,
      data: {
        post: { ...post, user },
        reason,
      },
    });
  },
  hiddenPost: async ({ userId, post, reason }) => {
    const user = await User.get(post.user);
    await create({
      type: "hiddenPost",
      user: userId,
      affectedUser: user,
      data: {
        post: { ...post, user },
        reason,
      },
    });
  },
  unhiddenPost: async ({ userId, post, reason }) => {
    const user = await User.get(post.user);
    await create({
      type: "unhiddenPost",
      user: userId,
      affectedUser: user,
      data: {
        post: { ...post, user },
        reason,
      },
    });
  },
  deletedParty: async ({ userId, party, reason, messageToUsers }) => {
    const user = await User.get(party.owner);
    await create({
      type: "deletedParty",
      user: userId,
      affectedUser: user,
      data: {
        party,
        reason,
        messageToUsers,
      },
    });
  },
  deletedPartyTag: async ({ userId, party, tag }) => {
    await create({
      type: "deletedPartyTag",
      user: userId,
      data: {
        party,
        tag,
      },
    });
  },
  patchedParty: async ({
    userId,
    party,
    type,
    privacyLevel,
    messageToOwner,
  }) => {
    await create({
      type: "patchedParty",
      user: userId,
      data: {
        party,
        type,
        privacyLevel,
        messageToOwner,
      },
    });
  },
  invitedUsers: async ({ userId, party, invitedUserIds = [] }) => {
    await create({
      type: "invitedUsers",
      user: userId,
      data: {
        party,
        // empty array for older app versions
        invitedUsers: [],
        invitedUserIds,
        invitedUsersCount: invitedUserIds.length,
      },
    });
  },
  changedTermsOfService: async ({ userId, oldTOS, newTOS }) => {
    await create({
      type: "changedTermsOfService",
      user: userId,
      data: {
        oldTOS,
        newTOS,
      },
    });
  },
  deletedComment: async ({ userId, comment, reason }) => {
    const user = await User.get(comment.user);
    await create({
      type: "deletedComment",
      user: userId,
      affectedUser: user,
      data: {
        comment: { ...comment, user },
        reason,
      },
    });
  },
  mutedUser: async ({
    userId,
    restrictedUser,
    restriction,
    durationInMinutes,
    messageToUser,
    reason,
  }) => {
    await create({
      type: "mutedUser",
      user: userId,
      affectedUser: restrictedUser,
      data: {
        restrictedUser: restrictedUser,
        restriction,
        durationInMinutes,
        messageToUser,
        reason,
      },
    });
  },
  unmutedUser: async ({ userId, restrictedUser, restriction }) => {
    await create({
      type: "unmutedUser",
      user: userId,
      affectedUser: restrictedUser,
      data: {
        restrictedUser: restrictedUser,
        restriction,
      },
    });
  },
  adminCredit: async ({ userId, creditedUser, amount, reason }) => {
    await create({
      type: "adminCredit",
      user: userId,
      affectedUser: creditedUser,
      data: {
        creditedUser: creditedUser,
        amount,
        reason,
      },
    });
  },
  adminDebit: async ({ userId, debitedUser, amount, reason }) => {
    await create({
      type: "adminDebit",
      user: userId,
      affectedUser: debitedUser,
      data: {
        debitedUser: debitedUser,
        amount,
        reason,
      },
    });
  },
  approvedReport: async ({ userId, report }) => {
    await create({
      type: "approvedReport",
      user: userId,
      data: {
        report,
      },
    });
  },
  declinedReport: async ({ userId, report }) => {
    await create({
      type: "declinedReport",
      user: userId,
      data: {
        report,
      },
    });
  },
  changedAdminRolePresets: async ({
    userId,
    oldAdminRolePresets,
    newAdminRolePresets,
  }) => {
    await create({
      type: "changedAdminRolePresets",
      user: userId,
      data: {
        oldAdminRolePresets,
        newAdminRolePresets,
      },
    });
  },
  deletedUser: async ({ userId, deletedUser, emailToUser, reason }) => {
    await create({
      type: "deletedUser",
      user: userId,
      affectedUser: deletedUser,
      data: {
        deletedUser: deletedUser,
        emailToUser,
        reason,
      },
    });
  },
  removedArtistDescription: async ({
    userId,
    affectedUser,
    oldArtistDescription,
    reason,
  }) => {
    await create({
      type: "removedArtistDescription",
      user: userId,
      affectedUser: affectedUser,
      data: {
        affectedUser: affectedUser,
        oldArtistDescription,
        reason,
      },
    });
  },
  changedArtistStatus: async ({ userId, affectedUser, isArtist, reason }) => {
    await create({
      type: "changedArtistStatus",
      user: userId,
      affectedUser: affectedUser,
      data: {
        affectedUser: affectedUser,
        isArtist,
        reason,
      },
    });
  },
  removedUserDescription: async ({
    userId,
    affectedUser,
    oldDescription,
    reason,
  }) => {
    await create({
      type: "removedUserDescription",
      user: userId,
      affectedUser: affectedUser,
      data: {
        affectedUser: affectedUser,
        oldDescription,
        reason,
      },
    });
  },
  deletedUserTag: async ({ userId, affectedUser, tag }) => {
    await create({
      type: "deletedUserTag",
      user: userId,
      affectedUser: affectedUser,
      data: {
        affectedUser,
        tag,
      },
    });
  },
  removedPartyFromCompetition: async ({
    userId,
    affectedUser,
    party,
    competition,
    reason,
    messageToOwner,
  }) => {
    await create({
      type: "removedPartyFromCompetition",
      user: userId,
      affectedUser: affectedUser,
      data: {
        affectedUser,
        party,
        competition,
        reason,
        messageToOwner,
      },
    });
  },
  createdSubscription: async ({ userId, affectedUser, duration, reason }) => {
    await create({
      type: "createdSubscription",
      user: userId,
      affectedUser: affectedUser,
      data: {
        affectedUser: affectedUser,
        duration,
        reason,
      },
    });
  },
  deletedSubscription: async ({ userId, affectedUser, reason }) => {
    await create({
      type: "deletedSubscription",
      user: userId,
      affectedUser: affectedUser,
      data: {
        affectedUser: affectedUser,
        reason,
      },
    });
  },
  userDeletedHimself: async ({ affectedUser }) => {
    await create({
      type: "userDeletedHimself",
      user: "000000000000000000000000",
      affectedUser: null,
      data: {
        affectedUser,
      },
    });
  },
  loginAsUser: async ({ userId, affectedUser, reason }) => {
    await create({
      type: "loginAsUser",
      user: userId,
      affectedUser: affectedUser,
      data: {
        affectedUser: affectedUser,
        reason,
      },
    });
  },
  payoutEnabled: async ({ userId, affectedUser, ppAmount }) => {
    await create({
      type: "payoutEnabled",
      user: userId,
      affectedUser: affectedUser,
      data: {
        affectedUser: affectedUser,
        ppAmount,
      },
    });
  },
  payoutRejected: async ({ userId, affectedUser, ppAmount }) => {
    await create({
      type: "payoutRejected",
      user: userId,
      affectedUser: affectedUser,
      data: {
        affectedUser: affectedUser,
        ppAmount,
      },
    });
  },
  payoutPaid: async ({ userId, affectedUser, ppAmount }) => {
    await create({
      type: "payoutPaid",
      user: userId,
      affectedUser: affectedUser,
      data: {
        affectedUser: affectedUser,
        ppAmount,
      },
    });
  },
  profileCreated: async ({ userId, affectedUser }) => {
    await create({
      type: "profileCreated",
      user: userId,
      affectedUser: affectedUser,
      data: {},
    });
  },
};
exports.TYPES = TYPES;

const typesToRightsMap = {
  addedAdmin: "manageAdmins",
  removedAdmin: "manageAdmins",
  changedAdminRights: "manageAdmins",
  removedImageMention: "manageUserLinks",
  votedForUser: "rateVideoIdent",
  lockedUser: "lockUser",
  unlockedUser: "lockUser",
  deletedRating: "deleteRating",
  deletedMedia: "manageMedia",
  deletedPost: "manageMedia",
  hiddenPost: "manageMedia",
  unhiddenPost: "manageMedia",
  deletedParty: "manageParties",
  deletedPartyTag: "manageParties",
  patchedParty: "manageParties",
  invitedUsers: "inviteGuestsToParties",
  changedTermsOfService: "changeTC",
  deletedComment: "manageComments",
  mutedUser: "muteUser",
  unmutedUser: "muteUser",
  adminCredit: "managePartyPoints",
  adminDebit: "managePartyPoints",
  approvedReport: "manageViolationReports",
  declinedReport: "manageViolationReports",
  changedAdminRolePresets: "manageAdmins",
  deletedUser: "deleteUserFinally",
  userDeletedHimself: "deleteUserFinally",
  removedArtistDescription: "manageUserProfiles",
  removedUserDescription: "manageUserProfiles",
  deletedUserTag: "manageUserProfiles",
  removedPartyFromCompetition: "manageCompetitions",
  createdSubscription: "manageMembership",
  deletedSubscription: "manageMembership",
  changedArtistStatus: "manageMembership",
  loginAsUser: "loginAsUser",
  editNewsletter: "editNewsletter",
  createNewsletter: "createNewsletter",
  payoutEnabled: "enablePayouts",
  payoutRejected: "enablePayouts",
  payoutPaid: "payoutPayouts",
  profileCreated: "profileCreated",
};
exports.typesToRightsMap = typesToRightsMap;

exports.translate = (transaction, lang = "de") => {
  return {
    ...transaction,
    translation: i18n[transaction.type](transaction)[lang],
  };
};

exports.get = get;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
