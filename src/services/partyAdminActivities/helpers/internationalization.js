/*
exports.Activities = {
  partyNameChanged: (activity) => {
    return {
      en: `Changed the name of the party from: "${activity.data.old}" to "${activity.data.new}"`,
      de: `Änderte den Titel der Party von: "${activity.data.old}" zu "${activity.data.new}"`,
    };
  },
  partyDescriptionChanged: (activity) => {
    return {
      en: `Changed the description of the party from: "${activity.data.old}" to "${activity.data.new}"`,
      de: `Änderte die Beschreibung der Party von: "${activity.data.old}" zu "${activity.data.new}"`,
    };
  },
  partyTagsChanged: (activity) => {
    return {
      en: `Changed the tags of the party from: "${activity.data.old.join(
        ", "
      )}" to ${activity.data.new.join(", ")}`,
      de: `Änderte die Tags der Party von: "${activity.data.old.join(
        ", "
      )}" zu ${activity.data.new.join(", ")}`,
    };
  },
  partyTypeChanged: (activity) => {
    return {
      en: `Changed the type of the party from: "${activity.data.old}" to "${activity.data.new}"`,
      de: `Änderte die Art der Party von: "${activity.data.old}" zu "${activity.data.new}"`,
    };
  },
  partyPrivacyLevelChanged: (activity) => {
    return {
      en: `Changed the privacy level of the party from: "${activity.data.old}" to "${activity.data.new}"`,
      de: `Änderte die Privatsphäre Einstellung der Party von: "${activity.data.old}" zu "${activity.data.new}"`,
    };
  },
  partyLocationChanged: (activity) => {
    return {
      en: `Changed the location of the party from: "${activity.data.old.coordinates.join(
        ", "
      )}" to ${activity.data.new.coordinates.join(", ")}`,
      de: `Änderte den Standort der Party von: "${activity.data.old.coordinates.join(
        ", "
      )}" zu ${activity.data.new.coordinates.join(", ")}`,
    };
  },
  partyEntranceFeeTextChanged: (activity) => {
    return {
      en: `Changed the entrance fee text of the party from: "${activity.data.old}" to "${activity.data.new}"`,
      de: `Änderte den Eintrittsgebührentext der Party von: "${activity.data.old}" zu "${activity.data.new}"`,
    };
  },
  partyCapacityChanged: (activity) => {
    return {
      en: `Changed the capacity of the party from: "${activity.data.old}" to "${activity.data.new}"`,
      de: `Änderte die Kapazität der Party von: "${activity.data.old}" zu "${activity.data.new}"`,
    };
  },
  partyStartDateChanged: (activity) => {
    return {
      en: `Changed the start date of the party from: "${activity.data.old.toLocaleString(
        "en"
      )}" to ${activity.data.new.toLocaleString("en")}`,
      de: `Änderte das Startdatum der Party von: "${activity.data.old.toLocaleString(
        "de"
      )}" zu ${activity.data.new.toLocaleString("de")}`,
    };
  },
  partyEndDateChanged: (activity) => {
    return {
      en: `Changed the end date of the party from: "${activity.data.old.toLocaleString(
        "en"
      )}" to ${activity.data.new.toLocaleString("en")}`,
      de: `Änderte das Enddatum der Party von: "${activity.data.old.toLocaleString(
        "de"
      )}" zu ${activity.data.new.toLocaleString("de")}`,
    };
  },
  acceptedGuest: (activity) => {
    return {
      en: `Accepted guest: ${activity.data.guestName}`,
      de: `Akzeptierte den Gast: ${activity.data.guestName}`,
    };
  },
  declinedGuest: (activity) => {
    return {
      en: `Declined guest: ${activity.data.guestName}`,
      de: `Lehnte den Gast: ${activity.data.guestName} ab`,
    };
  },
  broadcastedMessage: (activity) => {
    return {
      en: `Broadcasted a message to ${
        activity.data.peopleCount
      } guests in team: ${activity.data.colorGroups.join(", ")}: "${
        activity.data.message
      }"`,
      de: `Versendete eine Nachricht an ${
        activity.data.peopleCount
      } Gäste im Team: ${activity.data.colorGroups.join(", ")}: "${
        activity.data.message
      }"`,
    };
  },
};
*/