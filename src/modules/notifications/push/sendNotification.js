const admin = require("firebase-admin");
const firebaseAdminConfig = require(`../../../credentials/papeo-firebase-adminsdk-${
  process.env.STAGE || "dev"
}`);
//admin.initializeApp({
//  credential: admin.credential.cert(firebaseAdminConfig),
//});
const User = require("../../../services/users/usersService");
const fcm = process.env.TEST === "TRUE" ? null : admin.messaging();

exports.sendNotificationToUser = async (userId, title, body, dataObject) => {
  dataObject.clickAction = "FLUTTER_NOTIFICATION_CLICK";

  if (process.env.TEST) return;
  let user = await User.getRaw(userId);

  let tokens = [];
  user.tokens.forEach((token) => {
    if (token.fcmToken) tokens.push(token.fcmToken);
  });

  if (!tokens.length) return false;

  let notification = {
    title,
    body,
    // content_available: true
  };

  const payload = (admin.messaging.MessagingPayload = {
    notification,
    data: dataObject,
  });
  return fcm.sendToDevice(tokens, payload);
};

exports.sendNotifications = (tokens, title, body, dataObject) => {
  if (!tokens.length) return false;

  dataObject.clickAction = "FLUTTER_NOTIFICATION_CLICK";

  let notification = {
    title,
    body,
    // content_available: true
  };

  const payload = (admin.messaging.MessagingPayload = {
    notification,
    data: dataObject,
  });
  return fcm.sendToDevice(tokens, payload);
};
