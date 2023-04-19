const Activity = require("./activitiesService");
const User = require("../users/usersService");
const _ = require("lodash");

exports.createActivityTargetGroup = async (data) => {
  let targetGroups = data.targetGroups;

  let activitiesToCreate = [];

  let originUser = null;
  if (data.otherUsers && data.otherUsers.length > 0) {
    originUser = await User.getRaw(data.otherUsers[0]);
  }

  for (let target in targetGroups) {
    let userIds = targetGroups[target];

    let excludeUserIds = [];
    if (data.excludeUsers) excludeUserIds = data.excludeUsers;
    userIds = transformAndExcludeUserIds(userIds, excludeUserIds);

    userIds.forEach((userId) => {
      let alreadyExist = activitiesToCreate.find((element, index) => {
        if (
          element.user._id
            ? element.user._id.toString() === userId.toString()
            : element.user.toString() === userId.toString()
        ) {
          return {
            element,
            index,
          };
        }
      });

      if (!alreadyExist) {
        if (originUser && User.isBlockedByOrBlocking(originUser, userId)) {
          return;
        }
        if (
          excludeUserIds.map((u) => u.toString()).includes(userId.toString())
        ) {
          return;
        }
        activitiesToCreate.push({
          ...data,
          ...{ user: userId },
          ...{ notificationCategories: [target] },
        });
      } else {
        let element = alreadyExist;
        element.notificationCategories = [];
        element.notificationCategories.push(target);
        activitiesToCreate[alreadyExist.index] = element;
      }
    });
  }

  let promiseArray = [];
  activitiesToCreate.forEach((element) => {
    promiseArray.push(Activity.create(element));
  });
  await Promise.all(promiseArray);
};

let transformAndExcludeUserIds = (userIds, excludeUserIds) => {
  userIds = _.flatten(userIds);

  let userIdsString = [];
  let excludeUserIdsString = [];

  userIds.forEach((element) => {
    userIdsString.push(element.toString());
  });
  excludeUserIds.forEach((element) => {
    excludeUserIdsString.push(element.toString());
  });
  return userIdsString.filter((id) => !excludeUserIds.includes(id));
};
