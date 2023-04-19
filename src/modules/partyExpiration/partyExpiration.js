const PartyGuests = require("../../services/partyGuests/partyGuestsService");
const Party = require("../../services/parties/partiesService");
const User = require("../../services/users/usersService");
exports.handlePartyExpiration = async () => {
  console.log("executing party expiration check...");
  const expiredParties = await Party.MODEL.find({
    calculatedEndDate: {
      $lt: new Date(),
    },
    expired: false,
  });
  for (const party of expiredParties) {
    await Party.setPartyToExpired(party._id);
  }
  const before12h = new Date();
  before12h.setTime(before12h.getTime() - 12 * 60 * 60 * 1000);
  const expired12hParties = await Party.MODEL.find({
    calculatedEndDate: {
      $lt: before12h,
    },
    expired12h: false,
  });
  for (const party of expired12hParties) {
    await Party.setPartyToExpired12h(party._id);
  }
};

/* MIGRATION

  const expiredParties = await Party.MODEL.find();
  console.log(expiredParties.length);
  for (const party of expiredParties) {
    if (party.startDate && !party.calculatedEndDate) {
      console.log(party._id);
      if (party.endDate) {
        await Party.patch(party._id, {
          calculatedEndDate: party.endDate,
        });
      } else {
        const date = new Date(party.startDate);
        date.setTime(date.getTime() + 2 * 60 * 60 * 1000);
        await Party.patch(party._id, {
          calculatedEndDate: date,
        });
      }
    }
  }
  */
