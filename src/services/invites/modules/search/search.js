const User = require("../../../users/usersService");
const Party = require("../../../parties/partiesService");
const Follower = require("../../../followers/followersService");
const MyPartyGuests = require("../../../myPartyGuests/myPartyGuestsService");
const Invite = require("../../invitesService");
const mongoose = require("mongoose");
exports.search = async (user, query) => {
  let skip = 0;
  let limit = 10;
  if (query.$skip) skip = parseInt(query.$skip);
  if (query.$limit) limit = parseInt(query.$limit);
  const handleParams = (param) => {
    if (!param) return undefined;
    return {
      $in: param,
    };
  };
  const filterOrConditions = [];
  const filterAndConditions = [];
  console.log(
    "Partyfriends Count:",
    user.partyFriends.filter((pf) => pf.status === "accepted").length
  );

  // always exclude partyFriends, because they are added seperately
  const partyFriends = user.partyFriends
    .filter((pf) => pf.status === "accepted")
    .map((pf) => mongoose.Types.ObjectId(pf.friend));
  filterAndConditions.push({
    _id: {
      $nin: partyFriends,
    },
  });

  if (query.include) {
    if (query.include.includes("friends")) {
      filterOrConditions.push({
        _id: {
          $in: [mongoose.Types.ObjectId("000000000000000000000000")],
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
    if (query.include.includes("my_party_guests")) {
      filterOrConditions.push({
        _id: {
          $in: [mongoose.Types.ObjectId("000000000000000000000000")],
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
    if (query.include.includes("party_king_members")) {
      filterOrConditions.push({
        isPartyKing: true,
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
    { _id: { $nin: [user._id, ...user.blockedUsers, user.blockedByUsers] } }
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
  if (query.lat && query.long) {
    const lat = parseFloat(query.lat);
    const long = parseFloat(query.long);
    const distanceFrom = query.distance_from
      ? parseInt(query.distance_from * 1000)
      : 0;
    const geoQuery = {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [long, lat],
        },
        key: "currentLocation.coordinates",
        minDistance: distanceFrom,
        spherical: true,
        distanceField: "distance",
        distanceMultiplier: 1 / 1000,
      },
    };
    if (query.distance_to) {
      geoQuery.$geoNear.maxDistance = parseInt(query.distance_to * 1000);
    }
    geoNear.push(geoQuery);
  }
  if (query.text_search) {
    filterAndConditions.push({
      usernameLowercase: new RegExp(query.text_search.toLowerCase(), "i"),
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

  //# SETTINGS_DISTANCE
  // filter out users which are not within distance specified in their invitation settings

  pipeline.push({
    $match: {
      $expr: {
        $and: [
          {
            $or: [
              { $eq: ["$settings.invitations.distanceTo", 0] },
              { $lte: ["$distance", "$settings.invitations.distanceTo"] },
            ],
          },
          {
            $or: [
              { $eq: ["$settings.invitations.distanceFrom", 0] },
              { $gte: ["$distance", "$settings.invitations.distanceFrom"] },
            ],
          },
        ],
      },
    },
  });

  // filter out user who are already attending the party (query.party)
  pipeline.push({
    // join partyguests for that user to the party
    $lookup: {
      from: "partyguests",
      as: "partyguests",
      let: {
        userId: "$_id",
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$party", mongoose.Types.ObjectId(query.party)] },
                { $eq: ["$user", "$$userId"] },
              ],
            },
          },
        },
      ],
    },
  });
  //# ALREADY_ATTENDING

  pipeline.push({
    $match: {
      $and: [{ partyguests: { $exists: true, $eq: [] } }],
    },
  });

  // filter out user who are already invited to the party
  // A
  /*
  pipeline.push({
    // join invites for that user to the party
    $lookup: {
      from: "invites",
      as: "invites",
      let: {
        userId: "$_id",
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$party", mongoose.Types.ObjectId(query.party)] },
                { $eq: ["$invitedUser", "$$userId"] },
              ],
            },
          },
        },
      ],
    },
  });
  
  pipeline.push({
    //# ALREADY_INVITED
    $match: {
      $and: [{ invites: { $exists: true, $eq: [] } }],
    },
  });
  */

  // filter out user who are already attending another party at the same time
  /*
  const party = await Party.get(query.party);
  const overlappingParties = await Party.getOverlappingParties(party);
  pipeline.push({
    // join partyguests for that user for overlapping parties
    $lookup: {
      from: "partyguests",
      as: "partyguests_overlapping",
      let: {
        userId: "$_id",
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $in: ["$party", overlappingParties.map((p) => p._id)] },
                { $eq: ["$user", "$$userId"] },
                { $eq: ["$status", "attending"] },
              ],
            },
          },
        },
      ],
    },
  });
  */
  //# ALREADY_GUEST_TO_OVERLAPPING_PARTY
  /*
  pipeline.push({
    $match: {
      $and: [{ partyguests_overlapping: { $exists: true, $eq: [] } }],
    },
  });*/
  // #### relationship logic
  const myFollowers = await Follower.getFollowedUserIdsForAUser(user._id);
  const myFollowedUsers = await Follower.getFollowerIdsForAUser(user._id);
  pipeline.push({
    $set: {
      relationship: {
        following: {
          $cond: {
            if: {
              $in: ["$_id", myFollowers],
            },
            then: true,
            else: false,
          },
        },
        followers: {
          $cond: {
            if: {
              $in: ["$_id", myFollowedUsers],
            },
            then: true,
            else: false,
          },
        },
        partyFriends: {
          $cond: {
            if: {
              $in: [
                "$_id",
                user.partyFriends
                  .filter((pf) => pf.status === "accepted")
                  .map((pf) => pf.friend),
              ],
            },
            then: true,
            else: false,
          },
        },
      },
    },
  });
  pipeline.push({
    $set: {
      "relationship.others": {
        $cond: {
          if: {
            $and: [
              { $eq: ["$relationship.following", false] },
              { $eq: ["$relationship.followers", false] },
              { $eq: ["$relationship.partyFriends", false] },
            ],
          },
          then: true,
          else: false,
        },
      },
    },
  });
  // filter for relationship invite settings

  pipeline.push({
    $set: {
      invitationIsAllowed: {
        $cond: {
          if: {
            $or: [
              {
                $and: ["$relationship.others", "$settings.invitations.others"],
              },
              {
                $and: [
                  "$relationship.following",
                  "$settings.invitations.following",
                ],
              },
              {
                $and: [
                  "$relationship.followers",
                  "$settings.invitations.followers",
                ],
              },
            ],
          },
          then: true,
          else: false,
        },
      },
    },
  });

  //# SETTINGS
  /*
  pipeline.push({
    $match: {
      $and: [{ invitationIsAllowed: { $exists: true, $eq: true } }],
    },
  });*/

  // merging friends
  let [friends] = await Promise.all([
    (
      await User.MODEL.find({ _id: { $in: partyFriends } })
        .skip(skip)
        .limit(limit)
        .lean()
    ).map((friend) => ({ ...friend, isFriend: true, isMyPartyGuest: false })),
  ]);
  if (query.include) {
    // exclude friends
    // exclude users
    if (!query.include.includes("friends")) {
      friends = [];
    }
  }

  const friendsCount = friends.length;
  const totalFriendsCount = partyFriends.length;
  let restLimit = limit - friendsCount;
  let restSkip = 0;
  console.log({ skip, friendsCount });
  if (skip - friendsCount > 0) restSkip = Math.abs(skip - totalFriendsCount);
  //if (friendsCount == 0) restSkip = 0;

  let total = friendsCount;
  console.log({
    friendsCount,
    restSkip,
    restLimit,
  });
  let myPartyGuests = (
    await MyPartyGuests.MODEL.find({ user: user._id })
      .populate("guest")
      .skip(restSkip)
      .limit(restLimit)
      .lean()
  ).map((u) => ({ ...u.guest, isMyPartyGuest: true, isFriend: false }));

  if (query.include) {
    if (!query.include.includes("my_party_guests")) {
      myPartyGuests = [];
    }
  }

  const myPartyGuestsCount = myPartyGuests.length;

  let restLimit2 = restLimit - myPartyGuestsCount;
  let restSkip2 = friendsCount + myPartyGuestsCount;
  if (restSkip - myPartyGuestsCount > 0)
    restSkip2 = Math.abs(restSkip - myPartyGuestsCount);

  let total2 = myPartyGuestsCount + friendsCount;
  console.log({
    myPartyGuestsCount,
    restLimit2,
    restSkip2,
  });
  // pagination
  pipeline.push({
    $facet: {
      data: [
        {
          $skip: restSkip2,
        },
        {
          $limit: restLimit2 || 1,
        },
      ],
      count: [
        {
          $count: "count",
        },
      ],
    },
  });
  let users = [];
  //     count: users[0].count[0]?.count || 0,

  const aggregationResult = (await User.MODEL.aggregate(pipeline))[0];
  total2 += aggregationResult.count[0]?.count || 0;
  if (restLimit2 > 0) {
    users = aggregationResult.data;
  }
  console.log({ usersLength: users.length });
  //console.log(JSON.stringify(pipeline));
  //console.log(JSON.stringify(users));
  // for debugging
  const label = (u) => {
    if (!u.isFriend && !u.isMyPartyGuest) return "other";
    if (u.isFriend) return "friend";
    if (u.isMyPartyGuest) return "partyGuest";
    return "ERROR";
  };
  let data = [
    ...friends,
    ...myPartyGuests,
    ...users.map((friend) => ({
      ...friend,
      isFriend: false,
      isMyPartyGuest: false,
    })),
  ];
  /* debugging
  .map((u) => {
    return { _id: u._id, label: label(u) };
  });
  */
  console.log({ resLength: data.length });

  data = await Promise.all(
    data.map(filterUser).map(async (u) => {
      /*console.log(
        `${u.username} (Distanz: ${
          u.distance ? Math.round(u.distance) : undefined
        } km)`
      );*/
      return {
        ...u,
        distance: u.distance ? Math.round(u.distance) : undefined,
        invitationCost: await Invite.calculateInvitationCost(user, u),
      };
    })
  );
  return {
    count: total2,
    //count: users[0].count[0]?.count + partyFriends.length || 0,
    skip,
    limit,
    data,
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
  //return { partyguests_overlapping: user.partyguests_overlapping };
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
    "partyguests_overlapping",
    "invites",
    "partyFriends",
    "partyguests",
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
