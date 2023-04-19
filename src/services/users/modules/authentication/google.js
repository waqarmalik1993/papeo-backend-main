const PAPEO_ERRORS =
  require("../../../../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../../../../modules/errors/errors.js").papeoError;
const usersService = require("../../usersService.js");
const validate = require("../../../../modules/validation/validate.js");
const UserSchema =
  require("../../../../modules/validation/users.js").UserSchema;
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client();

exports.googleAuthentication = async (data) => {
  validate(UserSchema.googleAuthentication.POST, data);
  let { token } = data;
  let user;

  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: [
      "751894165760-mug1j4nc3r0cmopqnld9f1tf7r3u89u2.apps.googleusercontent.com",
      "751894165760-v9q97a5260u7g8kl7kljds19phrj701f.apps.googleusercontent.com",
      "751894165760-60ejhekjqvt8pol99r2tfuhsc8441vh6.apps.googleusercontent.com",
      "751894165760-19chao6lta8k2vql76j5fgki6taf2ef6.apps.googleusercontent.com",
      "751894165760-ve1duq209q1q8cbipqab8qo265ttb0k3.apps.googleusercontent.com",
    ],
  });
  const payload = ticket.getPayload();
  const { email, sub } = payload;
  if (!sub) throw papeoError(PAPEO_ERRORS.NOT_AUTHENTICATED);

  let users = await usersService.find({
    query: {
      "authPlatforms.method": "google",
      "authPlatforms.externalUserId": sub,
    },
  });
  if (users.data.length) user = users.data[0];
  if (user?.locked) throw papeoError(PAPEO_ERRORS.USER_IS_BLOCKED);

  const loggedInUser = await usersService.loginWithGoogle(user, {
    sub,
    email,
  });
  return usersService.getLoginInformation(
    loggedInUser,
    data.fcmToken,
    data.platform
  );
};
