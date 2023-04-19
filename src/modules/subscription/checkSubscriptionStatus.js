const {checkSubscriptionStatusUser} = require("../../services/integrations/revenuecat/webhook");
const User = require("../../services/users/usersService");

exports.handleSubscriptionStatus = async () => {
  console.log("executing subscription check...");
  
  let allUsersToCheck = await User.MODEL.find({
    "subscription.expiresDate": {$lte: new Date()}
  }).lean();

  let promiseArray = [];
  allUsersToCheck.forEach(user => {
    promiseArray.push(checkSubscriptionStatusUser(user));
  });
  await Promise.all(promiseArray);
};
