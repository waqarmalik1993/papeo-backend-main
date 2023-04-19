const service = require("feathers-mongoose");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const {
  createFirebaseUser,
  patchFirebaseUser,
  removeFirebaseUser,
  generateFirebaseJWT,
} = require("./modules/firebase/users.js");
const Rating = require("../ratings/ratingsService.js");
const Model = require("../../models/users.model.js");
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../../modules/errors/errors.js").papeoError;
const Follower = require("../followers/followersService.js");
const Party = require("../parties/partiesService");
const PartyGuest = require("../partyGuests/partyGuestsService");
const MyPartyGuests = require("../myPartyGuests/myPartyGuestsService");
const ImageMention = require("../imageMention/imageMentionService");
const Invite = require("../invites/invitesService");
const PostComment = require("../posts/comments/postCommentsService");
const Post = require("../posts/postsService");
const Swipe = require("../swipes/swipesService");
const Upload = require("../uploads/uploadsService.js");
const Bookmark = require("../bookmarks/bookmarksService");
const ReferralTree = require("../referralTree/referralTreeService");
const Transaction = require("../transactions/transactionsService");
const TicketingUserTicket = require("../ticketing/ticketingUserTicketService");
const Newsletter = require("../newsletter/newsletterService");
const searchModule = require("./modules/search/search");
const adminSearchModule = require("./modules/search/adminSearch");
const verificationModule = require("./modules/verification/verification");
const stripeTicketing = require("../integrations/stripe/ticketingStripe");
const {
  createActivityTargetGroup,
} = require("../activities/createActivityTargetGroup");
const {
  getFriendIdsFromUser,
  getFollowerIdsFromUser,
} = require("../activities/helper/getTargetGroup");
const {
  findAddressToLongLat,
  obfuscateGeo,
} = require("../../modules/location/findLocation");
const { patchCustomer } = require("../integrations/stripe/helper/setupPayment");

const {
  removeFcmTokenIfItsExistsOnAnotherUser,
} = require("./modules/fcmToken");
const membershipModule = require("./modules/membership/membership");
const Activity = require("../activities/activitiesService");
const referralModule = require("./modules/referral/referral");
const { Forbidden, BadRequest } = require("@feathersjs/errors");

const DEFAULT_ADMIN_RIGHTS = {
  manageUserProfiles: false,
  manageUserLinks: false,
  muteUser: false,
  lockUser: false,
  advancedMemberSearch: false,
  deleteRating: false,
  deleteUserFinally: false,
  manageMedia: false,
  manageComments: false,
  manageParties: false,
  inviteGuestsToParties: false,
  managePartyPoints: false,
  manageMembership: false,
  editTranslation: false,
  changeTC: false,
  manageMainMenu: false,
  rateVideoIdent: false,
  manageViolationReports: false,
  viewStatistics: false,
  viewAdminLog: false,
  manageAdmins: false,
  canSeeSecretParties: false,
  loginAsUser: false,
  enablePayouts: false,
  payoutPayouts: false,
  editNewsletter: false,
  createNewsletter: false,
  createUserProfiles: false,
};

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
    "$text",
    "$search",
    "$caseSensitive",
    "$language",
    "$diacriticSensitive",
  ],
};

exports.MODEL = options.Model;

// TODO E-Mail Adressen müssen immer verifiziert werden!!!
// TODO Neue Telefonnummern müssen immer verifziert werden!!!

const get = async (id, params) => {
  let result = await service(options).get(id, params);
  return result;
};
const getRaw = async (id) => {
  const result = await mongoose.connection.db.collection("users").findOne({
    _id: mongoose.Types.ObjectId(id),
  });
  return result;
};

const find = async (query) => {
  let result = await service(options).find(query);
  return result;
};

const search = async (user, query) => {
  console.log("query:", query);
  let result = await searchModule.search(user, query || {});
  return result;
};
exports.search = search;
const adminSearch = async (user, query) => {
  //console.log("query:", query);
  let result = await adminSearchModule.adminSearch(user, query || {});
  return result;
};
exports.adminSearch = adminSearch;

const create = async (data) => {
  const userId = mongoose.Types.ObjectId();
  data._id = userId;

  try {
    if (data.username) {
      const usernameLowercase = data.username.toLowerCase();
      const user = await getByOneAttribute(
        "usernameLowercase",
        usernameLowercase
      );
      if (user) throw papeoError(PAPEO_ERRORS.USERNAME_ALREADY_EXISTS);
      data.usernameLowercase = usernameLowercase;
    }
    let result = await service(options).create(data);
    await createFirebaseUser(result);
    const result2 = await this.referral.addRandomReferralCodeToUser(userId);

    await Newsletter.createNewsletterForNewUser(userId);

    return await { ...result, referralCodes: result2.referralCodes };
  } catch (e) {
    console.log(e);
    if (await getByOneAttribute("_id", userId)) await remove(userId);
    await removeFirebaseUser(userId);
    throw e;
  }
};
const createRaw = async (data) => {
  const result = await service(options).create(data);
  return result;
};

const patch = async (id, data, params) => {
  // TODO Wenn Nutzer gesperrt wird auch den Firebase Nutzer sperren
  // TODO Checken ob ein anderer Nutzer die Adresse bereits hat.

  const user = await getRaw(id);
  if (
    data?.homeLocation?.coordinates.length &&
    (data?.homeLocation?.coordinates?.[0] !==
      user?.homeLocation?.coordinates?.[0] ||
      data?.homeLocation?.coordinates?.[1] !==
        user?.homeLocation?.coordinates?.[1])
  ) {
    let location = data.homeLocation.coordinates;

    let obfuscatedGeo = obfuscateGeo(
      { longitude: location[0], latitude: location[1] },
      1000
    );
    data.obfuscatedHomeLocation = [
      obfuscatedGeo.longitude,
      obfuscatedGeo.latitude,
    ];

    console.log(data.obfuscatedHomeLocation);

    let { address } = await findAddressToLongLat(location[0], location[1]);
    data.homeAddress = address;
  }

  if (data.currentLocation?.coordinates) {
    let obfuscatedCurrentGeo = obfuscateGeo(
      {
        longitude: data.currentLocation?.coordinates[0],
        latitude: data.currentLocation?.coordinates[1],
      },
      1000
    );
    data.obfuscatedCurrentLocation = {
      type: "Point",
      coordinates: [
        parseFloat(obfuscatedCurrentGeo.longitude),
        parseFloat(obfuscatedCurrentGeo.latitude),
      ],
    };
  }

  if (data.email && data.email !== user.email) {
    const userWithEmail = await getByOneAttribute("email", data.email);
    if (userWithEmail) throw papeoError(PAPEO_ERRORS.EMAIL_ALREADY_EXISTS);
    const userHasOtherPlatformsAsLocal = user.authPlatforms.find(
      (ap) => ap.method !== "local"
    );
    if (userHasOtherPlatformsAsLocal) {
      throw papeoError(PAPEO_ERRORS.EMAIL_CANNOT_BE_CHANGED);
    }
  }

  // TODO phoneNumber muss verified werden
  if (data.phoneNumber) {
    const user = await getByOneAttribute("phoneNumber", data.phoneNumber);
    if (user) {
      throw papeoError(PAPEO_ERRORS.USER_WITH_PHONENUMBER_ALREADY_EXISTS);
    }
  }

  if (data.username) {
    const usernameLowercase = data.username.toLowerCase();
    const userWithSameUsername = await getByOneAttribute(
      "usernameLowercase",
      usernameLowercase
    );
    data.usernameLowercase = usernameLowercase;
    if (
      userWithSameUsername &&
      userWithSameUsername._id.toString() !== id.toString()
    ) {
      throw papeoError(PAPEO_ERRORS.USERNAME_ALREADY_EXISTS);
    }
    if (user && user.username !== null) {
      console.log("resetting verification for user:", user._id);
      await replaceVerificationUpload(id, null);
    }
  }

  if (data.sex) {
    if (user && user.sex !== null) await replaceVerificationUpload(id, null);
  }

  if (data.birthday && calculateAge(data.birthday) < 16) {
    throw papeoError(PAPEO_ERRORS.USERS_AGE_UNDER_16);
  }

  if (data.isArtist) {
    const user2 = await getRaw(id);
    if (!user2.isPartyKing) {
      throw papeoError(
        PAPEO_ERRORS.YOU_MUST_BE_A_PARTY_KING_MEMBER_TO_MARK_YOURSELF_AS_AN_ARTIST
      );
    }
    const before72h = new Date();
    before72h.setHours(before72h.getHours() - 72);
    if (
      user2.isArtistUpdatedDate === null ||
      user2.isArtistUpdatedDate < before72h
    ) {
      data.isArtistUpdatedDate = new Date();
    } else {
      throw papeoError(PAPEO_ERRORS.ALREADY_CHANGED_TO_ARTIST_72H, {
        countdownSeconds: Math.floor(
          (user2.isArtistUpdatedDate - before72h) / 1000
        ),
      });
    }
  }

  await patchFirebaseUser(id, data);

  if (
    user?.stripeCustomerId &&
    (data?.email !== user?.email || data?.username !== user?.username)
  ) {
    let newInformation = {};
    if (data.email) newInformation.email = data.email;
    if (data.username) newInformation.name = data.username;
    await patchCustomer(user.stripeCustomerId, newInformation);
  }
  if (data.isPartyKing === false) {
    data.profileBanner = null;
    try {
      await Upload.remove(user.profileBanner.upload);
      // eslint-disable-next-line no-empty
    } catch {}
  }
  let referringUser = null;
  if (data.referredBy) {
    referringUser = await this.MODEL.findOne({
      "referralCodes.code": data.referredBy,
    });
    if (!referringUser) {
      throw new BadRequest("referralCode does not exist");
    }
    if (referringUser._id.toString() === user._id.toString()) {
      throw new BadRequest("you cannot use your own referralCode");
    }
    if (user.referredBy !== null) {
      if (
        !user.referredByEditableUntil ||
        user.referredByEditableUntil < new Date()
      ) {
        throw new BadRequest("User was already referred by a user");
      }
      // lock modifications
      data.referredByEditableUntil = null;
      const isReferralAllowed = await ReferralTree.isReferralAllowed({
        referringUser: referringUser,
        referredUser: user,
      });
      if (!isReferralAllowed) {
        throw new BadRequest("You cannot refer this user");
      }
      // change referraltree
      await ReferralTree.patch(user._id, { parent: referringUser._id });
    }
  }
  if (data.languageSetting) {
    await ReferralTree.MODEL.updateOne(
      { _id: id },
      {
        $set: {
          "userData.languageSetting": data.languageSetting,
        },
      }
    );
  }
  let result = await service(options).patch(id, data);
  if (
    result.settings?.notifications?.referringTransactions !==
    user.settings?.notifications?.referringTransactions
  ) {
    console.log(
      "data.settings?.notifications?.referringTransactions !== undefined"
    );
    console.log({
      before: user.settings?.notifications?.referringTransactions,
      after: result.settings?.notifications?.referringTransactions,
    });
    await ReferralTree.MODEL.updateOne(
      { _id: id },
      {
        $set: {
          "userData.referringTransactionsPushEnabled":
            result.settings?.notifications?.referringTransactions,
        },
      }
    );
  }
  if (user.isPartyKing !== result.isPartyKing) {
    await ReferralTree.MODEL.updateOne(
      { _id: id },
      {
        $set: {
          "userData.isPartyKing": result.isPartyKing,
        },
      }
    );
  }
  if (data.username) {
    await Transaction.MODEL.updateMany(
      { "data.referredUserId": result._id },
      { $set: { "data.referredUserName": result.username } }
    );
    await ReferralTree.MODEL.updateOne(
      { _id: result._id },
      { $set: { "userData.username": result.username } }
    );
    await TicketingUserTicket.MODEL.updateMany(
      { user: result._id },
      { $set: { usernameLowercase: result.usernameLowercase } }
    );
    await createActivityTargetGroup({
      otherUsers: [user._id],
      type: "userHasChangedHisUsername",
      targetGroups: {
        friends: getFriendIdsFromUser(user),
        followers: await getFollowerIdsFromUser(user._id),
      },
      additionalInformation: {
        oldUsername: user.username,
        newUsername: data.username,
      },
      sendNotification: true,
    });
  }
  if (data.referredBy && !user.referredBy) {
    const isReferralAllowed = await ReferralTree.isReferralAllowed({
      referringUser: referringUser,
      referredUser: result,
    });
    if (!isReferralAllowed) {
      await this.MODEL.updateOne({ _id: result._id }, { referredBy: null });
      throw new BadRequest("You cannot refer this user");
    }
    await ReferralTree.createReferralTreeEntry(result, referringUser);
    if (params?.user?._id?.toString() === user._id.toString()) {
      const referralChain = await ReferralTree.getReferralChain(result._id);
      await this.referral.creditUserForReferralAndFollowUser(
        referringUser,
        data.referredBy,
        result
      );
      await ReferralTree.createReferralChainTransactions(referralChain, result);
    }
  }

  if (data.isArtist !== null && data.isArtist !== user.isArtist) {
    if (data.isArtist) {
      await Activity.create({
        notificationCategories: ["myProfileActivity"],
        user: user._id,
        otherUsers: [user._id],
        type: "artistActive",
        sendNotification: true,
      });
      await createActivityTargetGroup({
        otherUsers: [user._id],
        type: "artistActive",
        targetGroups: {
          friends: getFriendIdsFromUser(user),
          followers: await getFollowerIdsFromUser(user._id),
        },
        sendNotification: true,
      });
    } else if (data.isArtist === false) {
      await Activity.create({
        notificationCategories: ["myProfileActivity"],
        user: user._id,
        otherUsers: [user._id],
        type: "artistInactive",
        sendNotification: true,
      });
    }
  }
  if (data.description) {
    await createActivityTargetGroup({
      otherUsers: [user._id],
      type: "userHasChangedHisProfileDescription",
      targetGroups: {
        friends: getFriendIdsFromUser(user),
        followers: await getFollowerIdsFromUser(user._id),
      },
      sendNotification: true,
    });
  }
  return result;
};

const remove = async (id) => {
  // TODO Es müssen alle Informationen mit gelöscht werden! Inklusive Chat Nachrichten.
  const user = await getRaw(id);
  await options.Model.updateMany(
    { "partyFriends.friend": id },
    { $pull: { partyFriends: { friend: id } } }
  );
  await options.Model.updateMany(
    { blockedUsers: id },
    { $pull: { blockedUsers: id } }
  );
  await options.Model.updateMany(
    { blockedByUsers: id },
    { $pull: { blockedByUsers: id } }
  );

  const uploads = await Upload.MODEL.find({
    $or: [{ user: id }, { profileBannerFromUser: id }],
  });
  await Promise.allSettled(uploads.map((u) => Upload.remove(u._id)));

  await Activity.MODEL.deleteMany({
    otherUsers: id,
  });
  await Activity.MODEL.deleteMany({
    user: id,
  });
  await Bookmark.MODEL.deleteMany({
    user: id,
  });
  await Follower.MODEL.deleteMany({
    user: id,
  });
  await Follower.MODEL.deleteMany({
    followedUser: id,
  });
  await ImageMention.MODEL.deleteMany({
    user: id,
  });
  await ImageMention.MODEL.deleteMany({
    mentionedUser: id,
  });
  await Invite.MODEL.deleteMany({
    user: id,
  });
  await Invite.MODEL.deleteMany({
    invitedUser: id,
  });
  await Party.MODEL.deleteMany({
    owner: id,
  });
  await PartyGuest.MODEL.deleteMany({
    user: id,
  });
  await PostComment.MODEL.deleteMany({
    user: id,
  });
  await Post.MODEL.deleteMany({
    user: id,
  });
  await Swipe.MODEL.deleteMany({
    user: id,
  });
  await MyPartyGuests.MODEL.deleteMany({
    user: id,
  });
  await MyPartyGuests.MODEL.deleteMany({
    guest: id,
  });
  await Party.MODEL.updateMany(
    { "staff.user": id },
    { $pull: { staff: { user: id } } }
  );

  await ReferralTree.MODEL.updateOne(
    { _id: id },
    {
      $set: {
        "userData.isDeleted": true,
      },
    }
  );

  let result = await service(options).remove(id);
  if (!process.env.TEST) await removeFirebaseUser(id);
  return result;
};

const exists = async (id) => {
  let result = await options.Model.exists({ _id: id });
  return result;
};

//---------------------------------------------------

const getByOneAttribute = async (attributeName, value) => {
  let result = await service(options).find({
    query: {
      [attributeName]: value,
    },
  });
  return result.data.length ? result.data[0] : null;
};

const getByOneAttributeRaw = async (attributeName, value) => {
  let result = await mongoose.connection.db.collection("users").findOne({
    [attributeName]: value,
  });
  return result ? result : null;
};

const alreadyInUseByOtherUser = async (attributeName, value, userId) => {
  let result = await service(options).find({
    query: {
      _id: { $ne: userId },
      [attributeName]: value,
    },
  });
  return result.data.length ? result.data[0] : null;
};

const replaceProfilePictureUpload = async (userId, newUploadId) => {
  const me = await get(userId);
  if (me.profilePicture?.toString() === newUploadId.toString()) return null;
  if (me.profilePicture) {
    try {
      await Upload.remove(me.profilePicture);
    } catch (e) {
      console.log(e);
    }
  }
  await createActivityTargetGroup({
    otherUsers: [me._id],
    type: "userHasChangedHisProfilePicture",
    targetGroups: {
      friends: getFriendIdsFromUser(me),
      followers: await getFollowerIdsFromUser(me._id),
    },
    sendNotification: true,
  });
  await ReferralTree.MODEL.updateMany(
    { _id: userId },
    { $set: { "userData.profilePicture": newUploadId } }
  );
  return await patch(userId, {
    profilePicture: newUploadId,
  });
};
const removeProfilePicture = async (userId) => {
  //TODO remove profilePicture from Firebase User
  return await patch(userId, {
    profilePicture: null,
  });
};

const replaceVerificationUpload = async (userId, uploadId) => {
  const me = await get(userId);
  const before24Hours = new Date();
  before24Hours.setTime(before24Hours.getTime() - 24 * 60 * 60 * 1000);
  console.log({ uploadId });
  if (
    me.verification?.uploadTimestamp &&
    me.verification?.uploadTimestamp > before24Hours &&
    uploadId
  ) {
    await Upload.removeRaw(uploadId);
    throw papeoError(PAPEO_ERRORS.VERIFICATION_UPLOAD_NOT_POSSIBLE_24H);
  }
  if (me.verification.upload) {
    try {
      await Upload.removeRaw(me.verification.upload);
    } catch (e) {
      console.log(e);
    }
  }
  if (uploadId) {
    /*await Activity.create({
      notificationCategories: ["friends"],
      user: me._id,
      otherUsers: [me._id],
      type: "addedIdentvideo",
      sendNotification: true,
    });*/
    await createActivityTargetGroup({
      type: "addedIdentvideo",
      otherUsers: [me._id],
      excludeUsers: [me._id],
      targetGroups: {
        friends: getFriendIdsFromUser(me),
        following: await getFollowerIdsFromUser(me),
      },
      sendNotification: true,
    });
  }
  await PartyGuest.MODEL.updateMany(
    { user: userId },
    { isUserVerified: false }
  );
  const patchData = {
    "verification.upload": uploadId,
    // reset votes and verification status
    "verification.votes": [],
    "verification.verified": false,
  };
  if (uploadId) patchData["verification.uploadTimestamp"] = new Date();
  return await patch(userId, patchData);
};
exports.replaceVerificationUpload = replaceVerificationUpload;

const removeVerificationUpload = async (userId, uploadId) => {
  console.log("removing uploaded file:", uploadId, "and resetting votes");
  await PartyGuest.MODEL.updateMany(
    { user: userId },
    { isUserVerified: false }
  );
  // TODO NOTIFICATIONS
  return await patch(userId, {
    "verification.upload": null,
    // reset votes and verification status
    "verification.votes": [],
    "verification.verified": false,
  });
};

const patchApple = async (id, data) => {
  // TODO Webhook Endpunkt, wo Apple informiert, wenn ein Nutzer seine Daten ändert.
};

// TODO Refactoring
const loginWithPhoneNumber = async (user, phoneNumber) => {
  const now = new Date();
  if (!user) {
    const result = await create({
      phoneNumber,
      authPlatforms: [
        {
          method: "local",
        },
      ],
      firstLogin: true,
      firstLoginAt: now,
      lastLoginAt: now,
      successfulLoginCount: 1,
      adminRights: DEFAULT_ADMIN_RIGHTS,
      restrictions: {
        reportMedia: false,
        createParties: false,
        uploadMedia: false,
        commentMedia: false,
        participateInParties: false,
        login: false,
      },
    });
    //console.log(result);
    return result;
  }
  return await increaseLoginCount(user);
};

const createUserWithoutPhoneNumberForAdminUserCreation = async () => {
  const now = new Date();

  const result = await create({
    authPlatforms: [
      {
        method: "local",
      },
    ],
    firstLogin: true,
    firstLoginAt: now,
    lastLoginAt: now,
    successfulLoginCount: 1,
    createdByAdmin: true,
    adminRights: DEFAULT_ADMIN_RIGHTS,
    restrictions: {
      reportMedia: false,
      createParties: false,
      uploadMedia: false,
      commentMedia: false,
      participateInParties: false,
      login: false,
    },
  });
  // set allowAdminLogin setting to true
  return await patch(result._id, {
    "settings.allowAdminLogin": true,
  });
};
exports.createUserWithoutPhoneNumberForAdminUserCreation =
  createUserWithoutPhoneNumberForAdminUserCreation;

const loginWithApple = async (user, data) => {
  const now = new Date();
  if (!user) {
    if (data.email) {
      const userWithEmail = await getByOneAttribute("email", data.email);
      if (userWithEmail) {
        throw papeoError(PAPEO_ERRORS.REGISTERED_WITH_DIFFERENT_AUTHPLATFORM);
      }
    }

    return await create({
      authPlatforms: [
        {
          method: "apple",
          externalUserId: data.sub,
        },
      ],
      firstLogin: true,
      firstLoginAt: now,
      lastLoginAt: now,
      email: data?.email,
      successfulLoginCount: 1,
      adminRights: DEFAULT_ADMIN_RIGHTS,
      restrictions: {
        reportMedia: false,
        createParties: false,
        uploadMedia: false,
        commentMedia: false,
        participateInParties: false,
        login: false,
      },
    });
  }
  return await increaseLoginCount(user);
};

const loginWithGoogle = async (user, data) => {
  const now = new Date();
  if (!user) {
    if (data.email) {
      const userWithEmail = await getByOneAttribute("email", data.email);
      if (userWithEmail) {
        throw papeoError(PAPEO_ERRORS.REGISTERED_WITH_DIFFERENT_AUTHPLATFORM);
      }
    }
    return await create({
      authPlatforms: [
        {
          method: "google",
          externalUserId: data.sub,
        },
      ],
      firstLogin: true,
      firstLoginAt: now,
      lastLoginAt: now,
      email: data?.email,
      successfulLoginCount: 1,
      adminRights: DEFAULT_ADMIN_RIGHTS,
      restrictions: {
        reportMedia: false,
        createParties: false,
        uploadMedia: false,
        commentMedia: false,
        participateInParties: false,
        login: false,
      },
    });
  }
  return await increaseLoginCount(user);
};

const getLoginInformation = async (user, fcmToken, platform) => {
  const token = createJWToken(user);
  await removeFcmTokenIfItsExistsOnAnotherUser(fcmToken);

  await patch(user._id, {
    $push: {
      tokens: {
        fcmToken,
        platform,
        accessToken: token,
      },
    },
  });

  return {
    jwt: token,
    firebaseJwt: await generateFirebaseJWT(user._id),
    userId: user._id,
    firstLogin: user.firstLogin,
    successfulLoginCount: user.successfulLoginCount,
  };
};

const getLoginInformationForAdminAccess = async (user, adminUser) => {
  if (!this.hasAdminRightsTo(adminUser, this.adminRights.loginAsUser)) {
    throw new Forbidden();
  }
  const token = createTemporaryJWToken(user);
  return {
    jwt: token,
    userId: user._id,
    firstLogin: user.firstLogin,
    successfulLoginCount: user.successfulLoginCount,
  };
};
exports.getLoginInformationForAdminAccess = getLoginInformationForAdminAccess;

const getLoginInformationForAdminAccessWithoutRightsCheck = async (user) => {
  const token = createTemporaryJWToken(user);
  return {
    jwt: token,
    userId: user._id,
    firstLogin: user.firstLogin,
    successfulLoginCount: user.successfulLoginCount,
  };
};
exports.getLoginInformationForAdminAccessWithoutRightsCheck =
  getLoginInformationForAdminAccessWithoutRightsCheck;

const createJWToken = (user) => {
  const token = jwt.sign(
    {
      userId: user._id,
      iat: Date.now(),
    },
    process.env.JWT_SIGNING_SECRET
  );
  return token;
};
const createTemporaryJWToken = (user) => {
  const token = jwt.sign(
    {
      userId: user._id,
      //iat: Date.now(), // Date.now() gibt Zeit in ms zurueck, aber laut jwt standard werden sekunden benoetigt
      // expiresIn option setzt automatisch iat auf einen timestamp in sekunden und berechnet exp
    },
    process.env.JWT_SIGNING_SECRET,
    {
      expiresIn: "24h",
    }
  );
  return token;
};

const increaseLoginCount = async (user) => {
  const now = new Date();
  if (user.locked) throw papeoError(PAPEO_ERRORS.USER_IS_BLOCKED);
  return await patch(user._id, {
    firstLogin: false,
    lastLoginAt: now,
    failedLoginAttempts: 0,
    $inc: {
      successfulLoginCount: 1,
    },
  });
};

const updateLastActivity = async (userId) => {
  const now = new Date();
  return await patch(userId, {
    lastActivityAt: now,
  });
};

/**
 *
 * @param {*} userId user id from the user who send the friend request
 * @param {*} newFriendId
 */
const requestFriendship = async (userId, newFriendId) => {
  if (userId.toString() === newFriendId.toString()) {
    throw papeoError(PAPEO_ERRORS.YOU_CANNOT_FRIEND_REQUEST_YOURSELF);
  }

  const me = await getRaw(userId);
  // check if already friends
  const alreadyFriends = me.partyFriends.find(
    (f) => f.friend.toString() === newFriendId
  );
  if (alreadyFriends) {
    // Edgecase: if a user has already received a friend request but wants to send a friend request to that user
    if (alreadyFriends.status === "requested") {
      return await acceptFriendship(userId, newFriendId);
    }
    throw papeoError(PAPEO_ERRORS.ALREADY_FRIENDS);
  }
  const [res1, res2] = await Promise.all([
    patch(userId, {
      $push: {
        partyFriends: {
          friend: newFriendId,
          status: "requested_by_me",
        },
      },
    }),
    patch(newFriendId, {
      $push: {
        partyFriends: {
          friend: userId,
          status: "requested",
        },
      },
    }),
  ]);
  await Activity.create({
    notificationCategories: ["friends"],
    user: newFriendId,
    type: "newFriendRequest",
    otherUsers: [userId],
    sendNotification: true,
  });
  return res1.partyFriends;
};

const removeFriend = async (userId, friendId) => {
  const user = await get(userId);
  if (
    user.partyFriends &&
    !user.partyFriends
      .map((friend) => friend.friend.toString())
      .includes(friendId.toString())
  ) {
    throw papeoError(PAPEO_ERRORS.USER_IS_NOT_IN_YOUR_FRIEND_LIST);
  }
  await Promise.all([
    patch(userId, {
      $pull: {
        partyFriends: { friend: mongoose.Types.ObjectId(friendId) },
      },
    }),
    patch(friendId, {
      $pull: {
        partyFriends: { friend: userId },
      },
    }),
  ]);
  return { user: userId, friend: friendId };
};

const acceptFriendship = async (userId, newFriendId) => {
  if (userId.toString() === newFriendId.toString()) {
    throw papeoError(PAPEO_ERRORS.YOU_CANNOT_FRIEND_REQUEST_YOURSELF);
  }
  const me = await getRaw(userId);
  const isThereAFriendRequest = me.partyFriends.find(
    (f) => f.friend.toString() === newFriendId && f.status === "requested"
  );
  if (!isThereAFriendRequest) {
    throw papeoError(PAPEO_ERRORS.THERE_IS_NO_SUCH_FRIEND_REQUEST);
  }
  await removeFriend(userId, newFriendId);
  const [res1, res2] = await Promise.all([
    patch(userId, {
      $push: {
        partyFriends: {
          friend: newFriendId,
          status: "accepted",
        },
      },
    }),
    patch(newFriendId, {
      $push: {
        partyFriends: {
          friend: userId,
          status: "accepted",
        },
      },
    }),
  ]);

  await Activity.create({
    notificationCategories: ["friends"],
    user: newFriendId,
    type: "friendRequestAccepted",
    otherUsers: [userId],
    sendNotification: true,
  });

  return res1.partyFriends;
};

const addFollower = async (userId, userIdToFollow) => {
  if (userId.toString() === userIdToFollow.toString()) {
    throw papeoError(PAPEO_ERRORS.YOU_CANNOT_FOLLOW_YOURSELF);
  }
  const followers = await Follower.find({
    query: {
      user: userId,
      followedUser: userIdToFollow,
    },
  });
  const alreadyFollowed = followers.data.length > 0;
  if (alreadyFollowed) {
    throw papeoError(PAPEO_ERRORS.ALREADY_FOLLOWING_THIS_USER);
  }
  let followedUser = await Follower.create({
    user: userId,
    followedUser: userIdToFollow,
  });

  await Activity.create({
    notificationCategories: ["followers"],
    user: followedUser.followedUser,
    type: "newFollower",
    otherUsers: [followedUser.user],
    sendNotification: true,
  });

  return followedUser;
};

/**
 *
 * @param {*} userId
 * @param {*} otherUserId
 * @returns true if otherUser follows user
 */
const isUserFollowedBy = async (userId, otherUserId) => {
  const followers = await Follower.find({
    query: {
      user: otherUserId,
      followedUser: userId,
    },
  });
  return followers.data.length > 0 ? followers.data[0] : null;
};
exports.isUserFollowedBy = isUserFollowedBy;

const unfollowUser = async (userId, followerId) => {
  const followedUser = await isUserFollowedBy(userId, followerId);
  if (!followedUser) {
    throw papeoError(PAPEO_ERRORS.YOU_ARE_NOT_FOLLOWING_THIS_USER);
  }

  let removedFollower = await Follower.remove(followedUser._id);

  await Activity.create({
    notificationCategories: ["followers"],
    user: followedUser.followedUser,
    type: "followerRemoved",
    otherUsers: [followedUser.user],
    sendNotification: true,
  });

  return removedFollower;
};

const calculateAge = (birthday) => {
  const age = new Date(Date.now() - new Date(birthday).getTime());
  return Math.abs(age.getUTCFullYear() - 1970);
};
exports.calculateAge = calculateAge;
const recalculateRating = async (id) => {
  const { avg, count } = await Rating.getAverageUserRating(id);
  const result = await patch(id, {
    rating: {
      avg,
      count,
    },
  });
  return result;
};

const rights = {
  canManageParty: "canManageParty",
  canManageGuestlist: "canManageGuestlist",
  canManagePartyPhotos: "canManagePartyPhotos",
  canBroadcastMessages: "canBroadcastMessages",
  canSeeAdminHistory: "canSeeAdminHistory",
};
exports.rights = rights;
const hasRightsTo = (user, party, right) => {
  const myPartyAdminObject = party.admins.find(
    (pa) => pa.user.toString() === user._id.toString()
  );
  let result = myPartyAdminObject && myPartyAdminObject.rights[right];
  const ownerId = party.owner._id
    ? party.owner._id.toString()
    : party.owner.toString();
  const iAmThePartyOwner = ownerId === user._id.toString();
  if (iAmThePartyOwner) result = true;
  return result;
};
exports.hasRightsTo = hasRightsTo;

const staffRights = {
  canScanTickets: "canScanTickets",
  canScanOrders: "canScanOrders",
};
exports.staffRights = staffRights;
const hasStaffRightsTo = (user, party, right) => {
  const myPartyStaffObject = party.staff?.find(
    (pa) => pa.user.toString() === user._id.toString()
  );
  let result = myPartyStaffObject && myPartyStaffObject.rights[right];
  const ownerId = party.owner._id
    ? party.owner._id.toString()
    : party.owner.toString();
  const iAmThePartyOwner = ownerId === user._id.toString();
  if (iAmThePartyOwner) result = true;
  return result;
};
exports.hasStaffRightsTo = hasStaffRightsTo;
const adminRights = {
  manageUserProfiles: "manageUserProfiles",
  manageUserLinks: "manageUserLinks",
  muteUser: "muteUser",
  lockUser: "lockUser",
  advancedMemberSearch: "advancedMemberSearch",
  deleteRating: "deleteRating",
  deleteUserFinally: "deleteUserFinally",
  manageMedia: "manageMedia",
  manageComments: "manageComments",
  manageParties: "manageParties",
  inviteGuestsToParties: "inviteGuestsToParties",
  managePartyPoints: "managePartyPoints",
  manageMembership: "manageMembership",
  editTranslation: "editTranslation",
  changeTC: "changeTC",
  manageMainMenu: "manageMainMenu",
  rateVideoIdent: "rateVideoIdent",
  manageViolationReports: "manageViolationReports",
  viewStatistics: "viewStatistics",
  viewAdminLog: "viewAdminLog",
  manageAdmins: "manageAdmins",
  manageCompetitions: "manageCompetitions",
  canSeeSecretParties: "canSeeSecretParties",
  loginAsUser: "loginAsUser",
  enablePayouts: "enablePayouts",
  payoutPayouts: "payoutPayouts",
  editNewsletter: "editNewsletter",
  createNewsletter: "createNewsletter",
  createUserProfiles: "createUserProfiles",
};
exports.adminRights = adminRights;
const hasAdminRightsTo = (user, right) => {
  if (!user.isAdmin) return false;
  let result = user.adminRights[right];
  if (user.isSuperAdmin) result = true;
  return result;
};
exports.hasAdminRightsTo = hasAdminRightsTo;
const blockUser = async (userId, blockedUserId) => {
  await patch(blockedUserId, {
    $addToSet: {
      blockedByUsers: userId,
    },
  });
  const result = await patch(userId, {
    $addToSet: {
      blockedUsers: blockedUserId,
    },
  });
  // TODO Refactoring
  const user = await getRaw(userId);
  const blockedUser = await getRaw(blockedUserId);
  await patchFirebaseUser(userId, {
    blockedUsers: user.blockedUsers
      ? user.blockedUsers.map((bu) => bu.toString())
      : [],
  });
  await patchFirebaseUser(blockedUserId, {
    blockedByUsers: user.blockedByUsers
      ? blockedUser.blockedByUsers.map((bu) => bu.toString())
      : [],
  });
  const partiesFromBlockingUser =
    (await Party.MODEL.find({ owner: userId })) || [];
  const partiesFromBlockedUser =
    (await Party.MODEL.find({ owner: blockedUserId })) || [];

  // deleting party guests
  await PartyGuest.MODEL.deleteMany({
    party: { $in: partiesFromBlockingUser.map((p) => p._id) },
    user: blockedUserId,
  });
  await PartyGuest.MODEL.deleteMany({
    party: { $in: partiesFromBlockedUser.map((p) => p._id) },
    user: userId,
  });

  // deleting followers
  await Follower.MODEL.deleteOne({
    user: userId,
    followedUser: blockedUserId,
  });
  await Follower.MODEL.deleteOne({
    user: blockedUserId,
    followedUser: userId,
  });
  // deleting party admins
  await Party.MODEL.updateMany(
    {
      _id: { $in: partiesFromBlockingUser.map((p) => p._id) },
    },
    {
      $pull: {
        admins: { user: blockedUserId },
      },
    }
  );
  await Party.MODEL.updateMany(
    {
      _id: { $in: partiesFromBlockedUser.map((p) => p._id) },
    },
    {
      $pull: {
        admins: { user: userId },
      },
    }
  );
  // deleting party friends
  try {
    await removeFriend(userId, blockedUserId);
  } catch (e) {}

  return result;
};
exports.blockUser = blockUser;

const unblockUser = async (userId, blockedUserId) => {
  await patch(blockedUserId, {
    $pull: {
      blockedByUsers: userId,
    },
  });
  const result = await patch(userId, {
    $pull: {
      blockedUsers: blockedUserId,
    },
  });
  // TODO Refactoring
  const user = await getRaw(userId);
  const blockedUser = await getRaw(blockedUserId);
  await patchFirebaseUser(userId, {
    blockedUsers: user.blockedUsers
      ? user.blockedUsers.map((bu) => bu.toString())
      : [],
  });
  await patchFirebaseUser(blockedUserId, {
    blockedByUsers: user.blockedByUsers
      ? blockedUser.blockedByUsers.map((bu) => bu.toString())
      : [],
  });
  return result;
};
exports.unblockUser = unblockUser;

const isBlockedBy = (user, userId) => {
  return user.blockedByUsers
    .map((u) => u.toString())
    .includes(userId.toString());
};
exports.isBlockedBy = isBlockedBy;

const isBlocking = (user, userId) => {
  return user.blockedUsers.map((u) => u.toString()).includes(userId.toString());
};
exports.isBlocking = isBlocking;

const isBlockedByOrBlocking = (user, userId) => {
  return isBlockedBy(user, userId) || isBlocking(user, userId);
};
exports.isBlockedByOrBlocking = isBlockedByOrBlocking;

const getFriendIdsFromUserObject = (user) => {
  return user.partyFriends
    .filter((pf) => pf.status === "accepted")
    .map((pf) => pf.friend);
};
exports.getFriendIdsFromUserObject = getFriendIdsFromUserObject;

exports.createStripeCustomerIfNotExists = async (user) => {
  if (process.env.TEST) return "example.com";
  if (user.stripeCustomerId) {
    return await stripeTicketing.getStripeCustomer(user.stripeCustomerId);
  }
  const customer = await stripeTicketing.createStripeCustomer({
    id: user._id.toString(),
    name: user.username,
  });
  await patch(user._id, {
    stripeCustomerId: user._id.toString(),
  });
  return customer;
};
/*
const calculateDistanceBetweenUsers = async (user1, user2) => {
  const start = {
    latitude: user1.currentLocation.coordinates[1],
    longitude: user1.currentLocation.coordinates[0],
  };

  const end = {
    latitude: user2.currentLocation.coordinates[1],
    longitude: user2.currentLocation.coordinates[0],
  };

  const distance = haversine(start, end);
  console.log({ distance });
  return distance;
};
exports.calculateDistanceBetweenUsers = calculateDistanceBetweenUsers;
*/
const filterOwnUser = (user) => {
  return { ...user, tokens: undefined };
};

exports.verification = verificationModule;
exports.membership = membershipModule;
exports.referral = referralModule;
exports.get = get;
exports.getRaw = getRaw;
exports.find = find;
exports.create = create;
exports.createRaw = createRaw;
exports.patch = patch;
exports.remove = remove;
exports.exists = exists;
exports.getByOneAttribute = getByOneAttribute;
exports.getByOneAttributeRaw = getByOneAttributeRaw;
exports.alreadyInUseByOtherUser = alreadyInUseByOtherUser;
exports.replaceProfilePictureUpload = replaceProfilePictureUpload;
exports.removeProfilePicture = removeProfilePicture;
exports.removeVerificationUpload = removeVerificationUpload;
exports.patchApple = patchApple;
exports.loginWithPhoneNumber = loginWithPhoneNumber;
exports.loginWithApple = loginWithApple;
exports.loginWithGoogle = loginWithGoogle;
exports.getLoginInformation = getLoginInformation;
exports.createJWToken = createJWToken;
exports.updateLastActivity = updateLastActivity;
exports.requestFriendship = requestFriendship;
exports.removeFriend = removeFriend;
exports.acceptFriendship = acceptFriendship;
exports.addFollower = addFollower;
exports.unfollowUser = unfollowUser;
exports.recalculateRating = recalculateRating;
exports.filterOwnUser = filterOwnUser;

// FIND INCONSISTENT DATA
/*
(() => {
  setTimeout(async () => {
    console.log("FIND FRIENDS WHICH ARE NOT EXISTING");
    const users = await options.Model.find({}, [
      "+adminRights currentLocation.coordinates",
    ]).lean();
    const userIds = {};
    for (const user of users) {
      userIds[user._id.toString()] = true;
    }
    const friendUserIds = {};
    for (const user of users) {
      for (const friend of user.partyFriends) {
        friendUserIds[friend.friend.toString()] = true;
        if (!userIds[friend.friend.toString()]) {
          console.log(
            "Friend does not exist:",
            friend.friend.toString(),
            "on user:",
            user._id.toString(),
            "(",
            user.username.toString(),
            ")"
          );
        }
      }
    }
    function isIterable(obj) {
      // checks for null and undefined
      if (obj == null) {
        return false;
      }
      return typeof obj[Symbol.iterator] === "function";
    }
    const blockedUserIds = {};
    for (const user of users) {
      for (const blockedUser of user.blockedUsers || []) {
        blockedUserIds[blockedUser.toString()] = true;
        if (!userIds[blockedUser.toString()]) {
          console.log(
            "Blocked user does not exist:",
            blockedUser.toString(),
            "on user:",
            user._id.toString(),
            "(",
            user.username.toString(),
            ")"
          );
        }
      }
    }
    const blockedByUserIds = {};
    for (const user of users) {
      for (const blockedUser of user.blockedByUsers || []) {
        blockedByUserIds[blockedUser.toString()] = true;
        if (!userIds[blockedUser.toString()]) {
          console.log(
            "Blocked user does not exist:",
            blockedUser.toString(),
            "on user:",
            user._id.toString(),
            "(",
            user.username.toString(),
            ")"
          );
        }
      }
    }

    console.log("CHECKING FOR PARTYGUEST ENTRIES WITH NOT EXISTING PARTY");
    const partyIds = {};
    const partyGuests = await PartyGuest.MODEL.find({});
    const parties = await Party.MODEL.find({});

    for (const partyguest of partyGuests) {
      partyIds[partyguest.party.toString()] = true;
    }
    Object.keys(partyIds).forEach(async (partyId) => {
      if (!parties.find((p) => p._id.toString() === partyId)) {
        console.log("Party does not exist:", partyId);
        //await PartyGuest.removeManyByPartyId(partyId);
      }
    });
    console.log("SCAN FINISHED");
  }, 1500);
})();
*/
//

/*
(() => {
  setTimeout(async () => {
    console.log("Firebase isPartyKing and isArtist Migration");
    const users = await options.Model.find({}, [
      "+adminRights currentLocation.coordinates",
    ]).lean();
    const userIds = {};
    for (const user of users) {
      userIds[user._id.toString()] = true;
    }
    let cond = true;
    console.log("usercount:", users.length);
    let i = 0;
    for (const user of users) {
      i++;
      if (cond) {
        console.log(user._id, user.isPartyKing, user.isArtist, user.username);
        try {
          await patch(user._id, {
            isPartyKing: user.isPartyKing || false,
            isArtist: user.isArtist || false,
          });
        } catch (e) {
          console.log(
            "ERROR: ",
            user._id,
            user.isPartyKing,
            user.isArtist,
            user.username
          );
        }
      }
    }
  }, 1500);
})();
*/
/*
// add referralcode to all users
(() => {
  setTimeout(async () => {
    console.log("add referralcode to all users");
    const users = await options.Model.find({}, [
      "+adminRights currentLocation.coordinates",
    ]).lean();

    for (const user of users) {
      const referralCode = (
        await referralModule.addRandomReferralCodeToUser(user._id)
      ).referralCodes[0];
      console.log(
        `Added referralcode: ${referralCode} to user: ${user.username} (${user._id})`
      );
    }
  }, 1500);
})();

*/
/*
(() => {
  setTimeout(async () => {
    const id = "6130f9a242554c10893df771";
    console.log(
      await options.Model.updateMany(
        { blockedUsers: id },
        { $pull: { blockedUsers: id } }
      )
    );
  }, 1500);
})();
*/

// REFERRAL TREE MIGRATION
/*
(() => {
  setTimeout(async () => {
    console.log("REFERRAL ");
    //const users = await options.Model.find({}).lean();
    const users = await options.Model.find({}).lean();
    const referredUsers = users.filter((u) => u.referredBy);
    const pairs = [];
    for (const referredUser of referredUsers) {
      const referrer = await options.Model.findOne({
        "referralCodes.code": referredUser.referredBy,
      });
      if(!referrer) console.log(`no referrer found with code: ${referredUser.referredBy}`);
      if (referrer) {
        try {
          console.log(referredUser._id, referrer._id);
          pairs.push([referredUser._id.toString(), referrer._id.toString()]);
          await ReferralTree.createReferralTreeEntry(
            referredUser,
            referrer,
            new Date()
          );
          
        } catch (error) {
          console.log(error);
        }
      } else {
        console.log(
          `no referrer found with referralCode: ${referredUser.referredBy}`
        );
      }
    }
    console.log("cross referrals:");
    for (const pair of pairs) {
      if(pairs.find(x=>x[1]=== pair[0] && x[0]=== pair[1])) console.log(pair);
    }
    console.log("SCAN FINISHED");
  }, 1500);
})();
*/
/*
(() => {
  setTimeout(async () => {
    console.log("REFERRAL TREE CHECKING FOR INCONSISTEND DATA");
    const users = await options.Model.find({}).lean();
    const referredUsers = users.filter((u) => u.referredBy);
    for (const referredUser of referredUsers) {
      const referralTreeEntry = await ReferralTree.MODEL.find({
        _id: referredUser._id,
      });
      if (referralTreeEntry.length === 0) {
        console.log(
          `User ${referredUser.username} (${referredUser._id}) has the referredBy attribute set to "${referredUser.referredBy}" but has no referralTree entry`
        );
      }
    }
    console.log("SCAN FINISHED");
  }, 1500);
})();
*/
/*(() => {
  setTimeout(async () => {
    console.log("userlist");
    const users = await options.Model.find({}).lean();
    console.log(JSON.stringify(users.map((u) => u._id.toString())));
    console.log("SCAN FINISHED");
  }, 1500);
})();
*/
