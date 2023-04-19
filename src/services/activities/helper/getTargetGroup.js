const Follower = require("../../followers/followersService.js");
const PostComment = require("../../posts/comments/postCommentsService");
const PartyGuest = require("../../partyGuests/partyGuestsService");
const Party = require("../../parties/partiesService");
const Bookmark = require("../../bookmarks/bookmarksService");
const User = require("../../users/usersService");

//Alle Freunde von Nutzern
exports.getFriendIdsFromUser = (user) => {
  let resultArray = [];
  if (user?.partyFriends?.length) {
    user.partyFriends.forEach((element) => {
      if (element.status === "accepted") {
        resultArray.push(element.friend.toString());
      }
    });
  }
  return resultArray;
};

exports.getPartyAdmins = async (party) => {
  let resultArray = [];
  party.admins.forEach((admin) => {
    resultArray.push(admin.user);
  });
  return resultArray;
};

//Alle Follower von Nutzern
exports.getFollowerIdsFromUser = async (userId) => {
  let resultArray = [];
  const results = await Follower.MODEL.find({
    followedUser: userId,
  });
  results.forEach((element) => {
    resultArray.push(element.user.toString());
  });
  return resultArray;
};

//alle die einen Post kommentiert haben
exports.getPostCommentUserIds = async (postId) => {
  let resultArray = [];
  let results = await PostComment.MODEL.find({
    post: postId,
  });
  results.forEach((element) => {
    resultArray.push(element.user.toString());
  });
  return resultArray;
};

//Benutzer auf der Gästeliste
exports.getGuestListUserIds = async (partyId) => {
  let resultArray = [];
  let results = await PartyGuest.MODEL.find({
    status: "attending",
    party: partyId,
  });
  results.forEach((element) => {
    resultArray.push(element.user.toString());
  });
  return resultArray;
};

//Benutzer die sich die Party gemerkt haben
exports.getBookmarkedPartyUserIds = async (partyId) => {
  let resultArray = [];
  let results = await Bookmark.MODEL.find({
    party: partyId,
  });
  results.forEach((element) => {
    resultArray.push(element.user.toString());
  });
  return resultArray;
};

//Benutzer auf der Gäste- oder Warteliste der Party
exports.getGuestWaitingPartyUserIds = async (partyId) => {
  let resultArray = [];
  let results = await PartyGuest.MODEL.find({
    $or: [
      {
        status: "attending",
      },
      {
        status: "requested",
      },
    ],
    party: partyId,
  });
  results.forEach((element) => {
    resultArray.push(element.user.toString());
  });
  return resultArray;
};

//Benutzer Warteliste einer Party
exports.getWaitingPartyUserIds = async (partyId) => {
  let resultArray = [];
  let results = await PartyGuest.MODEL.find({
    status: "requested",
    party: partyId,
  });
  results.forEach((element) => {
    resultArray.push(element.user.toString());
  });
  return resultArray;
};

exports.getAllAdmins = async () => {
  let resultArray = [];
  let results = await User.MODEL.find({
    isAdmin: true,
  });
  results.forEach((element) => {
    resultArray.push(element._id.toString());
  });
  return resultArray;
};
exports.getAllSuperAdmins = async () => {
  let resultArray = [];
  let results = await User.MODEL.find({
    isSuperAdmin: true,
  });
  results.forEach((element) => {
    resultArray.push(element._id.toString());
  });
  return resultArray;
};

exports.getAllUsers = async () => {
  let results = await User.MODEL.find({}, "_id");
  return results.map((e) => e._id.toString());
};
