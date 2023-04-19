const service = require("feathers-mongoose");
const User = require("../users/usersService.js");
const Upload = require("../uploads/uploadsService.js");
const PartyGuests = require("../partyGuests/partyGuestsService");
const Party = require("../parties/partiesService");

const Model = require("../../models/competitions.model.js");

const papeoError = require("../../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../../modules/errors/errors.js").PAPEO_ERRORS;

const mongoose = require("mongoose");

const Activity = require("../activities/activitiesService");
const {
  createActivityTargetGroup,
} = require("../activities/createActivityTargetGroup.js");
const {
  getGuestListUserIds,
  getBookmarkedPartyUserIds,
} = require("../activities/helper/getTargetGroup.js");
const options = {
  Model: Model(),
  paginate: {
    default: 10,
    max: 1000,
  },
  multi: ["patch"],
  whitelist: [
    "$populate",
    "$regex",
    "$options",
    "$geoWithin",
    "$centerSphere",
    "$geometry",
    "$near",
    "$maxDistance",
    "$minDistance",
    "$nearSphere",
    "$geoNear",
  ],
};

let MODEL = options.Model;
exports.MODEL = options.Model;

const get = async (id, params) => {
  let result = await service(options).get(id, params);
  return result;
};

const find = async (query) => {
  let result = await service(options).find(query);
  return result;
};

const create = async (data) => {
  return await service(options).create(data);
};

const patch = async (id, data) => {
  let result = await service(options).patch(id, data);
  return result;
};
const remove = async (id) => {
  const partiesInCompetition = await Party.MODEL.find({ competition: id });
  if (partiesInCompetition.length > 0) {
    await Promise.all(
      partiesInCompetition.map((party) => removePartyFromCompetition(party._id))
    );
  }
  let result = await service(options).remove(id);
  return result;
};
const isPartyInCompetitionDateRange = (competition, party) => {
  // TODO 5 minutes before competition ends return false
  return (
    party.startDate < competition.endDate &&
    party.calculatedEndDate > competition.startDate
  );
};
exports.isPartyInCompetitionDateRange = isPartyInCompetitionDateRange;

const addPartyToCompetition = async (partyId, competitionId) => {
  const partyGuests = await PartyGuests.MODEL.find({ party: partyId });
  // set isNewUser flag for all partyguests and update user object
  await Promise.all(
    partyGuests.map(async (pg) => {
      const user = await User.get(pg.user);
      if (!user.attendedCompetitionParty) {
        await User.patch(user._id, {
          attendedCompetitionParty: partyId,
        });
        await PartyGuests.patch(pg._id, {
          isNewUser: true,
        });
      }
    })
  );
  return await Party.patch(partyId, {
    competition: competitionId,
  });
};
exports.addPartyToCompetition = addPartyToCompetition;

const removePartyFromCompetition = async (partyId) => {
  const partyGuests = await PartyGuests.MODEL.find({ party: partyId });
  // set isNewUser flag for all partyguests and update user object
  const party = await Party.get(partyId);
  const competition = await this.get(party.competition);
  let resetNewUser = true;
  if (competition.endDate < new Date()) resetNewUser = false;
  await Promise.allSettled(
    partyGuests.map(async (pg) => {
      const user = await User.get(pg.user);
      if (user.attendedCompetitionParty.toString() === partyId.toString()) {
        if (resetNewUser) {
          await User.patch(user._id, {
            attendedCompetitionParty: null,
          });
        }
        await PartyGuests.patch(pg._id, {
          isNewUser: false,
        });
      }
    })
  );
  return await Party.patch(partyId, {
    competition: null,
  });
};
exports.removePartyFromCompetition = removePartyFromCompetition;

const closeCompetition = async (competition) => {
  console.log(`closing competition ${competition._id}`);
  const parties = await getSortedPartiesByCompetitionId(competition._id);
  await this.patch(competition._id, {
    expired: true,
    result: {
      parties,
      winnerParty: parties.length > 0 ? parties[0]._id : null,
    },
  });
  console.log(parties);
  await Promise.all(
    parties.map(async (party, index) => {
      return await createActivityTargetGroup({
        type: "competitionClosedPartyRanked",
        targetGroups: {
          parties: [
            await getGuestListUserIds(party._id),
            party.owner._id ? party.owner._id : party.owner,
          ],
        },
        parties: [party._id],
        additionalInformation: {
          ranking: index + 1,
        },
        competitions: [competition._id],
        sendNotification: true,
        otherUsers: [competition.owner],
      });
    })
  );
};
exports.closeCompetition = closeCompetition;
const getSortedPartiesByCompetitionId = async (competitionId) => {
  const competition = await get(competitionId);
  if (competition.result) return competition.result.parties;
  let parties = await Party.MODEL.find({
    competition: competition._id,
  }).lean();
  parties = await Promise.all(
    parties.map(async (p) => {
      return {
        ...p,
        owner: await User.get(p.owner),
        uploads: await Promise.all(p.uploads.map((u) => Upload.get(u))),
        newUserCount: await PartyGuests.getNewUserCount(p._id),
        newOnSiteUserCount: await PartyGuests.getNewUserCountOnsite(p._id),
      };
    })
  );
  function sortByNewUserCount(party1, party2) {
    if (party2.newUserCount === 0 && party1.newUserCount === 0) {
      return party2.newUserCount - party1.newUserCount;
    }
    return party2.newOnSiteUserCount - party1.newOnSiteUserCount;
  }
  parties = parties.sort(sortByNewUserCount);
  return parties;
};
exports.getSortedPartiesByCompetitionId = getSortedPartiesByCompetitionId;

const sendOnSiteReminder = async (competition) => {
  if (competition.sendOnSiteReminder) return;
  let parties = await Party.MODEL.find({
    competition: competition._id,
  }).lean();
  await patch(competition._id, { sendOnSiteReminder: true });
  await Promise.all(
    parties.map(async (party) => {
      return await createActivityTargetGroup({
        type: "competitionOnSiteReminder",
        targetGroups: {
          parties: [
            await getGuestListUserIds(party._id),
            await getBookmarkedPartyUserIds(party._id),
            party.owner._id ? party.owner._id : party.owner,
          ],
        },
        parties: [party._id],
        competitions: [competition._id],
        sendNotification: true,
        otherUsers: [competition.owner],
      });
    })
  );
};
exports.sendOnSiteReminder = sendOnSiteReminder;
/*
const addUpload = async (competitionId, uploadId) => {
  return await patch(competitionId, {
    $addToSet: {
      uploads: uploadId,
    },
  });
};

const removeUpload = async (competitionId, uploadId) => {
  console.log("removing uploaded file:", uploadId);
  return await patch(competitionId, {
    $pull: {
      uploads: uploadId,
    },
  });
};
*/
exports.get = get;
exports.find = find;
exports.create = create;
exports.patch = patch;
exports.remove = remove;
/*
exports.addUpload = addUpload;
exports.removeUpload = removeUpload;
*/
