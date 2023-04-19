const Party = require("../../partiesService");
const Follower = require("../../../followers/followersService");
const Upload = require("../../../uploads/uploadsService");
const PartyGuest = require("../../../partyGuests/partyGuestsService");
const User = require("../../../users/usersService");
const mongoose = require("mongoose");
exports.search = async (user, query) => {
  let skip = 0;
  let limit = 10;
  if (query.skip) skip = parseInt(query.skip);
  if (query.limit) limit = parseInt(query.limit);
  const filterAndConditions = [];

  const filterOrConditions = [];
  filterAndConditions.push({ status: { $ne: "draft" } });
  if (!user || !user.adminRights?.canSeeSecretParties) {
    filterAndConditions.push({ privacyLevel: { $ne: "secret" } });
  }

  function unique(value, index, self) {
    return self.indexOf(value) === index;
  }
  if (query.guests) {
    if (user && query.guests.includes("friends")) {
      // get party ids
      const partyFriends = user.partyFriends
        .filter((pf) => pf.status === "accepted")
        .map((pf) => mongoose.Types.ObjectId(pf.friend));
      const parties = await PartyGuest.MODEL.find({
        user: { $in: partyFriends },
        status: "attending",
      });
      const partiesWithFriends = parties.map((p) => p.party);
      filterOrConditions.push({
        _id: {
          $in: partiesWithFriends.filter(unique),
        },
      });
    }
    if (user && query.guests.includes("following")) {
      // get party ids
      const followedUsers = await Follower.getFollowerIdsForAUser(
        user._id.toString()
      );
      console.log(followedUsers);
      const parties = await PartyGuest.MODEL.find({
        user: { $in: followedUsers },
        status: "attending",
      });
      const partiesWithFollowed = parties.map((p) => p.party);
      console.log({ parties, partiesWithFollowed });
      filterOrConditions.push({
        _id: {
          $in: partiesWithFollowed.filter(unique),
        },
      });
    }
    if (user && query.guests.includes("following_me")) {
      // get party ids
      const followingMeUsers = await Follower.getFollowedUserIdsForAUser(
        user._id.toString()
      );
      const parties = await PartyGuest.MODEL.find({
        user: { $in: followingMeUsers },
        status: "attending",
      });
      const partiesWithFollowing = parties.map((p) => p.party);
      console.log({ parties, partiesWithFollowing });
      filterOrConditions.push({
        _id: {
          $in: partiesWithFollowing.filter(unique),
        },
      });
    }
  }
  if (query.text_search) {
    if (query.text_search.startsWith("#")) {
      // Tag search
      filterAndConditions.push({
        tags: { $in: [query.text_search.replace("#", "").toLowerCase()] },
      });
    } else {
      filterAndConditions.push({
        $or: [
          { $text: { $search: `"${query.text_search}"` } },
          { name: new RegExp(query.text_search, "i") },
        ],
      });
    }
  }
  // if type is commercial and private, dont apply a filter
  if (query.type?.length === 1) {
    filterAndConditions.push({
      type: query.type[0],
    });
  }
  // if privacy_level is open and closed, dont apply a filter
  if (query.privacy_level) {
    filterOrConditions.push(
      ...query.privacy_level.map((pl) => {
        return {
          privacyLevel: { $eq: pl },
        };
      })
    );
  }
  if (query.start_date) {
    const startDate = new Date(query.start_date);
    filterAndConditions.push({
      startDate: { $gte: startDate },
    });
  }

  console.log(filterOrConditions);
  console.log(filterAndConditions);
  const geoNear = [];
  if (query.lat && query.long && !query.text_search) {
    const lat = parseFloat(query.lat);
    const long = parseFloat(query.long);
    const distanceFrom = query.distance_from
      ? parseInt(query.distance_from * 1000)
      : 0;
    const distanceTo = query.distance_to
      ? parseInt(query.distance_to * 1000)
      : 200000;
    geoNear.push({
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [long, lat],
        },
        key: "location.coordinates",
        minDistance: distanceFrom,
        maxDistance: distanceTo,
        spherical: true,
        distanceField: "distance",
        distanceMultiplier: 1 / 1000,
      },
    });
  }
  const pipeline = [];
  if (geoNear.length > 0) pipeline.push(...geoNear);
  if (filterAndConditions.length > 0) {
    pipeline.push({
      $match: {
        $and: filterAndConditions,
      },
    });
  }
  if (filterOrConditions.length > 0) {
    pipeline.push({
      $match: {
        $or: filterOrConditions,
      },
    });
  }

  if (query.text_search) {
    pipeline.push({ $sort: { score: { $meta: "textScore" } } });
  } else {
    pipeline.push({ $sort: { startDate: 1, distance: 1 } });
  }

  // pagination
  pipeline.push({
    $facet: {
      data: [{ $skip: skip }, { $limit: limit }],
      count: [
        {
          $count: "count",
        },
      ],
    },
  });
  let parties = await Party.MODEL.aggregate(pipeline);

  // TODO fetch uploads in query
  const partiesWithUploads = await Promise.all(
    parties[0].data.map(async (p) => {
      return {
        ...p,
        distance: p.distance ? Math.round(p.distance) : undefined,
        owner: await User.get(p.owner),
        uploads: (await Promise.allSettled(p.uploads.map((u) => Upload.get(u))))
          .filter((upload) => upload.status === "fulfilled")
          .map((u) => u.value),
        ...(await Party.getCounts(user, p)),
      };
    })
  );
  return {
    count: parties[0].count[0]?.count || 0,
    skip,
    limit,
    data: partiesWithUploads.map(filterUser),
  };
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
    "birthday",
    "currentLocation",
    "homeLocation",
    "email",
    "tokens",
    "authPlatforms",
    "swipes",
    "followers",
    "settings",
    "restrictions",
    "adminRights",
    "blockedUsers",
    "blockedByUsers",
    "subscription",
    "homeAddress",
    "stripeCustomerId",
    "reports",
    "inviteToken"
  );
  return result;
};

const filterParty = (party) => {
  const result = filterEntity(party, "swipes", "bookmarks");
  result.owner = filterUser(party.owner);
  return result;
};
