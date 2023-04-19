const localAuthentication = require("./modules/authentication/local.js").localAuthentication;
const appleAuthentication = require("./modules/authentication/apple.js").appleAuthentication;
const googleAuthentication = require("./modules/authentication/google.js").googleAuthentication;
// TODO Logout implementieren
// TODO Error Meldungen einbauen!

// TODO Erlauben, dass man sich neben der Telefonnummer auch mit Google oder Apple anmelden kann. Jedoch nicht mit beidem!

// TODO Hochzählen der fehlerhaften Logins.
// TODO Wird ein Account gesperrt, werden sämtliche Tokens removed.

module.exports = async (req, res) => {
  switch (req.body.type) {
  case "local":
    return res.send(await localAuthentication(req));
  case "apple":
    return res.send(await appleAuthentication(req.body));
  case "google":
    return res.send(await googleAuthentication(req.body));
  }
};
