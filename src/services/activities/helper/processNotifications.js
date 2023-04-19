const {
  sendNotificationToUser,
} = require("../../../modules/notifications/push/sendNotification");
const {
  sendRawMessage,
} = require("../../../modules/notifications/emails/sendUserNotifications");
exports.checkIfNotificationShouldBeSendAndSend = async (activity, user) => {
  const additionalNotificationKeyValues = activity?.notification || {};

  if (pushNotificationForUserAllowed(activity.notificationCategories, user)) {
    await sendNotificationToUser(
      activity.user._id,
      activity.title,
      activity.body,
      additionalNotificationKeyValues
    );
  }
  if (emailNotificationForUserAllowed(activity.notificationCategories, user)) {
    if (user.email) {
      try {
        await sendRawMessage(user.email, activity.title, activity.body);
      } catch (error) {
        console.error(error);
      }
    }
  }
};

const pushNotificationForUserAllowed = (activityCategories, user) => {
  let userAllowedCategories = [];

  let userNotifications = user.settings.notifications;

  for (let category in userNotifications) {
    if (userNotifications?.[category].push) {
      userAllowedCategories.push(category);
    }
  }

  let allowed = false;
  activityCategories.forEach((category) => {
    if (userAllowedCategories.includes(category)) allowed = true;
  });
  return allowed;
};
const emailNotificationForUserAllowed = (activityCategories, user) => {
  let userAllowedCategories = [];

  let userNotifications = user.settings.notifications;

  for (let category in userNotifications) {
    if (userNotifications?.[category].email) {
      userAllowedCategories.push(category);
    }
  }

  let allowed = false;
  activityCategories.forEach((category) => {
    if (userAllowedCategories.includes(category)) allowed = true;
  });
  return allowed;
};
