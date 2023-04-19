const User = require("../../usersService");
const Follower = require("../../../followers/followersService");
const mongoose = require("mongoose");
exports.search = async (user, query) => {
  let skip = 0;
  let limit = 10;
  if (query.skip) skip = parseInt(query.skip);
  if (query.limit) limit = parseInt(query.limit);
  const handleParams = (param) => {
    if (!param) return undefined;
    return {
      $in: param,
    };
  };
  const filterOrConditions = [];
  const filterAndConditions = [];

  if (query.include) {
    if (query.include.includes("friends")) {
      const partyFriends = user.partyFriends
        .filter((pf) => pf.status === "accepted")
        .map((pf) => mongoose.Types.ObjectId(pf.friend));
      filterOrConditions.push({
        _id: {
          $in: partyFriends,
        },
      });
    }
    if (query.include.includes("following")) {
      const followedUsers = await Follower.getFollowerIdsForAUser(
        user._id.toString()
      );
      filterOrConditions.push({
        _id: {
          $in: followedUsers.map((fu) => mongoose.Types.ObjectId(fu)),
        },
      });
    }
    if (query.include.includes("following_me")) {
      const followingMeUsers = await Follower.getFollowedUserIdsForAUser(
        user._id.toString()
      );
      filterOrConditions.push({
        _id: {
          $in: followingMeUsers.map((fu) => mongoose.Types.ObjectId(fu)),
        },
      });
    }
    if (query.include.includes("authenticated_users")) {
      filterOrConditions.push({
        "verification.verified": true,
      });
    }
    if (query.include.includes("artists")) {
      filterOrConditions.push({
        isArtist: true,
      });
    }
  }

  filterAndConditions.push(
    { username: { $exists: true } },
    { locked: { $eq: false } },
    { _id: { $nin: [user._id, ...user.blockedUsers, ...user.blockedByUsers] } }
  );
  if (query.sex) {
    filterAndConditions.push({ sex: handleParams(query.sex) });
  }
  if (query.age_from) {
    const age = parseInt(query.age_from);
    const birthday = new Date();
    birthday.setFullYear(birthday.getFullYear() - age);
    filterAndConditions.push({
      birthday: { $lte: birthday },
    });
  }
  if (query.age_to) {
    const age = parseInt(query.age_to);
    const birthday = new Date();
    birthday.setFullYear(birthday.getFullYear() - age);
    filterAndConditions.push({
      birthday: { $gte: birthday },
    });
  }
  if (query.last_activity_at) {
    const lastActivity = new Date(query.last_activity_at);
    filterAndConditions.push({
      lastActivityAt: { $gte: lastActivity },
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
        key: "currentLocation.coordinates",
        minDistance: distanceFrom,
        maxDistance: distanceTo,
        spherical: true,
        distanceField: "distance",
        distanceMultiplier: 1 / 1000,
      },
    });
  }
  if (query.text_search) {
    if (query.text_search.startsWith("#")) {
      // Tag search
      filterAndConditions.push({
        profileTags: {
          $in: [query.text_search.replace("#", "").toLowerCase()],
        },
      });
    } else {
      filterAndConditions.push({
        $or: [
          { $text: { $search: `"${query.text_search}"` } },
          { usernameLowercase: new RegExp(query.text_search, "i") },
        ],
      });
    }
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
    // sort by createdAt (newest first) (_id's first 4 bytes is timestamp)
    pipeline.push({ $sort: { _id: -1 } });
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
  const users = await User.MODEL.aggregate(pipeline);
  users[0].data = await Promise.all(
    users[0].data.map(async (u) => {
      return {
        ...u,
        distance: u.distance ? Math.round(u.distance) : undefined,
        partyFriendsCount: u.partyFriends.filter(
          (pf) => pf.status === "accepted"
        ).length,
        followerCount: await Follower.getFollowerCount(u._id),
      };
    })
  );
  return {
    count: users[0].count[0]?.count || 0,
    skip,
    limit,
    data: users[0].data.map(filterUser),
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
