const PartyGuests = require("../../services/partyGuests/partyGuestsService");
const Party = require("../../services/parties/partiesService");
const Competition = require("../../services/competitions/competitionsService");
const User = require("../../services/users/usersService");
exports.handleCompetitionOnSiteReminder = async () => {
  console.log("executing competition OnSiteReminder check...");
  const inTwoHours = new Date();
  inTwoHours.setTime(inTwoHours.getTime() + 2 * 60 * 60 * 1000);
  const competitions = await Competition.MODEL.find({
    endDate: {
      $lt: inTwoHours,
    },
    expired: false,
    sendOnSiteReminder: false,
  });
  for (const competition of competitions) {
    await Competition.sendOnSiteReminder(competition);
  }
};
