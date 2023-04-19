const User = require("../usersService");

exports.removeAccessToken = async (user, accessToken) => {
  await User.patch(user._id, {
    $pull: {
      tokens: {
        accessToken
      }
    }
  });
};

exports.removeFcmTokenIfItsExistsOnAnotherUser = async (fcmToken) => {
  const user = await User.find({
    query: {
      "tokens.fcmToken": fcmToken
    }
  });

  if (user.data.length) {
    await User.patch(user.data[0]._id, {
      $pull: {
        tokens: {
          fcmToken: fcmToken
        }
      }
    });
  }
};
