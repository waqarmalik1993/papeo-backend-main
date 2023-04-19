const PartyGuests = require("../../services/partyGuests/partyGuestsService");
const Party = require("../../services/parties/partiesService");
const Competition = require("../../services/competitions/competitionsService");
const User = require("../../services/users/usersService");
exports.handleCompetitionExpiration = async () => {
  console.log("executing competition expiration check...");
  const expiredCompetitions = await Competition.MODEL.find({
    endDate: {
      $lt: new Date(),
    },
    expired: false,
  });
  for (const competition of expiredCompetitions) {
    await Competition.closeCompetition(competition);
  }
};
