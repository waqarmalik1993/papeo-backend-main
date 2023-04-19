const User = require("../../usersService");
const PartyGuest = require("../../../partyGuests/partyGuestsService");
const Transaction = require("../../../transactions/transactionsService");
const { BadRequest } = require("@feathersjs/errors");
module.exports.generateRandomReferralCode = () => {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const charactersLength = characters.length;
  for (var i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

/**
 *
 * @param {*} userId userId
 * @param {*} referralCode 6 digit code
 */
const addReferralCodeToUser = async (userId, referralCode) => {
  if (!userId || !referralCode) throw new Error();
  return await User.patch(userId, {
    $push: {
      referralCodes: { code: referralCode, createdAt: new Date() },
    },
  });
};
/**
 *
 * @param {*} referralCode 6 digit code
 */
module.exports.isReferralCodeUsed = async (referralCode) => {
  return await User.MODEL.exists({ "referralCodes.code": referralCode });
};
/**
 *
 * @param {*} userId userId
 * @param {*} referralCode 6 digit code
 */
module.exports.addRandomReferralCodeToUser = async (userId) => {
  let referralCode = this.generateRandomReferralCode();
  while (await this.isReferralCodeUsed(referralCode)) {
    referralCode = this.generateRandomReferralCode();
  }
  if (!userId || !referralCode) throw new Error();
  return await addReferralCodeToUser(userId, referralCode);
};
module.exports.creditUserForReferralAndFollowUser = async (
  referringUser,
  referralCode,
  referredUser
) => {
  try {
    await User.addFollower(referredUser._id, referringUser._id);
  } catch (error) {
    console.error(error);
  }
  try {
    await Transaction.TYPES.referredByAUserCredit({
      user: referredUser,
    });
  } catch (error) {
    console.error(error);
    console.log(
      `ERROR: referralCredit failed with code ${referralCode} for user ${referredUser._id}`
    );
  }
};

/*
Registrierungen 
Party King Anmeldungen
Aktiv 
Logins 
Artists
Teilnahmen von Gästen auf wie viele Partys
Verifizierte Gäste
Land des Nutzers
*/

module.exports.getReferralStatsForReferralCode = async (referralCode) => {
  const activeTresholdSeconds = 3600 * 24 * 7; // 7 days
  const activeDate = new Date();
  activeDate.setSeconds(-activeTresholdSeconds);

  const users = await User.MODEL.find({ referredBy: referralCode }).lean();
  const partyKings = users.filter((u) => u.isPartyKing);
  const artists = users.filter((u) => u.isArtist);
  const verified = users.filter((u) => u.verification.verified);
  const activeUsers = users.filter((u) => u.lastActivityAt > activeDate);
  const logins = users.reduce((a, b) => a + b.successfulLoginCount, 0);
  const averageLogins = users.length === 0 ? 0 : logins / users.length;
  const partyGuests = await PartyGuest.MODEL.find({
    user: { $in: users.map((u) => u._id) },
    onSite: "yes",
  }).lean();
  const uniquePartyIds = {};
  for (const pg of partyGuests) {
    uniquePartyIds[pg.party.toString()] = true;
  }
  return {
    // number of users registered with referral code
    registrations: users.length,
    // number of party kings registered with referral code
    partyKings: partyKings.length,
    // number of artists registered with referral code
    artists: artists.length,
    // number of verified users registered with referral code
    verified: verified.length,
    // number of active users registered with referral code
    active: activeUsers.length,
    // average of user.successfulLoginCount for referred users
    averageLogins: averageLogins,
    // number of parties where referred users were present 
    parties: Object.keys(uniquePartyIds).length,
  };
};
