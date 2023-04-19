const service = require("feathers-mongoose");
const User = require("../users/usersService.js");
const Upload = require("../uploads/uploadsService.js");
const Post = require("../posts/postsService.js");
const Rating = require("../ratings/ratingsService.js");
const PartyGuest = require("../partyGuests/partyGuestsService.js");
const Invite = require("../invites/invitesService");
const Transaction = require("../transactions/transactionsService");
const Bookmark = require("../bookmarks/bookmarksService.js");
const Swipe = require("../swipes/swipesService.js");
const Competition = require("../competitions/competitionsService");
const TicketingTransaction = require("../ticketing/ticketingTransactionService");
const TicketingUserTicket = require("../ticketing/ticketingUserTicketService");
const Model = require("../../models/parties.model.js");
const findLocation = require("../../modules/location/findLocation.js");
const PartySchema = require("../../modules/validation/parties.js").PartySchema;
const papeoError = require("../../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const searchModule = require("./modules/search/search");
const {
  PUSH_PARTY_REMINDER,
} = require("../../modules/notifications/push/internationalization");
const {
  sendNotificationToUser,
} = require("../../modules/notifications/push/sendNotification");
const crypto = require("crypto");
const mongoose = require("mongoose");
const {
  createActivityTargetGroup,
} = require("../activities/createActivityTargetGroup");
const {
  getBookmarkedPartyUserIds,
  getGuestWaitingPartyUserIds,
  getFriendIdsFromUser,
  getFollowerIdsFromUser,
  getPartyAdmins,
} = require("../activities/helper/getTargetGroup");

const { text, PARTYCHANGE_LANG } = require("./modules/partyChangeTranslation");
const CONCURRENT_PARTIES_LIMIT = 3;
const CONCURRENT_PARTIES_LIMIT_PARTY_KING = 10;

const removeFirebaseUser =
  require("../users/modules/firebase/users.js").removeFirebaseUser;
const partyGuests = require("../../routes/partyGuests.js");
const Activity = require("../activities/activitiesService");
const {
  mutuallyExclusiveProperties,
} = require("@google/maps/lib/internal/validate.js");
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

let MODEL = options.Model;
exports.MODEL = options.Model;

const get = async (id, params) => {
  let result = await service(options).get(id, params);
  return result;
};

const find = async (query) => {
  let result = await service(options).find(query);
  result.data = result.data.map((party) => {
    return { ...party, inviteToken: undefined };
  });
  return result;
};

const search = async (user, query) => {
  console.log("query:", query);
  let result = await searchModule.search(user, query || {});
  return result;
};
exports.search = search;

const create = async (data) => {
  const partyId = mongoose.Types.ObjectId();
  data._id = partyId;
  const owner = await User.getRaw(data.owner);
  if (data.status === "published") {
    const canPublishParty = await User.membership.canPublishParty(
      owner,
      data.type,
      data.privacyLevel
    );
    console.log({ canPublishParty });
    if (!canPublishParty.result) {
      throw papeoError(PAPEO_ERRORS.YOU_DONT_HAVE_ENOUGH_PP_TO_PUBLISH_PARTY);
    }
    if (canPublishParty.cost !== 0) {
      await Transaction.TYPES.createdAdditionalParty({
        user: await User.get(data.owner),
        points: canPublishParty.cost,
        party: data,
      });
    }
  }
  data = await findLocation.generateLocation(data);

  data.calculatedEndDate = data.endDate;
  if (data.startDate && !data.endDate) {
    // set endDate to 2h after startDate if no endDate is set
    const date = new Date(data.startDate);
    date.setTime(date.getTime() + 2 * 60 * 60 * 1000);
    data.calculatedEndDate = date;
  }
  data.inviteToken = crypto.randomUUID();
  // we assume that the owner of the party exists before creating the party
  let result = await service(options).create(data);
  if (result.status === "published" && result.privacyLevel !== "secret") {
    await createActivityTargetGroup({
      type: "partyWasPublished",
      notificationCategories: ["parties"],
      targetGroups: {
        friends: getFriendIdsFromUser(owner),
        followers: await getFollowerIdsFromUser(owner._id),
      },
      parties: [partyId],
      otherUsers: [owner._id],
      sendNotification: true,
    });
  }
  await User.patch(data.owner, {
    $addToSet: {
      parties: result._id,
    },
  });
  return result;
};

const patch = async (id, data) => {
  let party = await get(id, {
    query: { $select: { "+inviteToken": 1 } },
  });
  if (
    party.privacyLevel === "secret" &&
    data.privacyLevel &&
    data.privacyLevel !== "secret" &&
    party.status !== "draft"
  ) {
    throw papeoError(PAPEO_ERRORS.SECRET_PARTY_PRIVACY_LEVEL_CANNOT_BE_CHANGED);
  }
  if (data.status === "published" && party.status !== "published") {
    const owner = await User.getRaw(party.owner);
    const canPublishParty = await User.membership.canPublishParty(
      owner,
      party.type,
      party.privacyLevel
    );
    if (!canPublishParty.result) {
      throw papeoError(PAPEO_ERRORS.YOU_DONT_HAVE_ENOUGH_PP_TO_PUBLISH_PARTY);
    }
    if (canPublishParty.cost !== 0) {
      await Transaction.TYPES.createdAdditionalParty({
        user: await User.get(party.owner),
        points: canPublishParty.cost,
        party: party,
      });
    }

    if (party.privacyLevel !== "secret") {
      await createActivityTargetGroup({
        type: "partyWasPublished",
        notificationCategories: ["parties"],
        targetGroups: {
          friends: getFriendIdsFromUser(owner),
          followers: await getFollowerIdsFromUser(owner._id),
        },
        parties: [id],
        otherUsers: [owner._id],
        sendNotification: true,
      });
    }
  }
  data = await patchIsLocationChanged(data, party);

  if (data.endDate) data.calculatedEndDate = data.endDate;
  if (data.startDate && !data.endDate) {
    // set endDate to 2h after startDate if no endDate is set
    const date = new Date(data.startDate);
    date.setTime(date.getTime() + 2 * 60 * 60 * 1000);
    data.calculatedEndDate = date;
  }

  let dataToMerge = partyChangeCheck(party, data);
  let merged = { ...data, ...dataToMerge };

  let result = await service(options).patch(id, merged);
  if (result.competition) {
    const competition = await Competition.get(result.competition);
    if (!Competition.isPartyInCompetitionDateRange(competition, result)) {
      await Competition.removePartyFromCompetition(result._id);
    }
  }
  result.inviteToken = party.inviteToken;
  return result;
};

const partyChangeCheck = (oldParty, newParty) => {
  let data = {};
  if (oldParty.status === "published") {
    if (newParty.name && oldParty.name !== newParty.name)
      data.nameUpdatedDate = new Date();
    if (newParty.description && oldParty.description !== newParty.description)
      data.descriptionUpdatedDate = new Date();
    if (newParty.address && oldParty.address !== newParty.address)
      data.addressUpdatedDate = new Date();
    if (
      newParty.entranceFeeText &&
      oldParty.entranceFeeText !== newParty.entranceFeeText
    )
      data.entranceFeeUpdatedDate = new Date();
    if (newParty.capacity && oldParty.capacity !== newParty.capacity)
      data.capacityUpdatedDate = new Date();
    if (
      newParty.informationForAcceptedGuests &&
      oldParty.informationForAcceptedGuests !==
        newParty.informationForAcceptedGuests
    )
      data.informationForAcceptedGuestsUpdatedDate = new Date();
    if (newParty.startDate && oldParty.startDate !== newParty.startDate)
      data.startDateUpdatedDate = new Date();
    if (newParty.endDate && oldParty.endDate !== newParty.endDate)
      data.endDateUpdatedDate = new Date();
  }
  return data;
};

exports.handlePartyChange = async () => {
  console.log("executing partyChangeCheck ....");
  let checkDate = new Date();
  checkDate.setMinutes(checkDate.getMinutes() - 3);

  let promiseArray = [];
  let parties = await MODEL.find({
    $and: [
      { status: "published" },
      {
        $or: [
          { nameUpdatedDate: { $lte: checkDate } },
          { nameUpdatedDate: null },
        ],
      },
      {
        $or: [
          { descriptionUpdatedDate: { $lte: checkDate } },
          { descriptionUpdatedDate: null },
        ],
      },
      {
        $or: [
          { addressUpdatedDate: { $lte: checkDate } },
          { addressUpdatedDate: null },
        ],
      },
      {
        $or: [
          { entranceFeeUpdatedDate: { $lte: checkDate } },
          { entranceFeeUpdatedDate: null },
        ],
      },
      {
        $or: [
          { capacityUpdatedDate: { $lte: checkDate } },
          { capacityUpdatedDate: null },
        ],
      },
      {
        $or: [
          { informationForAcceptedGuestsUpdatedDate: { $lte: checkDate } },
          { informationForAcceptedGuestsUpdatedDate: null },
        ],
      },
      {
        $or: [
          { startDateUpdatedDate: { $lte: checkDate } },
          { startDateUpdatedDate: null },
        ],
      },
      {
        $or: [
          { endDateUpdatedDate: { $lte: checkDate } },
          { endDateUpdatedDate: null },
        ],
      },
    ],
  });

  parties.forEach((party) => {
    promiseArray.push(calculatePartyChange(party));
  });
  await Promise.all(promiseArray);
};

const calculatePartyChange = async (party) => {
  let calculatedChanged = calculateChangeInformation(party);

  if (calculatedChanged.text !== "") {
    console.log(`Party ${party._id} changed`);
    /*
    await createActivityTargetGroup({
      type: "patchedPartyInformation",
      additionalInformation: {
        text: calculatedChanged.text,
      },
      parties: [party._id],
      targetGroups: {
        parties: await getGuestWaitingPartyUserIds(party._id),
      },
      sendNotification: true,
    });
    */
    await patch(party._id, calculatedChanged.attributesToUpdate);
  }
};

const calculateChangeInformation = (party) => {
  let changedInformation = {
    text: "",
    attributesToUpdate: {},
  };

  let checkDate = new Date();
  checkDate.setMinutes(checkDate.getMinutes() - 3);

  if (party.nameUpdatedDate && new Date(party.nameUpdatedDate) < checkDate)
    changedInformation = addInformationToString(
      changedInformation,
      "nameUpdatedDate"
    );
  if (
    party.descriptionUpdatedDate &&
    new Date(party.descriptionUpdatedDate) < checkDate
  )
    changedInformation = addInformationToString(
      changedInformation,
      "descriptionUpdatedDate"
    );
  if (
    party.addressUpdatedDate &&
    new Date(party.addressUpdatedDate) < checkDate
  )
    changedInformation = addInformationToString(
      changedInformation,
      "addressUpdatedDate"
    );
  if (
    party.entranceFeeUpdatedDate &&
    new Date(party.entranceFeeUpdatedDate) < checkDate
  )
    changedInformation = addInformationToString(
      changedInformation,
      "entranceFeeUpdatedDate"
    );
  if (
    party.capacityUpdatedDate &&
    new Date(party.capacityUpdatedDate) < checkDate
  )
    changedInformation = addInformationToString(
      changedInformation,
      "capacityUpdatedDate"
    );
  if (
    party.informationForAcceptedGuestsUpdatedDate &&
    new Date(party.informationForAcceptedGuestsUpdatedDate) < checkDate
  )
    changedInformation = addInformationToString(
      changedInformation,
      "informationForAcceptedGuestsUpdatedDate"
    );
  if (
    party.startDateUpdatedDate &&
    new Date(party.startDateUpdatedDate) < checkDate
  )
    changedInformation = addInformationToString(
      changedInformation,
      "startDateUpdatedDate"
    );
  if (
    party.endDateUpdatedDate &&
    new Date(party.endDateUpdatedDate) < checkDate
  )
    changedInformation = addInformationToString(
      changedInformation,
      "endDateUpdatedDate"
    );
  return changedInformation;
};

let addInformationToString = (changedInformation, type) => {
  if (changedInformation.text === "") {
    changedInformation.text += `${text(PARTYCHANGE_LANG[type])}`;
    changedInformation.attributesToUpdate[type] = null;
  } else {
    changedInformation.text += `, ${text(PARTYCHANGE_LANG[type])}`;
    changedInformation.attributesToUpdate[type] = null;
  }

  return changedInformation;
};

const patchUploadOrder = async (partyId, newUploadOrder) => {
  const party = await get(partyId);
  const oldUploads = party.uploads;
  const newUploads = [];

  const deletedUploads = oldUploads.filter(
    (upload) => !newUploadOrder.includes(upload.toString())
  );
  await Promise.allSettled(
    deletedUploads.map((du) => {
      console.log(du);
      return Upload.remove(du);
    })
  );

  for (const uid of newUploadOrder) {
    const found = oldUploads.find(
      (oldUpload) => oldUpload.toString() === uid.toString()
    );
    if (!found) continue;
    newUploads.push(found);
  }
  return await patch(partyId, {
    uploads: newUploads,
  });
};

const remove = async (id) => {
  const party = await get(id);

  if (party.competition) {
    await Competition.removePartyFromCompetition(id);
  }
  // remove all uploads
  await Promise.allSettled(
    party.uploads.map(async (upload) => {
      return await Upload.remove(upload);
    }),
    Activity.MODEL.deleteMany({
      parties: id,
    })
  );
  // remove all posts
  const posts = await Post.find({
    query: { party: id },
  });
  if (posts.data.length > 0) {
    await Promise.allSettled(
      posts.data.map(async (post) => {
        return await Post.remove(post);
      })
    );
  }

  // remove all guests
  await PartyGuest.removeManyByPartyId(id);
  // remove all bookmarks
  await Bookmark.removeManyByPartyId(id);
  // remove all swipes
  await Swipe.removeManyByPartyId(id);
  // remove all ratings
  await Rating.removeManyByPartyId(id);

  let result = await service(options).remove(id);

  await User.patch(result.owner, {
    $pull: {
      parties: result._id,
    },
  });

  return result;
};

const addPartyAdmin = async (partyId, admin) => {
  const party = await get(partyId);
  const isUserOnGuestlist = await PartyGuest.isUserAttendingPartyGuest(
    partyId,
    admin.user.toString()
  );
  if (!isUserOnGuestlist) {
    throw papeoError(PAPEO_ERRORS.ONLY_USER_ON_THE_GUESTLIST_CAN_BE_ADMINS);
  }
  const foundMe = party.admins?.find(
    (a) => a.user.toString() === admin.user.toString()
  );
  if (foundMe) {
    throw papeoError(PAPEO_ERRORS.USER_IS_ALREADY_ADMIN_OF_THIS_PARTY);
  }
  await Activity.create({
    type: "addedPartyAdmin",
    notificationCategories: ["parties"],
    user: admin.user.toString(),
    otherUsers: [admin.user.toString()],
    parties: [party._id],
    sendNotification: true,
  });
  await createActivityTargetGroup({
    type: "addedPartyAdmin",
    notificationCategories: ["parties"],
    user: admin.user.toString(),
    otherUsers: [admin.user.toString()],
    parties: [party._id],
    targetGroups: {
      parties: await getPartyAdmins(party),
    },
    sendNotification: true,
  });
  return await patch(partyId, {
    $push: {
      admins: admin,
    },
  });
};
const removePartyAdmin = async (partyId, adminId) => {
  const party = await get(partyId);
  if (party.admins.find((pa) => pa.user.toString() === adminId.toString())) {
    await Activity.create({
      type: "removedPartyAdmin",
      notificationCategories: ["parties"],
      user: adminId.toString(),
      otherUsers: [adminId.toString()],
      parties: [partyId],
      sendNotification: true,
    });
    await createActivityTargetGroup({
      type: "removedPartyAdmin",
      notificationCategories: ["parties"],
      user: adminId.toString(),
      otherUsers: [adminId.toString()],
      parties: [partyId],
      targetGroups: {
        parties: await getPartyAdmins(party),
      },
      sendNotification: true,
    });
  }
  return await patch(partyId, {
    $pull: {
      admins: { user: adminId },
    },
  });
};
const patchPartyAdmin = async (partyId, admin) => {
  const party = await get(partyId);
  const oldAdmin = party.admins.find(
    (a) => a.user.toString() === admin.user.toString()
  );
  if (!oldAdmin) {
    throw papeoError(PAPEO_ERRORS.THIS_USER_IS_NOT_A_PARTY_ADMIN);
  }
  const oldAdminIndex = party.admins.findIndex(
    (a) => a.user.toString() === admin.user.toString()
  );
  const admins = [...party.admins];
  admins[oldAdminIndex].rights = { ...oldAdmin.rights, ...admin.rights };

  return await patch(partyId, {
    admins: admins,
  });
};

const addPartyStaff = async (partyId, staff) => {
  const party = await get(partyId);

  const foundMe = party.staff?.find(
    (a) => a.user.toString() === staff.user.toString()
  );
  if (foundMe) {
    throw papeoError(PAPEO_ERRORS.USER_IS_ALREADY_ADMIN_OF_THIS_PARTY);
  }
  await Activity.create({
    user: staff.user,
    otherUsers: [party.owner],
    type: "partyStaffCreated",
    additionalInformation: {},
    notificationCategories: ["parties"],
    parties: [party._id],
    sendNotification: true,
  });
  return await patch(partyId, {
    $push: {
      staff: staff,
    },
  });
};
exports.addPartyStaff = addPartyStaff;
const removePartyStaff = async (partyId, staffId) => {
  const party = await get(partyId);
  const oldStaff = party.staff.find(
    (a) => a.user.toString() === staffId.toString()
  );
  if (!oldStaff) {
    throw papeoError(PAPEO_ERRORS.THIS_USER_IS_NOT_A_PARTY_ADMIN);
  }
  return await patch(partyId, {
    $pull: {
      staff: { user: staffId },
    },
  });
};
exports.removePartyStaff = removePartyStaff;
const patchPartyStaff = async (partyId, staff) => {
  const party = await get(partyId);
  const oldStaff = party.staff.find(
    (a) => a.user.toString() === staff.user.toString()
  );
  if (!oldStaff) {
    throw papeoError(PAPEO_ERRORS.THIS_USER_IS_NOT_A_PARTY_ADMIN);
  }
  const oldStaffIndex = party.staff.findIndex(
    (a) => a.user.toString() === staff.user.toString()
  );
  const partyStaff = [...party.staff];
  partyStaff[oldStaffIndex].rights = { ...oldStaff.rights, ...staff.rights };
  if (staff.responsibility !== undefined) {
    partyStaff[oldStaffIndex].responsibility = staff.responsibility;
  }
  return await patch(partyId, {
    staff: partyStaff,
  });
};
exports.patchPartyStaff = patchPartyStaff;

const recalculateRating = async (id) => {
  const { avg, count } = await Rating.getAveragePartyRating(id);
  const result = await patch(id, {
    rating: {
      avg,
      count,
    },
  });
  return result;
};

const patchIsLocationChanged = async (data, party) => {
  if (data.placeId && party?.placeId !== data?.placeId) {
    data = await findLocation.generateLocation(data);
  } else if (data?.location?.coordinates) {
    data = await findLocation.generateLocation(data);
  }
  return data;
};

const addUpload = async (partyId, uploadId) => {
  return await patch(partyId, {
    $addToSet: {
      uploads: uploadId,
    },
  });
};

const removeUpload = async (partyId, uploadId) => {
  console.log("removing uploaded file:", uploadId);
  return await patch(partyId, {
    $pull: {
      uploads: uploadId,
    },
  });
};

const isUploadAllowed = async (user, party) => {
  // isPartyGuest
  if (!user) {
    return {
      canUpload: false,
      reason: "USER_NOT_ON_GUESTLIST",
      allowedUploadTime: null,
    };
  }
  if (user._id.toString() === party.owner._id.toString()) {
    return { canUpload: true, reason: null, allowedUploadTime: null };
  }
  const isPartyGuest = await PartyGuest.isUserAttendingPartyGuest(
    party._id,
    user._id
  );
  if (!isPartyGuest) {
    return {
      canUpload: false,
      reason: "USER_NOT_ON_GUESTLIST",
      allowedUploadTime: null,
    };
  }

  return { canUpload: true, reason: null, allowedUploadTime: null };
};
exports.isUploadAllowed = isUploadAllowed;

const exists = async (id) => {
  let result = await options.Model.exists({ _id: id });
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

const getActivePartiesFromUser = async (userId) => {
  const now = new Date();
  const beforeTwoHours = new Date();
  beforeTwoHours.setTime(beforeTwoHours.getTime() - 2 * 60 * 60 * 1000);
  const parties = await options.Model.find({
    owner: userId,
    status: "published",
    // edgecase: when party length is under two hours
    $or: [{ startDate: { $gt: beforeTwoHours } }, { endDate: { $gt: now } }],
  });
  return parties;
};
exports.getActivePartiesFromUser = getActivePartiesFromUser;

const getActivePartiesFromUserPopulated = async (userId) => {
  const now = new Date();
  const beforeTwoHours = new Date();
  beforeTwoHours.setTime(beforeTwoHours.getTime() - 2 * 60 * 60 * 1000);
  const parties = await options.Model.find({
    owner: userId,
    status: "published",
    // edgecase: when party length is under two hours
    $or: [{ startDate: { $gt: beforeTwoHours } }, { endDate: { $gt: now } }],
  })
    .populate({ path: "owner uploads" })
    .sort({ startDate: -1 });
  return parties;
};
exports.getActivePartiesFromUserPopulated = getActivePartiesFromUserPopulated;

const getAllNearbyUsers = async (party) => {
  const users = await User.MODEL.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: party.location.coordinates,
        },
        key: "currentLocation.coordinates",
        maxDistance: 100,
        spherical: true,
        distanceField: "distance",
        distanceMultiplier: 1 / 1000,
      },
    },
  ]);
  return users;
};
exports.getAllNearbyUsers = getAllNearbyUsers;

const getOverlappingParties = async (party) => {
  /**
  at the same time is defined as: 
  Party1: 20:00-02:00
  Party2: 14:00-20:00 -> Not at the same time
  Party2: 14:00-21:00 -> At the same time
  Party2: 02:00:00-05:00 -> Not at the same time
  Party2: 01:00:00-05:00 -> At the same time
  -> Parties are at the same time when the durations are overlapping
  2.startDate < 1.calculatedEndDate  && 2.calculatedEndDate > 1.startDate 
  */
  return options.Model.find({
    _id: { $ne: party._id },
    startDate: {
      $lt: party.calculatedEndDate,
    },
    calculatedEndDate: {
      $gt: party.startDate,
    },
  });
};
exports.getOverlappingParties = getOverlappingParties;

const canUserJoinParty = async (user, party) => {
  const partyIsFull =
    (await PartyGuest.getPartyGuestCount(party._id)) >= party.capacity;
  if (partyIsFull) return { canJoinParty: false, reason: "GUESTLIST_FULL" };
  if (!user) return { canJoinParty: true };
  const isUserAnyPartyGuestResult = await PartyGuest.isUserAnyPartyGuest(
    party._id,
    user._id
  );
  if (isUserAnyPartyGuestResult)
    return { canJoinParty: false, reason: "ALREADY_GUEST" };
  const overlappingParties = await getOverlappingParties(party);
  const isGuestOnOverlappingParties = await PartyGuest.find({
    query: {
      party: {
        $in: overlappingParties.map((p) => p._id),
      },
      user: user._id,
    },
  });
  if (user.isPartyKing) {
    if (
      isGuestOnOverlappingParties.total < CONCURRENT_PARTIES_LIMIT_PARTY_KING
    ) {
      return { canJoinParty: true };
    }
  }
  if (isGuestOnOverlappingParties.total < CONCURRENT_PARTIES_LIMIT) {
    return { canJoinParty: true };
  }
  return { canJoinParty: false, reason: "OTHER" };
};
exports.canUserJoinParty = canUserJoinParty;

const getCounts = async (user, party) => {
  if (!user) {
    return {
      guestCount: await PartyGuest.getPartyGuestCount(party._id),
      bookmarkCount: await Bookmark.getBookmarkCountForAParty(party._id),
    };
  }
  const friendsAttendingThisParty =
    await PartyGuest.getFriendsAttendingThisParty(user, party._id);
  return {
    friendsAttendingThisParty,
    friendsAttendingThisPartyCount: friendsAttendingThisParty.length,
    guestCount: await PartyGuest.getPartyGuestCount(party._id),
    bookmarkCount: await Bookmark.getBookmarkCountForAParty(party._id),
    bookmarksFromFriendsCount:
      await Bookmark.getBookmarkCountForFriendsForAParty(user, party._id),
  };
};
exports.getCounts = getCounts;

const userCanSeeSecretParty = async (user, party) => {
  if (!user) return false;
  const isInvited = await Invite.isUserInvited(party._id, user._id);
  const isGuest = await PartyGuest.isUserAnyPartyGuest(party._id, user._id);
  const isGuestOrInvited = isInvited || isGuest;
  const partyOwnerId = party.owner._id
    ? party.owner._id.toString()
    : party.owner.toString();
  return !!(isGuestOrInvited || partyOwnerId === user._id.toString());
};
exports.userCanSeeSecretParty = userCanSeeSecretParty;

const setPartyToExpired = async (partyId) => {
  console.log(`setting party ${partyId} to expired`);
  if (!partyId) throw new Error("partyId must be set");
  await PartyGuest.MODEL.updateMany(
    { party: partyId.toString() },
    { $set: { expired: true } }
  );
  await Invite.MODEL.deleteMany({ party: partyId.toString() });
  await patch(partyId, {
    expired: true,
  });
};
exports.setPartyToExpired = setPartyToExpired;

const setPartyToExpired12h = async (partyId) => {
  console.log(`setting party ${partyId} to expired after 12h`);
  if (!partyId) throw new Error("partyId must be set");
  await PartyGuest.MODEL.updateMany(
    { party: partyId.toString() },
    { $set: { expired12h: true } }
  );
  // await Invite.MODEL.deleteMany({ party: partyId.toString() });
  await patch(partyId, {
    expired12h: true,
  });
};
exports.setPartyToExpired12h = setPartyToExpired12h;

const cancelParty = async (partyId) => {
  console.log(`cancelling party ${partyId}`);
  if (!partyId) throw new Error("partyId must be set");
  await TicketingTransaction.refundSuccededTransactionsForParty(partyId);
  await TicketingUserTicket.MODEL.updateMany(
    { party: partyId },
    { $set: { refunded: true } }
  );
  return await options.Model.updateOne(
    { _id: partyId.toString() },
    { $set: { cancelled: true } }
  );
};
exports.cancelParty = cancelParty;

exports.handlePartyReminderPush = async () => {
  console.log("executing party reminder push notifications check...");
  const in24h = new Date();
  in24h.setTime(in24h.getTime() + 24 * 60 * 60 * 1000);
  const in20h = new Date();
  in20h.setTime(in20h.getTime() + 20 * 60 * 60 * 1000);
  const parties = await MODEL.find({
    $and: [
      { startDate: { $lte: in24h } },
      { startDate: { $gte: in20h } },
      { expired: false, status: "published" },
    ],
  });
  const partyIds = parties.map((p) => p._id);
  const partyGuests = await PartyGuest.MODEL.find({
    party: {
      $in: partyIds,
    },
    showedPartyReminderNotification: false,
    status: "attending",
    reminder: true,
  });
  for (const pg of partyGuests) {
    console.log(
      `sending reminder to ${pg.user.toString()} for party ${pg.party.toString()}`
    );
    const party = parties.find((p) => p._id.toString() === pg.party.toString());
    //I18N
    const user = await User.get(pg.user);
    const msg = PUSH_PARTY_REMINDER(party, user.languageSetting || "de");
    console.log(msg);
    await sendNotificationToUser(pg.user.toString(), msg.title, msg.body, {
      command: "openParty",
      contentId: pg.party.toString(),
    });

    await PartyGuest.patch(pg._id, { showedPartyReminderNotification: true });
  }
};

exports.get = get;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.patchUploadOrder = patchUploadOrder;
exports.remove = remove;
exports.addPartyAdmin = addPartyAdmin;
exports.removePartyAdmin = removePartyAdmin;
exports.patchPartyAdmin = patchPartyAdmin;
exports.recalculateRating = recalculateRating;
exports.addUpload = addUpload;
exports.removeUpload = removeUpload;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;

/* MIGRATION
(async () => {
  setTimeout(async () => {
    console.log("test");
    const parties = await options.Model.find();
    for (let i = 0; i < parties.length; i++) {
      const party = parties[i];
      console.log(i, party.name);
      const pics = [
        "6130f6e6b8723c06038ff7e7",
        "6130f6e6b8723c06038ff7e8",
        "6130f6e6b8723c06038ff7e6",
        "6130f6ecb8723c06038ff92e",
        "6130f6f2b8723c06038ffa76",
        "6130f6f2b8723c06038ffa78",
        "6130f6f9b8723c06038ffbbe",
        "6130f6f9b8723c06038ffbbf",
        "6130f6ffb8723c06038ffd08",
      ];
      const names = [
        "Anti-Covid-Party",
        "Spätitour durch Kreuzberg",
        "Silvester 2021/2022",
        "Ugly-Sweater-Party",
        "Bunkerrave #2",
        "Homeparty bei Max #Freibier",
        "Claras Geburtstag",
        "2000er Mottoparty",
        "Bad-Taste-Party",
        "WG-Einweihungsparty",
        "Open Air im Volkspark",
        "Bierballturnier",
      ];
      if (i > 200) continue;
      //await patch(party._id, {
      //  uploads: [pics[i % pics.length]],
      //});
      await patch(party._id, {
        name: names[i % names.length],
      });
    }
  }, 2000);
})();
*/
/* setting inviteTokens
(async () => {
  setTimeout(async () => {
    console.log("test");
    const parties = await options.Model.find();
    for (let i = 0; i < parties.length; i++) {
      const party = parties[i];
      const patchData = {
        inviteToken: crypto.randomUUID(),
      };
      console.log(patchData);
      await patch(party._id, patchData);
    }
  }, 2000);
})();
*/
