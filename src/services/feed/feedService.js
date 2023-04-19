const service = require("feathers-mongoose");
const Model = require("../../models/partyGuests.model.js");
const Party = require("../parties/partiesService.js");
const PartyGuest = require("../partyGuests/partyGuestsService");
const Bookmark = require("../bookmarks/bookmarksService");
const User = require("../users/usersService.js");
const Upload = require("../uploads/uploadsService");
const Follower = require("../followers/followersService.js");
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../../modules/errors/errors.js").papeoError;
const mongoose = require("mongoose");
const MAX_PARTY_DISTANCE_KM = 800;
const MAX_USER_DISTANCE_KM = 800;
const USER_EVERY_X_PARTIES = 10;

const getUnauthenticatedFeed = async (lat, long, excludeIds) => {
  const unauthenticatedUser = {
    _id: "000000000000000000000000",
    currentLocation: {
      coordinates: [long, lat],
    },
    partyFriends: [],
  };
  const parties = await getPartyFeed(unauthenticatedUser, 50, excludeIds);
  return parties;
};
exports.getUnauthenticatedFeed = getUnauthenticatedFeed;

const getFeed = async (user, excludeIds) => {
  const parties = await getPartyFeed(user, 50, excludeIds);
  const users = await getUserFeed(user, 5, excludeIds);
  const result = [];

  while (parties.length !== 0 || users.length !== 0) {
    result.push(...parties.splice(0, USER_EVERY_X_PARTIES));
    result.push(...users.splice(0, 1));
  }
  return result;
};

const getLocation = (user) => {
  if (user.currentLocation.coordinates.length == 2) {
    return user.currentLocation.coordinates;
  }
  if (user.homeLocation.coordinates.length == 2) {
    return user.homeLocation.coordinates;
  }
  return false;
};
const getUserFeed = async (user, limit = 100, excludeIds = []) => {
  const location = getLocation(user);
  if (!location || location.length === 0) {
    throw papeoError(PAPEO_ERRORS.LOCATION_MUST_BE_SET_FOR_FEED);
  }
  let users = await User.MODEL.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: location,
        },
        key: "currentLocation.coordinates",
        maxDistance: MAX_USER_DISTANCE_KM * 1000,
        spherical: true,
        distanceField: "distance",
        distanceMultiplier: 1 / 1000,
      },
    },
    {
      $match: {
        $and: [
          { username: { $ne: null } },
          // filter out own user
          { _id: { $ne: user._id } },
          // filter out friends or users with a friend request
          { _id: { $nin: user.partyFriends.map((f) => f.friend) } },
          { locked: { $eq: false } },
          { username: { $exists: true } },
          // filter out all ids from arguments
          {
            _id: { $nin: excludeIds.map((id) => mongoose.Types.ObjectId(id)) },
          },
        ],
      },
    },
    {
      // join swipes for that user to the party
      $lookup: {
        from: "swipes",
        as: "swipes",
        let: {
          userId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", user._id] },
                  { $eq: ["$swipedUser", "$$userId"] },
                ],
              },
            },
          },
        ],
      },
    },
    {
      $match: {
        $and: [{ swipes: { $exists: true, $eq: [] } }],
      },
    },
    {
      // join followed users for that user to the party
      $lookup: {
        from: "followers",
        as: "followers",
        let: {
          userId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", user._id] },
                  { $eq: ["$followedUser", "$$userId"] },
                ],
              },
            },
          },
        ],
      },
    },
    {
      $match: {
        $and: [{ followers: { $exists: true, $eq: [] } }],
      },
    },
    { $sort: { lastActivityAt: -1, distance: 1 } },
    { $limit: limit },
  ]);
  users = await Promise.all(
    users.map(async (u) => {
      const partyFriends = u.partyFriends.filter(
        (pf) => pf.status === "accepted"
      );
      const sharedPartyFriends = partyFriends.filter((otherUsersPF) =>
        user.partyFriends
          .filter((pf) => pf.status === "accepted")
          .map((pf) => pf.friend.toString())
          .includes(otherUsersPF.friend.toString())
      );
      const follower = await Follower.getFollowedUserIdsForAUser(u._id);
      const friendsWhoFollowThisUser = user.partyFriends
        .filter((pf) => pf.status === "accepted")
        .filter((myFriend) =>
          follower.map((f) => f.toString()).includes(myFriend.friend.toString())
        );
      console.log({ partyFriends, sharedPartyFriends, follower });
      return {
        ...u,
        distance: u.distance ? Math.round(u.distance) : undefined,
        partyFriendsCount: partyFriends.length,
        sharedPartyFriends,
        sharedPartyFriendsCount: sharedPartyFriends.length,
        followerCount: follower.length,
        friendsWhoFollowThisUser,
      };
    })
  );
  return users.map(filterUser).map((u) => ({ type: "user", data: u }));
};

const getPartyFeed = async (user, limit = 100, excludeIds = []) => {
  const location = getLocation(user);
  if (!location || location.length === 0) {
    throw papeoError(PAPEO_ERRORS.LOCATION_MUST_BE_SET_FOR_FEED);
  }
  const followedUsers = (
    await Follower.find({
      query: {
        user: user._id.toString(),
      },
    })
  ).data;
  let parties = await Party.MODEL.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: location,
        },
        maxDistance: MAX_PARTY_DISTANCE_KM * 1000,
        spherical: true,
        distanceField: "distance",
        distanceMultiplier: 1 / 1000,
      },
    },
    {
      $match: {
        $and: [
          // filter out own parties
          { owner: { $ne: user._id } },
          { privacyLevel: { $ne: "secret" } },
          // filter out parties that already started
          { startDate: { $gte: new Date() } },
          { status: "published" },
        ],
      },
    },
    {
      // join bookmarks for that user to the party
      $lookup: {
        from: "bookmarks",
        as: "bookmarks",
        let: {
          partyId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", user._id] },
                  { $eq: ["$party", "$$partyId"] },
                ],
              },
            },
          },
        ],
      },
    },
    {
      $match: {
        $and: [{ bookmarks: { $exists: true, $eq: [] } }],
      },
    },
    {
      // join swipes for that user to the party
      $lookup: {
        from: "swipes",
        as: "swipes",
        let: {
          partyId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", user._id] },
                  { $eq: ["$swipedParty", "$$partyId"] },
                ],
              },
            },
          },
        ],
      },
    },
    {
      // join bookmarks for that user to the party
      $lookup: {
        from: "partyguests",
        as: "partyguests",
        let: {
          partyId: "$_id",
          attending: "attending",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$status", "attending"] },
                  { $eq: ["$party", "$$partyId"] },
                ],
              },
            },
          },
        ],
      },
    },
    {
      // join owner for that party to the party
      $lookup: {
        from: "users",

        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    { $unwind: "$owner" },
    {
      $set: {
        userIsPartyGuest: {
          $cond: {
            if: { $in: [user._id, "$partyguests.user"] },
            then: true,
            else: false,
          },
        },
        isPartyFromFriend: {
          $cond: {
            if: {
              $in: ["$owner", user.partyFriends.map((f) => f.friend)],
            },
            then: true,
            else: false,
          },
        },
        isPartyFromFollowedUser: {
          $cond: {
            if: { $in: ["$owner", followedUsers.map((f) => f.followedUser)] },
            then: true,
            else: false,
          },
        },
        isFull: {
          $cond: {
            if: { $gte: [{ $size: "$partyguests" }, "$capacity"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $match: {
        $and: [
          { swipes: { $exists: true, $eq: [] } },
          { bookmarks: { $exists: true, $eq: [] } },

          // filter out full parties
          { isFull: false },
          // filter out parties that the user is guest of (status "attending", "requested", "declined" )
          { userIsPartyGuest: false },
          // filter out all ids from arguments
          {
            _id: { $nin: excludeIds.map((id) => mongoose.Types.ObjectId(id)) },
          },
        ],
      },
    },
    {
      $sort: {
        isPartyFromFriend: -1,
        isPartyFromFollowedUser: -1,
        startDate: 1,
        distance: 1,
      },
    },
    { $limit: limit },
  ]);
  parties = (
    await Promise.allSettled(
      parties.map(async (p) => {
        const friendsAttendingThisParty =
          await PartyGuest.getFriendsAttendingThisParty(user, p._id);
        return {
          ...p,
          distance: p.distance ? Math.round(p.distance) : undefined,
          uploads: (await Promise.allSettled(
            p.uploads.map((u) => Upload.get(u))
          )).filter((upload) => upload.status === "fulfilled")
          .map((u) => u.value),
          // TODO check for not existing uploads
          ...(await Party.getCounts(user, p)),
        };
      })
    )
  ) // TODO check for not existing parties
    .filter((upload) => upload.status === "fulfilled")
    .map((u) => u.value);
  return parties.map(filterParty).map((p) => ({ type: "party", data: p }));
};

const filterEntity = (entity, ...attributes) => {
  const newEntity = { ...entity };
  Object.keys(entity).forEach((key) => {
    if (attributes.includes(key)) delete newEntity[key];
  });
  return newEntity;
};

const filterUser = (user) => {
  const result = filterEntity(
    user,
    "phoneNumber",
    //"birthday",
    "currentLocation",
    "homeLocation",
    "email",
    "tokens",
    "authPlatforms",
    "swipes",
    "followers",
    "settings",
    "partyPoints",
    "settings",
    "restrictions",
    "adminRights",
    "blockedUsers",
    "blockedByUsers",
    "subscription",
    "homeAddress",
    "stripeCustomerId",
    "reports"
  );
  return result;
};

const filterParty = (party) => {
  const result = filterEntity(party, "swipes", "bookmarks");
  result.owner = filterUser(party.owner);
  return result;
};

exports.getFeed = getFeed;
