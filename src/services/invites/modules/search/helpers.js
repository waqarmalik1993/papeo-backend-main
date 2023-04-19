exports.paginate = (skip, limit) => {
  return {
    $facet: {
      data: [
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ],
      total: [
        {
          $count: "total",
        },
      ],
    },
  };
};
exports.transformPipelineResult = (pipelineResult, skip, limit) => {
  return {
    total: pipelineResult[0].total[0]?.total || 0,
    skip,
    limit,
    data: pipelineResult[0].data,
  };
};
exports.selectFields = () => {
  //return pipelineResult;
  return {
    $project: {
      _id: 1,
      username: 1,
      distance: 1,
      isPartyKing: 1,
      isArtist: 1,
      relationship: 1,
      birthday: 1,
      lastActivityAt: 1,
      "verification.verified": 1,
      profilePicture: 1,
    },
  };
};
exports.filterBySettings = () => {
  return {
    $match: {
      $expr: {
        $or: [
          { $eq: ["$relationship.partyFriends", true] },
          {
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
              {
                $or: [
                  {
                    $and: [
                      "$relationship.others",
                      "$settings.invitations.others",
                    ],
                  },
                  // for partyguests
                  {
                    $and: [
                      "$relationship.myPartyGuests",
                      "$settings.invitations.others",
                    ],
                  },
                  {
                    $and: [
                      "$relationship.followingMe",
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
            ],
          },
        ],
      },
    },
  };
};
exports.geoNear = ({ lat, long, distanceFromMeters, distanceToMeters = 0 }) => {
  if (isNaN(lat)) throw new Error("lat must be a number");
  if (isNaN(long)) throw new Error("long must be a number");
  if (isNaN(distanceFromMeters))
    throw new Error("distanceFromKm must be a number");
  if (isNaN(distanceToMeters)) throw new Error("distanceToKm must be a number");

  const geoQuery = {
    $geoNear: {
      near: {
        type: "Point",
        coordinates: [long, lat],
      },
      key: "currentLocation.coordinates",
      minDistance: parseInt(distanceFromMeters),
      spherical: true,
      distanceField: "distance",
      distanceMultiplier: 1 / 1000,
    },
  };
  if (distanceToMeters !== 0) {
    geoQuery.$geoNear.maxDistance = parseInt(distanceToMeters);
  }
  return geoQuery;
};
exports.calculateRelationship = ({
  myPartyFriends,
  myFollowers,
  myFollowedUsers,
  myPartyGuests,
}) => {
  return [
    {
      $set: {
        relationship: {
          partyFriends: {
            $cond: {
              if: {
                $in: ["$_id", myPartyFriends],
              },
              then: true,
              else: false,
            },
          },
          followingMe: {
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

          myPartyGuests: {
            $cond: {
              if: {
                $in: ["$_id", myPartyGuests],
              },
              then: true,
              else: false,
            },
          },
        },
      },
    },
    {
      $set: {
        "relationship.others": {
          $cond: {
            if: {
              $and: [
                { $eq: ["$relationship.followingMe", false] },
                { $eq: ["$relationship.followers", false] },
                { $eq: ["$relationship.partyFriends", false] },
                { $eq: ["$relationship.myPartyGuests", false] },
              ],
            },
            then: true,
            else: false,
          },
        },
      },
    },
  ];
};

exports.sort = () => {
  //return pipelineResult;
  return {
    $sort: {
      "relationship.partyFriends": -1,
      "relationship.myPartyGuests": -1,
      distance: 1, // distanz absteigend
    },
  };
};
