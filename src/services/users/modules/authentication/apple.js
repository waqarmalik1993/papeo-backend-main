const Verifier = require("apple-signin-verify-token");
const PAPEO_ERRORS =
  require("../../../../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../../../../modules/errors/errors.js").papeoError;
const usersService = require("../../usersService.js");
const validate = require("../../../../modules/validation/validate.js");
const UserSchema =
  require("../../../../modules/validation/users.js").UserSchema;

exports.appleAuthentication = async (data) => {
  validate(UserSchema.appleAuthentication.POST, data);
  let { token } = data;
  let user;

  console.log(token);
  console.log(await Verifier.verify(token));

  const { email, aud, sub } = await Verifier.verify(token);
  if (
    !sub ||
    (aud !== "party.papeo" &&
      aud !== "party.papeo.signIn" &&
      aud !== "party.papeo.dev")
  )
    throw papeoError(PAPEO_ERRORS.NOT_AUTHENTICATED);

  let users = await usersService.find({
    query: {
      "authPlatforms.method": "apple",
      "authPlatforms.externalUserId": sub,
    },
  });
  if (users.data.length) user = users.data[0];
  if (user?.locked) throw papeoError(PAPEO_ERRORS.USER_IS_BLOCKED);

  // TODO Vielleicht noch implementieren, dass die Email geändert wird, wenn diese sich ändert.
  const loggedInUser = await usersService.loginWithApple(user, {
    sub,
    email,
  });
  return usersService.getLoginInformation(
    loggedInUser,
    data.fcmToken,
    data.platform
  );
};
