const User = require("../../../users/usersService");
const Party = require("../../../parties/partiesService");
const Follower = require("../../../followers/followersService");
const PartyGuest = require("../../../partyGuests/partyGuestsService");
const MyPartyGuests = require("../../../myPartyGuests/myPartyGuestsService");
const Invite = require("../../invitesService");
const {
  getPartyPointsConfig,
} = require("../../../configuration/configurationsService");
const helpers = require("./helpers");
const mongoose = require("mongoose");
exports.search = async (user, query) => {
  console.log(user._id);
  //#region QUERY PARSING
  let SKIP = 0;
  let LIMIT = 10;
  if (!query.party) throw new Error("partyId is required");
  const PARTY_ID = mongoose.Types.ObjectId(query.party);
  if (query.$skip) SKIP = parseInt(query.$skip);
  if (query.$limit) LIMIT = parseInt(query.$limit);
  const LAT = parseFloat(query.lat);
  const LONG = parseFloat(query.long);
  const DISTANCE_FROM = query.distance_from
    ? parseInt(query.distance_from * 1000)
    : 0;
  const DISTANCE_TO = query.distance_to
    ? parseInt(query.distance_to * 1000)
    : 0;

  //#endregion

  const [
    MY_PARTY_FRIENDS,
    MY_FOLLOWERS,
    MY_FOLLOWED_USERS,
    MY_PARTY_GUESTS,
    PARTY_ALL_PARTY_GUESTS,
    PARTY_POINTS_CONFIG,
  ] = await Promise.all([
    User.getFriendIdsFromUserObject(user),
    await Follower.getFollowedUserIdsForAUser(user._id),
    await Follower.getFollowerIdsForAUser(user._id),
    await MyPartyGuests.getMyPartyGuestIsDeletedFalseIds(user._id),
    await PartyGuest.getAnyPartyGuestsIdsByParty(PARTY_ID),
    await getPartyPointsConfig(),
  ]);

  const PIPELINE = [];
  const FILTER_AND_CONDITIONS = [];
  if (query.sex) {
    FILTER_AND_CONDITIONS.push({ sex: { $in: query.sex } });
  }
  if (query.age_from) {
    const age = parseInt(query.age_from);
    const birthday = new Date();
    birthday.setFullYear(birthday.getFullYear() - age);
    FILTER_AND_CONDITIONS.push({
      birthday: { $lte: birthday },
    });
  }
  if (query.age_to) {
    const age = parseInt(query.age_to);
    const birthday = new Date();
    birthday.setFullYear(birthday.getFullYear() - age);
    FILTER_AND_CONDITIONS.push({
      birthday: { $gte: birthday },
    });
  }
  if (query.last_activity_at) {
    const lastActivity = new Date(query.last_activity_at);
    FILTER_AND_CONDITIONS.push({
      lastActivityAt: { $gte: lastActivity },
    });
  }
  if (query.is_authenticated === "true") {
    FILTER_AND_CONDITIONS.push({
      "verification.verified": true,
    });
  }
  if (query.is_party_king === "true") {
    FILTER_AND_CONDITIONS.push({
      isPartyKing: true,
    });
  }
  if (query.is_artist === "true") {
    FILTER_AND_CONDITIONS.push({
      isArtist: true,
    });
  }
  if (query.text_search) {
    FILTER_AND_CONDITIONS.push({
      usernameLowercase: new RegExp(query.text_search.toLowerCase(), "i"),
    });
  }
  FILTER_AND_CONDITIONS.push({
    $and: [{ username: { $exists: true } }, { username: { $ne: null } }],

    locked: { $eq: false },
    _id: {
      $nin: [
        user._id,
        ...PARTY_ALL_PARTY_GUESTS,
        ...user.blockedUsers,
        ...user.blockedByUsers,
      ],
    },
  });
  PIPELINE.push(
    helpers.geoNear({
      lat: LAT,
      long: LONG,
      distanceFromMeters: DISTANCE_FROM,
      distanceToMeters: DISTANCE_TO,
    })
  );
  if (FILTER_AND_CONDITIONS.length > 0) {
    PIPELINE.push({
      $match: {
        $and: FILTER_AND_CONDITIONS,
      },
    });
  }

  PIPELINE.push(
    ...helpers.calculateRelationship({
      myPartyFriends: MY_PARTY_FRIENDS,
      myFollowers: MY_FOLLOWERS,
      myFollowedUsers: MY_FOLLOWED_USERS,
      myPartyGuests: MY_PARTY_GUESTS,
    })
  );
  if (query.include) {
    const includeOrArray = [];
    if (query.include.includes("friends")) {
      includeOrArray.push({ "relationship.partyFriends": true });
    }
    if (query.include.includes("following")) {
      includeOrArray.push({ "relationship.followers": true });
    }
    if (query.include.includes("following_me")) {
      includeOrArray.push({ "relationship.followingMe": true });
    }
    if (query.include.includes("my_party_guests")) {
      includeOrArray.push({ "relationship.myPartyGuests": true });
    }
    if (query.include.includes("others")) {
      includeOrArray.push({ "relationship.others": true });
    }
    PIPELINE.push({
      $match: {
        $or: includeOrArray,
      },
    });
  }

  PIPELINE.push(helpers.filterBySettings());
  PIPELINE.push(helpers.selectFields());
  PIPELINE.push(helpers.sort());
  PIPELINE.push(helpers.paginate(SKIP, LIMIT));
  /*console.log({
    MY_PARTY_FRIENDS,
    MY_FOLLOWERS,
    MY_FOLLOWED_USERS,
    MY_PARTY_GUESTS,
  });*/
  console.log(JSON.stringify(PIPELINE));
  const result = helpers.transformPipelineResult(
    await User.MODEL.aggregate(PIPELINE),
    SKIP,
    LIMIT
  );

  // calculate invitationCost; round distance to full km
  result.data = result.data.map((u) => {
    return {
      ...u,
      distance: Math.round(u.distance),
      invitationCost: Invite.calculateInvitationCostWithRelationShip({
        isInvitingUserPartyKing: user.isPartyKing,
        relationship: u.relationship,
        partyPointsConfig: PARTY_POINTS_CONFIG,
      }),
    };
  });
  return result;
};
