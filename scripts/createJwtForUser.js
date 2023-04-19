const createDatabaseConnection = require("../src/database.js");
const User = require("../src/services/users/usersService");
(async () => {
  await createDatabaseConnection();
  const user = await User.getRaw(process.argv[2]);
  console.log(
    await User.getLoginInformation(user)
  );
})();
