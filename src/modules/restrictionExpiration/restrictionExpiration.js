const Restriction = require("../../services/restrictions/restrictionsService");
const User = require("../../services/users/usersService");
exports.handleRestrictionExpiration = async () => {
  console.log("executing restriction expiration check...");
  const expiredRestrictions = await Restriction.MODEL.find({
    expired: false,
    expiresAt: {
      $lt: new Date(),
    },
  });
  for (const restriction of expiredRestrictions) {
    console.log(`setting restriction ${restriction._id} to expired`);
    await Restriction.removeRestrictionFromUser(restriction.user, restriction);
  }
};
