const {
  papeoError,
  PAPEO_ERRORS,
} = require("../../../../modules/errors/errors");
const User = require("../../usersService");
const Party = require("../../../parties/partiesService");
const {
  getPartyPointsConfig,
} = require("../../../configuration/configurationsService");

const canPublishParty = async (user, partyType, partyPrivacyLevel) => {
  const availableParties = await getNumberOfAvailableParties(user);
  console.log({ pp: user.partyPoints });
  if (partyType === "private" && partyPrivacyLevel === "secret") {
    if (availableParties.secretPartyCreationWillCost === 0) {
      return { result: true, cost: 0 };
    }
    return {
      result: user.partyPoints >= availableParties.secretPartyCreationWillCost,
      cost: availableParties.secretPartyCreationWillCost,
    };
  }
  if (partyType === "private") {
    if (availableParties.privatePartyCreationWillCost === 0) {
      return { result: true, cost: 0 };
    }
    return {
      result: user.partyPoints >= availableParties.privatePartyCreationWillCost,
      cost: availableParties.privatePartyCreationWillCost,
    };
  }
  if (partyType === "commercial") {
    if (availableParties.commercialPartyCreationWillCost === 0) {
      return { result: true, cost: 0 };
    }
    return {
      result:
        user.partyPoints >= availableParties.commercialPartyCreationWillCost,
      cost: availableParties.commercialPartyCreationWillCost,
    };
  }
  throw new Error(`partyType: ${partyType} not recognized`);
};
exports.canPublishParty = canPublishParty;
const getNumberOfAvailableParties = async (user) => {
  const PARTY_POINTS_CONFIG = await getPartyPointsConfig();
  const STANDARD_MEMBER = {
    MAX_SECRET_PARTIES: 1,
    MAX_PRIVATE_PARTIES: 2,
    MAX_COMMERCIAL_PARTIES: 1,
    MAX_PARTIES: 3,
    PARTY_COST: PARTY_POINTS_CONFIG.createAdditionalParties.noPartyKing,
  };
  const PARTY_KING_MEMBER = {
    MAX_SECRET_PARTIES: null,
    MAX_PRIVATE_PARTIES: null,
    MAX_COMMERCIAL_PARTIES: null,
    MAX_PARTIES: 10,
    PARTY_COST: PARTY_POINTS_CONFIG.createAdditionalParties.partyKing,
  };
  const parties = await Party.getActivePartiesFromUser(user._id);
  const privateParties = parties.filter(
    (p) => p.type === "private" && p.privacyLevel !== "secret"
  );
  const commercialParties = parties.filter((p) => p.type === "commercial");
  const secretParties = parties.filter(
    (p) => p.privacyLevel === "secret" && p.type === "private"
  );

  function calculate(config) {
    const availablePrivateParties = config.MAX_PRIVATE_PARTIES
      ? config.MAX_PRIVATE_PARTIES - privateParties.length
      : config.MAX_PARTIES - parties.length;
    const availableCommercialParties = config.MAX_COMMERCIAL_PARTIES
      ? config.MAX_COMMERCIAL_PARTIES - commercialParties.length
      : config.MAX_PARTIES - parties.length;
    const availableSecretParties = config.MAX_SECRET_PARTIES
      ? config.MAX_SECRET_PARTIES - secretParties.length
      : config.MAX_PARTIES - parties.length;

    const availableTotal = config.MAX_PARTIES - parties.length;
    const partyPointsAreSufficientToCreateParty =
      user.partyPoints >= config.PARTY_COST;
    const costOfParty = config.PARTY_COST;
    const privatePartyCreationWillCost =
      availablePrivateParties > 0 ? 0 : costOfParty;
    const commercialPartyCreationWillCost =
      availableCommercialParties > 0 ? 0 : costOfParty;
    const secretPartyCreationWillCost =
      availableSecretParties > 0 ? 0 : costOfParty;
    return {
      availablePrivateParties,
      availableCommercialParties,
      availableSecretParties,
      availableTotal,
      partyPointsAreSufficientToCreateParty,
      costOfParty,
      privatePartyCreationWillCost,
      commercialPartyCreationWillCost,
      secretPartyCreationWillCost,
    };
  }
  if (user.isPartyKing) {
    return calculate(PARTY_KING_MEMBER);
  }
  return calculate(STANDARD_MEMBER);
};
exports.getNumberOfAvailableParties = getNumberOfAvailableParties;
