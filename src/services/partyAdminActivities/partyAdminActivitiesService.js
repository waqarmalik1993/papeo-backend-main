const service = require("feathers-mongoose");
const Model = require("../../models/partyAdminActivities.model.js");
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
const logAdminPartyChanges = async (user, oldParty, newParty) => {
  const args = (attributeName) => {
    return {
      user,
      party: newParty,
      oldVersion: oldParty[attributeName],
      newVersion: newParty[attributeName],
    };
  };
  if (oldParty.name !== newParty.name) {
    await TYPES.partyNameChanged(args("name"));
  }
  if (oldParty.description !== newParty.description) {
    await TYPES.partyDescriptionChanged(args("description"));
  }
  if (JSON.stringify(oldParty.tags) !== JSON.stringify(newParty.tags)) {
    await TYPES.partyTagsChanged(args("tags"));
  }
  if (oldParty.type !== newParty.type) {
    await TYPES.partyTypeChanged(args("type"));
  }
  if (oldParty.privacyLevel !== newParty.privacyLevel) {
    await TYPES.partyPrivacyLevelChanged(args("privacyLevel"));
  }
  if (JSON.stringify(oldParty.location) !== JSON.stringify(newParty.location)) {
    await TYPES.partyLocationChanged({
      user,
      party: newParty,
      oldVersion: { location: oldParty.location, address: oldParty.address },
      newVersion: { location: newParty.location, address: newParty.address },
    });
  }
  if (oldParty.entranceFeeText !== newParty.entranceFeeText) {
    await TYPES.partyEntranceFeeTextChanged(args("entranceFeeText"));
  }
  if (oldParty.capacity !== newParty.capacity) {
    await TYPES.partyCapacityChanged(args("capacity"));
  }
  if (oldParty.startDate?.toISOString() !== newParty.startDate?.toISOString()) {
    await TYPES.partyStartDateChanged(args("startDate"));
  }
  if (oldParty.endDate?.toISOString() !== newParty.endDate?.toISOString()) {
    await TYPES.partyEndDateChanged(args("endDate"));
  }
  if (JSON.stringify(oldParty.uploads) !== JSON.stringify(newParty.uploads)) {
    await TYPES.partyUploadsChanged({
      user,
      party: newParty,
      oldVersion: oldParty.uploads,
      newVersion: newParty.uploads,
    });
  }
};
exports.logAdminPartyChanges = logAdminPartyChanges;

const partyChanged = async ({ type, user, party, oldVersion, newVersion }) => {
  await create({
    user: user._id,
    party: party._id,
    type: type,
    data: {
      old: oldVersion,
      new: newVersion,
    },
  });
};

const TYPES = {
  partyNameChanged: async ({ user, party, oldVersion, newVersion }) => {
    await partyChanged({
      type: "partyNameChanged",
      user,
      party,
      oldVersion,
      newVersion,
    });
  },
  partyDescriptionChanged: async ({ user, party, oldVersion, newVersion }) => {
    await partyChanged({
      type: "partyDescriptionChanged",
      user,
      party,
      oldVersion,
      newVersion,
    });
  },
  partyTagsChanged: async ({ user, party, oldVersion, newVersion }) => {
    await partyChanged({
      type: "partyTagsChanged",
      user,
      party,
      oldVersion,
      newVersion,
    });
  },
  partyTypeChanged: async ({ user, party, oldVersion, newVersion }) => {
    await partyChanged({
      type: "partyTypeChanged",
      user,
      party,
      oldVersion,
      newVersion,
    });
  },
  partyPrivacyLevelChanged: async ({ user, party, oldVersion, newVersion }) => {
    await partyChanged({
      type: "partyPrivacyLevelChanged",
      user,
      party,
      oldVersion,
      newVersion,
    });
  },
  partyLocationChanged: async ({ user, party, oldVersion, newVersion }) => {
    await partyChanged({
      type: "partyLocationChanged",
      user,
      party,
      oldVersion,
      newVersion,
    });
  },
  partyEntranceFeeTextChanged: async ({
    user,
    party,
    oldVersion,
    newVersion,
  }) => {
    await partyChanged({
      type: "partyEntranceFeeTextChanged",
      user,
      party,
      oldVersion,
      newVersion,
    });
  },
  partyCapacityChanged: async ({ user, party, oldVersion, newVersion }) => {
    await partyChanged({
      type: "partyCapacityChanged",
      user,
      party,
      oldVersion,
      newVersion,
    });
  },
  partyStartDateChanged: async ({ user, party, oldVersion, newVersion }) => {
    await partyChanged({
      type: "partyStartDateChanged",
      user,
      party,
      oldVersion,
      newVersion,
    });
  },
  partyEndDateChanged: async ({ user, party, oldVersion, newVersion }) => {
    await partyChanged({
      type: "partyEndDateChanged",
      user,
      party,
      oldVersion,
      newVersion,
    });
  },
  partyUploadsChanged: async ({ user, party, oldVersion, newVersion }) => {
    await partyChanged({
      type: "partyUploadsChanged",
      user,
      party,
      oldVersion,
      newVersion,
    });
  },

  acceptedGuest: async ({ user, party, guest }) => {
    await create({
      type: "acceptedGuest",
      user: user._id,
      party: party._id,
      data: {
        guest: {
          _id: guest._id.toString(),
          username: guest.username,
          sex: guest.sex,
          profilePicture: guest.profilePicture,
          verification: {
            verified: guest.verification.verified,
          },
          birthday: guest.birthday,
          rating: guest.rating,
          isPartyKing: guest.isPartyKing,
          isArtist: guest.isArtist,
        },
      },
    });
  },
  declinedGuest: async ({ user, party, guest }) => {
    await create({
      type: "declinedGuest",
      user: user._id,
      party: party._id,
      data: {
        guest: {
          _id: guest._id.toString(),
          username: guest.username,
          sex: guest.sex,
          profilePicture: guest.profilePicture,
          verification: {
            verified: guest.verification.verified,
          },
          birthday: guest.birthday,
          rating: guest.rating,
          isPartyKing: guest.isPartyKing,
          isArtist: guest.isArtist,
        },
      },
    });
  },
  broadcastedMessage: async ({
    user,
    party,
    peopleCount,
    colorGroups,
    message,
    points
  }) => {
    await create({
      type: "broadcastedMessage",
      user: user._id,
      party: party._id,
      data: {
        peopleCount,
        colorGroups,
        message,
        points,
      },
    });
  },
  hiddenPost: async ({ user, party, post }) => {
    await create({
      type: "hiddenPost",
      user: user._id,
      party: party._id,
      data: {
        post,
      },
    });
  },
  unhiddenPost: async ({ user, party, post }) => {
    await create({
      type: "unhiddenPost",
      user: user._id,
      party: party._id,
      data: {
        post,
      },
    });
  },
  deletedPost: async ({ user, party, post }) => {
    await create({
      type: "deletedPost",
      user: user._id,
      party: party._id,
      data: {
        post,
      },
    });
  },
};
exports.TYPES = TYPES;

/*
exports.translate = (transaction, lang = "de") => {
  return {
    ...transaction,
    translation: i18n[transaction.type](transaction)[lang],
  };
};
*/

exports.get = get;
exports.getByOneAttribute = getByOneAttribute;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
