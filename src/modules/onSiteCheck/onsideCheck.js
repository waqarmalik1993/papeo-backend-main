const PartyGuests = require("../../services/partyGuests/partyGuestsService");
const Party = require("../../services/parties/partiesService");
const User = require("../../services/users/usersService");
const {
  sendNotificationToUser,
} = require("../notifications/push/sendNotification");
const {
  PUSH_ONSITE_CHECK,
} = require("../notifications/push/internationalization");
exports.handleOnSiteCheck = async () => {
  console.log("executing onSite check...");
  const partyGuests =
    await PartyGuests.getAllAttendingPartyGuestsWhichOnsiteStatusIsUnknown();
  console.log(
    "getAllAttendingPartyGuestsWhichOnsiteStatusIsUnknown length:",
    partyGuests.length
  );
  const partyIds = {};
  for (const guest of partyGuests) {
    partyIds[guest.party.toString()] = true;
  }
  const parties = (
    await Promise.allSettled(Object.keys(partyIds).map((p) => Party.get(p)))
  )
    .filter((p) => p.status === "fulfilled")
    .map((p) => p.value);
  console.log("parties length:", parties.length);

  for (const party of parties) {
    if (partyIsHappeningRightNow(party)) {
      await handlePushNotifications(party, partyGuests);
      continue;
    }
    if (partyIsOver(party)) {
      await setOnsiteFalseForPartyGuests(party, partyGuests);
    }
  }
};

const partyIsOver = (party) => {
  const now = new Date();
  const beforeTwoHours = new Date();
  beforeTwoHours.setTime(beforeTwoHours.getTime() - 2 * 60 * 60 * 1000);
  if (party.startDate > now) return false;
  if (party.endDate && party.endDate < now) return true;
  if (party.endDate == null && party.startDate < beforeTwoHours) return true;
  return false;
};

const partyIsHappeningRightNow = (party) => {
  const now = new Date();
  return party.startDate <= now && !partyIsOver(party);
};

const handlePushNotifications = async (happeningParty, partyGuests) => {
  const now = new Date();
  const beforeOneHour = new Date();
  beforeOneHour.setTime(beforeOneHour.getTime() - 1 * 60 * 60 * 1000);
  const filteredPartyGuests = partyGuests.filter(
    (pg) => pg.party.toString() === happeningParty._id.toString()
  );
  console.log("filteredPartyGuests", filteredPartyGuests.length);
  for (const pg of filteredPartyGuests) {
    if (
      pg.showedOnSiteNotification > beforeOneHour &&
      pg.showedOnSiteNotification !== null
    ) {
      console.log("not sending push");
      continue;
    }
    console.log(
      `sending onsiteCheck to ${pg.user.toString()} for party ${pg.party.toString()}`
    );
    await PartyGuests.patch(pg._id, { showedOnSiteNotification: now });
    //I18N
    const user = await User.get(pg.user);
    const msg = PUSH_ONSITE_CHECK(
      await Party.get(pg.party),
      user.languageSetting || "de"
    );
    await sendNotificationToUser(pg.user.toString(), msg.title, msg.body, {
      command: "onSiteCheck",
      contentId: pg.party.toString(),
    });
  }
};

const setOnsiteFalseForPartyGuests = async (party, partyGuests) => {
  const filteredPartyGuests = partyGuests.filter(
    (pg) => pg.party.toString() === party._id.toString()
  );
  await Promise.all(
    filteredPartyGuests.map((pg) => PartyGuests.patch(pg._id, { onSite: "no" }))
  );
};

/*
(() => {
  setTimeout(async () => {
    
    const party = await Party.get("61b20614195c410009f1d99b");
    await sendNotificationToUser(
      "61aa6dc0971f190009ae17e8",//"61aa6dc0971f190009ae17e8",//"618e5b7cc3af5f0008bc5205",
      "Papeo",
      `Bist du auf der Party "${party.name}"?`,
      {
        command: "onSiteCheck",
        contentId: party._id.toString(),
      }
    );
    
    console.log("test")
  }, 1500);
})();
*/