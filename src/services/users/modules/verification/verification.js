const {
  papeoError,
  PAPEO_ERRORS,
} = require("../../../../modules/errors/errors");
const User = require("../../usersService");
const Upload = require("../../../uploads/uploadsService");
const AdminLog = require("../../../adminlogs/adminLogsService");
const PartyGuest = require("../../../partyGuests/partyGuestsService");
const VOTE_TRUE_TRESHOLD = 0.9;
const VOTE_FALSE_TRESHOLD = 0.9;
const MINIMUM_VOTE_COUNT = 100;
const Activity = require("../../../activities/activitiesService");
const {
  getFriendIdsFromUser,
  getFollowerIdsFromUser,
} = require("../../../activities/helper/getTargetGroup");
const {
  createActivityTargetGroup,
} = require("../../../activities/createActivityTargetGroup");
const USERS_VOTE_IS_VALID = {
  MIN_NUMBER_VOTES: 5,
  MIN_PERCENTAGE_CORRECT_VOTES: 0.9,
};

const voteForUser = async (votingUser, votedUser, vote) => {
  if (votingUser._id.toString() === votedUser._id.toString()) {
    throw papeoError(PAPEO_ERRORS.YOU_CANNOT_VOTE_FOR_YOURSELF);
  }
  if (votedUser.verification.verified) {
    throw papeoError(PAPEO_ERRORS.USER_IS_ALREADY_VERIFIED);
  }
  if (!votedUser.verification.upload) {
    throw papeoError(PAPEO_ERRORS.USER_IS_HAS_NO_VERIFICATION_VIDEO);
  }
  if (
    votedUser.verification.votes.find(
      (v) => v.from.toString() === votingUser._id.toString()
    )
  ) {
    throw papeoError(PAPEO_ERRORS.YOU_ALREADY_VOTED_FOR_THIS_USER);
  }
  const result = await User.patch(votedUser._id, {
    $push: {
      "verification.votes": {
        from: votingUser._id,
        outcome: vote,
        isCounted: !!votingUser.verification.voted?.votesAreCounted,
      },
    },
  });
  if (User.hasAdminRightsTo(votingUser, User.adminRights.rateVideoIdent)) {
    if (vote === true) {
      await verifyUser(votedUser);
    }
    if (vote === false) {
      await deleteVerificationVideoAndNotVerifyUser(votedUser);
    }
    await AdminLog.TYPES.votedForUser({
      userId: votingUser._id,
      votedUser: votedUser,
      vote,
    });
  }
  const outcome = checkOutcome(result);
  console.log({ outcome });
  if (outcome === null) return;
  if (outcome === true) await verifyUser(votedUser);
  if (outcome === false) {
    await deleteVerificationVideoAndNotVerifyUser(votedUser);
  }
};
exports.voteForUser = voteForUser;

const calculateVotePercentage = (validVotes) => {
  const correctPercentage =
    validVotes.filter((v) => v.outcome).length / validVotes.length;
  return {
    correct: parseFloat(correctPercentage.toPrecision(2)),
    incorrect: parseFloat((1 - correctPercentage).toPrecision(2)),
  };
};
const checkOutcome = (votedUser) => {
  const validVotes = votedUser.verification.votes.filter((v) => v.isCounted);
  console.log({ validVoteCount: validVotes.length });
  if (validVotes.length < MINIMUM_VOTE_COUNT) return null;
  const percentages = calculateVotePercentage(validVotes);
  console.log({ percentages });
  if (percentages.correct >= VOTE_TRUE_TRESHOLD) return true;
  if (percentages.incorrect >= VOTE_FALSE_TRESHOLD) return false;
};

const verifyUser = async (votedUser) => {
  await PartyGuest.MODEL.updateMany(
    { user: votedUser._id },
    { isUserVerified: true }
  );
  const verifiedUser = await User.patch(votedUser._id, {
    "verification.verified": true,
  });
  await Activity.create({
    user: votedUser._id,
    notificationCategories: ["myProfileActivity"],
    type: "userIsNowVerified",
    otherUsers: [votedUser._id],
    sendNotification: true,
  });
  await createActivityTargetGroup({
    type: "userIsNowVerified",
    otherUsers: [votedUser._id],
    targetGroups: {
      friends: await getFriendIdsFromUser(votedUser),
      following: await getFollowerIdsFromUser(votedUser._id),
    },
    sendNotification: true,
  });
  await handleVotes(verifiedUser.verification.votes, true);
};
const deleteVerificationVideoAndNotVerifyUser = async (votedUser) => {
  await handleVotes(votedUser.verification.votes, false);
  // Upload.remove handles verification logic
  await Upload.remove(votedUser.verification.upload);
  await Activity.create({
    user: votedUser._id,
    notificationCategories: ["myProfileActivity"],
    type: "identVideoWasDeclined",
    otherUsers: [votedUser._id],
    sendNotification: true,
  });
};
const setUserCanVote = (user, canVote) => {
  console.log(`${user._id} votesAreCounted: ${canVote}`);
  return User.patch(user._id, {
    "verification.voted.votesAreCounted": canVote,
  });
};
const calculateAndPatchCanVote = async (user) => {
  const count =
    user.verification.voted.correct + user.verification.voted.incorrect;
  const percentCorrect = parseFloat(
    (user.verification.voted.correct / count).toPrecision(2)
  );
  if (
    percentCorrect >= USERS_VOTE_IS_VALID.MIN_PERCENTAGE_CORRECT_VOTES &&
    count >= USERS_VOTE_IS_VALID.MIN_NUMBER_VOTES
  ) {
    return await setUserCanVote(user, true);
  }
  return await setUserCanVote(user, false);
};
const handleVotes = async (votes, outcome) => {
  const correctVotes = votes.filter((v) => v.outcome === outcome);
  const incorrectVotes = votes.filter((v) => v.outcome !== outcome);
  const usersThatVoted = await Promise.all([
    ...correctVotes.map((cv) => {
      return User.patch(cv.from, {
        $inc: {
          "verification.voted.correct": 1,
        },
      });
    }),
    ...incorrectVotes.map((cv) => {
      return User.patch(cv.from, {
        $inc: {
          "verification.voted.incorrect": 1,
        },
      });
    }),
  ]);
  await Promise.all(
    usersThatVoted.map((u) => {
      return calculateAndPatchCanVote(u);
    })
  );
};

exports.getUsersToVerify = async (votingUser, exclude = [], firstUserId) => {
  const users = await User.find({
    query: {
      "verification.verified": false,
      "verification.upload": { $ne: null },
      _id: { $nin: [votingUser._id, ...exclude] },
      "verification.votes.from": { $nin: [votingUser._id] },
    },
  });
  if (firstUserId) {
    const firstUser = await User.get(firstUserId);
    if (firstUser.verification?.upload) {
      users.data = [
        firstUser,
        ...users.data.filter((u) => u._id.toString() !== firstUserId),
      ];
    }
  }
  return users;
};
