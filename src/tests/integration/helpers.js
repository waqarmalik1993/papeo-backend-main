const expect = require("chai").expect;
const request = require("supertest");
const app = require("../../app.js").app;
const Bookmark = require("../../services/bookmarks/bookmarksService.js");
const PostComment = require("../../services/posts/comments/postCommentsService.js");
const EmailVerification = require("../../services/emailVerification/emailVerificationService.js");
const Follower = require("../../services/followers/followersService.js");
const Invite = require("../../services/invites/invitesService.js");
const Party = require("../../services/parties/partiesService.js");
const PartyGuest = require("../../services/partyGuests/partyGuestsService.js");
const Post = require("../../services/posts/postsService.js");
const Rating = require("../../services/ratings/ratingsService.js");
const Report = require("../../services/reports/reportsService.js");
const Swipe = require("../../services/swipes/swipesService.js");
const Upload = require("../../services/uploads/uploadsService.js");
const User = require("../../services/users/usersService.js");
const AdminLog = require("../../services/adminlogs/adminLogsService");
const Activity = require("../../services/activities/activitiesService");
const Payout = require("../../services/payouts/payoutsService");
const generateParty = require("./data/getRandomPartyData.js").generateParty;
const generateTicket = require("./data/getRandomTicketData").generateTicket;
const generateMenucard = require("./data/menucards/generateRandomMenucard").generateMenucard;
const TicketingTransactions = require("../../services/ticketing/ticketingTransactionService");
const UserTicket = require("../../services/ticketing/ticketingUserTicketService");
const WEBHOOK_CARDS_ENABLED = require("./data/ticketing/cardPaymentsEnabledWebhook");
const WEBHOOK_TRANSFERS_ENABLED = require("./data/ticketing/transfersEnabledWebhook");
const WEBHOOK_PAYMENT_INTENT_SUCCEEDED = require("./data/ticketing/paymentintentSucceeded");
const REAL_S3 = require("../../services/uploads/s3");
const mongoose = require("mongoose");
fs = require("fs");
const util = require("util");
const readFile = util.promisify(fs.readFile);
const createJWToken =
  require("../../services/users/usersService.js").createJWToken;
const generateUser = require("./data/getRandomUserData.js").generateUser;
const AWS = require("aws-sdk");
const s3Config = {
  region: process.env.REGION,
  endpoint: "localhost:4566",
  sslEnabled: false,
  s3ForcePathStyle: true,
  bucket: process.env.S3_BUCKET,
};

const S3 = new AWS.S3(s3Config);

exports.createUser = async (data) => {
  const user = await User.create(generateUser(data));
  user.TOKEN = createJWToken({
    _id: user._id.toString(),
  });
  return user;
};

exports.checkForSensitiveData = (data) => {
  if (!data) throw new Error("data not defined");
  const sensitiveKeys = ["tokens", "authPlatforms", "phoneNumber"];
  const str = JSON.stringify(data);
  for (const key of sensitiveKeys) {
    if (str.includes(key))
      throw new Error(`data containing sensitive data: ${key}`);
  }
};
exports.checkForSensitiveDataInOwnUser = (data) => {
  if (!data) throw new Error("data not defined");
  const sensitiveKeys = ["tokens"];
  const str = JSON.stringify(data);
  for (const key of sensitiveKeys) {
    if (str.includes(key))
      throw new Error(`data containing sensitive data: ${key}`);
  }
};

exports.wipeDatabaseAndEmptyS3Bucket = async () => {
  if (process.env.TEST !== "TRUE") throw new Error("You are not in Test-Mode");
  await Promise.allSettled([
    Activity.MODEL.deleteMany(),
    Bookmark.MODEL.deleteMany(),
    PostComment.MODEL.deleteMany(),
    EmailVerification.MODEL.deleteMany(),
    Follower.MODEL.deleteMany(),
    Invite.MODEL.deleteMany(),
    Party.MODEL.deleteMany(),
    PartyGuest.MODEL.deleteMany(),
    Post.MODEL.deleteMany(),
    Rating.MODEL.deleteMany(),
    Report.MODEL.deleteMany(),
    Swipe.MODEL.deleteMany(),
    Upload.MODEL.deleteMany(),
    User.MODEL.deleteMany(),
    AdminLog.MODEL.deleteMany(),
    Payout.MODEL.deleteMany(),
  ]);
  try {
    await S3.createBucket({
      Bucket: "papeo-test",
    }).promise();
    const res = await S3.listObjects({
      Bucket: "papeo-test",
    }).promise();
    await S3.deleteObjects({
      Bucket: "papeo-test",
      Delete: { Objects: res.Contents.map((c) => ({ Key: c.Key })) },
    }).promise();
  } catch {}
};

exports.getFeed = (user) => {
  return request(app)
    .post("/feed")
    .send({})
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};

exports.invitationsSearch = (user, partyId, queryParams = "") => {
  return request(app)
    .get(`/v2/invites/search?party=${partyId.toString() + queryParams}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.partiesSearch = (user, queryParams = "") => {
  return request(app)
    .get(`/parties/search?${queryParams}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};

exports.getUser = (user, userToGet) => {
  return request(app)
    .get(`/users/${userToGet._id.toString()}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.followUser = (user, userToFollow) => {
  return request(app)
    .post(`/users/${userToFollow._id.toString()}/followers`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.sendFriendRequest = (user, userToSendFriendRequestTo) => {
  return request(app)
    .post(`/users/${userToSendFriendRequestTo._id.toString()}/friends`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deleteFriend = (user, friendToDelete) => {
  return request(app)
    .delete(`/users/${friendToDelete._id.toString()}/friends`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.acceptFriendRequest = (user, userToAccept) => {
  return request(app)
    .post(`/users/${userToAccept._id.toString()}/friends/accept`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.getFriends = (user, userWithFriend) => {
  return request(app)
    .get(`/users/${userWithFriend._id.toString()}/friends`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.unfollowUser = (user, userToUnfollow) => {
  return request(app)
    .delete(`/users/${userToUnfollow._id.toString()}/followers`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.getFollowers = (user, userWithFollowers) => {
  return request(app)
    .get(`/users/${userWithFollowers._id.toString()}/followers`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.checkAvailability = (user, payload) => {
  return request(app)
    .post("/users/available")
    .set("Authorization", user.TOKEN)
    .send(payload)
    .expect("Content-Type", /json/);
};
exports.patchUser = (user, userToPatch, payload) => {
  return request(app)
    .patch(`/users/${userToPatch._id.toString()}`)
    .set("Authorization", user.TOKEN)
    .send(payload)
    .expect("Content-Type", /json/);
};
exports.patchPartyGuest = (user, partyGuest, partyId, payload) => {
  return request(app)
    .patch(`/parties/${partyId.toString()}/guests/${partyGuest._id.toString()}`)
    .set("Authorization", user.TOKEN)
    .send(payload)
    .expect("Content-Type", /json/);
};
exports.deletePartyGuest = (user, partyId) => {
  return request(app)
    .delete(`/parties/${partyId.toString()}/guests`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deleteUser = (user, userToDelete) => {
  return request(app)
    .delete(`/users/${userToDelete._id.toString()}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};

exports.getPartyGuests = (partyId, user) => {
  return request(app)
    .get(`/parties/${partyId.toString()}/guests`)
    .set("Authorization", user.TOKEN);
};
exports.getMyBookmarks = (user) => {
  return request(app)
    .get(`/bookmarks?user=${user._id.toString()}`)
    .set("Authorization", user.TOKEN);
};
exports.bookmarkParty = (partyId, user) => {
  return request(app)
    .post(`/parties/${partyId.toString()}/bookmarks`)
    .set("Authorization", user.TOKEN);
};
exports.deleteBookmark = (partyId, user) => {
  return request(app)
    .delete(`/parties/${partyId.toString()}/bookmarks`)
    .set("Authorization", user.TOKEN);
};
exports.joinParty = (partyId, user) => {
  return request(app)
    .post(`/parties/${partyId.toString()}/guests`)
    .set("Authorization", user.TOKEN);
};
exports.joinPartyWithInviteToken = (partyId, user, data) => {
  return request(app)
    .post(`/parties/${partyId.toString()}/guests`)
    .send(data)
    .set("Authorization", user.TOKEN);
};
exports.rateParty = (partyId, user, rating) => {
  return request(app)
    .post(`/parties/${partyId.toString()}/ratings`)
    .set("Authorization", user.TOKEN)
    .send({
      value: rating,
      comment: "top 🥳🎉",
    });
};
exports.deleteRating = (user, partyId, ratingId) => {
  return request(app)
    .delete(`/parties/${partyId.toString()}/ratings/${ratingId.toString()}`)
    .set("Authorization", user.TOKEN);
};
exports.getRatings = (partyId, user) => {
  return request(app)
    .get(`/parties/${partyId.toString()}/ratings`)
    .set("Authorization", user.TOKEN);
};
exports.patchRating = (party, user, ratingId, rating) => {
  return request(app)
    .patch(`/parties/${party}/ratings/${ratingId}`)
    .set("Authorization", user.TOKEN)
    .send({
      value: rating,
      comment: "top 🥳🎉",
    });
};

exports.createParty = (owner, party) => {
  const partyData = generateParty();
  return request(app)
    .post("/parties")
    .set("Authorization", owner.TOKEN)
    .send({ ...partyData, ...party })
    .expect("Content-Type", /json/);
};
exports.joinCompetition = (owner, partyId, competitionId) => {
  return request(app)
    .post(`/competitions/${competitionId.toString()}/join`)
    .set("Authorization", owner.TOKEN)
    .send({ party: partyId.toString() })
    .expect("Content-Type", /json/);
};
exports.createCompetition = (owner, data) => {
  return request(app)
    .post("/competitions")
    .set("Authorization", owner.TOKEN)
    .send(data)
    .expect("Content-Type", /json/);
};
exports.deleteParty = (partyId, user) => {
  return request(app)
    .delete(`/parties/${partyId.toString()}`)
    .set("Authorization", user.TOKEN);
};

exports.getUsersS3Uploads = async (user) => {
  const res = await S3.listObjects({
    Bucket: "papeo-test",
    Prefix: user._id.toString(),
  }).promise();
  return res.Contents;
};

exports.removeUpload = (user, uploadId) => {
  return request(app)
    .delete(`/uploads/${uploadId.toString()}`)
    .set("Authorization", user.TOKEN);
};
exports.removePost = (user, postId) => {
  return request(app)
    .delete(`/posts/${postId.toString()}`)
    .set("Authorization", user.TOKEN);
};
exports.createPost = (user, partyId, description, files) => {
  return request(app)
    .post("/uploads/posts")
    .send({
      party: partyId.toString(),
      description,
      uploads: files.map((f) => f._id),
    })
    .set("Authorization", user.TOKEN);
};
exports.createUserPost = (user, description, files) => {
  return request(app)
    .post("/uploads/posts")
    .send({
      description,
      uploads: files.map((f) => f._id),
    })
    .set("Authorization", user.TOKEN);
};
exports.updateMessage = (user, conversationId, messageId, file) => {
  return request(app)
    .post("/uploads/messages")
    .send({
      conversation: conversationId,
      message: messageId,
      upload: file._id.toString(),
    })
    .set("Authorization", user.TOKEN);
};
exports.createReport = (
  user,
  reportedParty,
  reportedUser,
  reportedPost,
  comment,
  files
) => {
  return request(app)
    .post("/uploads/reports")
    .send({
      reportedParty,
      reportedUser,
      reportedPost,
      uploads: files.map((f) => f._id),
    })
    .set("Authorization", user.TOKEN);
};
exports.deleteReport = (user, reportId) => {
  return request(app)
    .delete(`/reports/${reportId.toString()}`)
    .set("Authorization", user.TOKEN);
};
exports.listReports = (user, queryParams) => {
  return request(app)
    .get(`/reports?${queryParams ? queryParams : ""}`)
    .set("Authorization", user.TOKEN);
};
exports.uploadFilesToParty = (user, partyId, files) => {
  return request(app)
    .post(`/uploads/parties/${partyId.toString()}`)
    .send({
      uploads: files.map((f) => f._id),
    })
    .set("Authorization", user.TOKEN);
};
exports.changePartyUploadOrder = (user, partyId, newOrder) => {
  return request(app)
    .patch(`/parties/${partyId.toString()}/uploads/order`)
    .send(newOrder)
    .set("Authorization", user.TOKEN);
};
exports.setProfilePicture = (user, pic) => {
  return request(app)
    .patch("/uploads/profilepicture")
    .send({
      upload: pic._id.toString(),
    })
    .set("Authorization", user.TOKEN);
};
exports.setVerificationVideo = (user, file) => {
  return request(app)
    .post("/uploads/verification")
    .send({
      upload: file._id.toString(),
    })
    .set("Authorization", user.TOKEN);
};
exports.getUsersToVerify = (user) => {
  return request(app)
    .post("/users/verification")
    .set("Authorization", user.TOKEN);
};
exports.getAvailablePartyCount = (user) => {
  return request(app)
    .get(`/users/${user._id.toString()}/membership/availablepartycount`)
    .set("Authorization", user.TOKEN);
};
exports.voteForVerification = (user, userToVote, vote) => {
  return request(app)
    .post(`/users/${userToVote._id.toString()}/verification/vote`)
    .send({
      vote,
    })
    .set("Authorization", user.TOKEN);
};

exports.getPostComments = (user, postId) => {
  return request(app)
    .get(`/posts/${postId.toString()}/comments`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deletePostComment = (user, postId, commentId) => {
  return request(app)
    .delete(`/posts/${postId.toString()}/comments/${commentId.toString()}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deletePostCommentAdmin = (user, commentId, reason) => {
  return request(app)
    .post(`/admins/comments/${commentId.toString()}/delete`)
    .send({ reason })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.createPostComment = (user, postId, comment) => {
  return request(app)
    .post(`/posts/${postId.toString()}/comments`)
    .set("Authorization", user.TOKEN)
    .send({ comment })
    .expect("Content-Type", /json/);
};
exports.putPartyPointsConfig = (admin, config) => {
  return request(app)
    .put("/admins/partypointsconfig")
    .set("Authorization", admin.TOKEN)
    .send(config)
    .expect("Content-Type", /json/);
};

exports.createSwipe = (user, data) => {
  return request(app)
    .post("/swipes")
    .set("Authorization", user.TOKEN)
    .send(data)
    .expect("Content-Type", /json/);
};
exports.broadcastMessage = (user, party, body) => {
  return request(app)
    .post(`/parties/${party._id}/admins/broadcastmessage`)
    .set("Authorization", user.TOKEN)
    .send(body)
    .expect("Content-Type", /json/);
};
exports.calculateBroadcastMessageCost = (user, party, body) => {
  return request(app)
    .post(`/parties/${party._id}/admins/broadcastmessage/costs`)
    .set("Authorization", user.TOKEN)
    .send(body)
    .expect("Content-Type", /json/);
};
exports.createPartyAdmin = (
  user,
  partyId,
  adminUser,
  data = {
    rights: {
      canManageParty: true,
      canManageGuestlist: true,
      canManagePartyPhotos: true,
      canBroadcastMessages: true,
      canSeeAdminHistory: true,
    },
  }
) => {
  return request(app)
    .post(`/parties/${partyId.toString()}/admins/${adminUser._id.toString()}`)
    .set("Authorization", user.TOKEN)
    .send(data)
    .expect("Content-Type", /json/);
};
exports.patchPartyAdmin = (user, partyId, adminUser, data) => {
  return request(app)
    .patch(`/parties/${partyId.toString()}/admins/${adminUser._id.toString()}`)
    .set("Authorization", user.TOKEN)
    .send(data)
    .expect("Content-Type", /json/);
};
exports.patchParty = (user, partyId, data) => {
  return request(app)
    .patch(`/parties/${partyId.toString()}`)
    .set("Authorization", user.TOKEN)
    .send(data)
    .expect("Content-Type", /json/);
};
exports.deletePartyAdmin = (user, partyId, adminUser) => {
  return request(app)
    .delete(`/parties/${partyId.toString()}/admins/${adminUser._id.toString()}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.createPartyWith10PartyGuests = async (user) => {
  const party = (await this.createParty(user).expect(200)).body;
  const partyGuests = await Promise.all(
    new Array(10).fill(0).map(async () => {
      const user = await this.createUser();
      const partyGuest = await this.joinParty(party._id, user).expect(200);
      return {
        partyGuest: partyGuest.body._id.toString(),
        user: user._id.toString(),
      };
    })
  );
  return [party, partyGuests];
};
exports.postAuthenticate = (data) => {
  return request(app)
    .post("/users/authenticate")
    .send(data)
    .expect("Content-Type", /json/);
};

exports.inviteUsers = (user, partyId, users) => {
  return request(app)
    .post(`/parties/${partyId.toString()}/invites`)
    .set("Authorization", user.TOKEN)
    .send({ users: users.map((u) => u._id.toString()) })
    .expect("Content-Type", /json/);
};
exports.blockUser = (user, blockedUser) => {
  return request(app)
    .post(`/users/${blockedUser._id.toString()}/block`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.unblockUser = (user, blockedUser) => {
  return request(app)
    .delete(`/users/${blockedUser._id.toString()}/block`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.getPresignedUploadUrl = (user) => {
  return request(app)
    .get("/uploads/getPresignedUrl/")
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.createAdmin = (user, admin) => {
  return request(app)
    .post(`/admins/${admin._id.toString()}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.share = (user, userList, data) => {
  return request(app)
    .post("/share")
    .send({ ...data, userIds: userList.map((u) => u._id.toString()) })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.getAdmins = (user, query = "") => {
  return request(app)
    .get(`/admins?${query}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.patchAdmin = (user, admin, data) => {
  return request(app)
    .patch(`/admins/${admin._id.toString()}`)
    .set("Authorization", user.TOKEN)
    .send(data)
    .expect("Content-Type", /json/);
};
exports.mentionUser = (
  user,
  upload,
  mentionedUser,
  xPercent = 50,
  yPercent = 50
) => {
  return request(app)
    .post(
      `/uploads/${upload._id.toString()}/mentions/${mentionedUser._id.toString()}`
    )
    .set("Authorization", user.TOKEN)
    .send({ location: { xPercent, yPercent } })
    .expect("Content-Type", /json/);
};
exports.lockUser = (user, lockedUser, reason, messageToUser) => {
  return request(app)
    .post(`/admins/users/${lockedUser._id.toString()}/lock`)
    .set("Authorization", user.TOKEN)
    .send({ reason, messageToUser })
    .expect("Content-Type", /json/);
};
exports.unlockUser = (user, lockedUser, reason, messageToUser) => {
  return request(app)
    .delete(`/admins/users/${lockedUser._id.toString()}/lock`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deleteMention = (user, upload, mentionedUser) => {
  return request(app)
    .delete(
      `/uploads/${upload._id.toString()}/mentions/${mentionedUser._id.toString()}`
    )
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deleteUploadAdmin = (user, uploadId, reason) => {
  return request(app)
    .post(`/admins/uploads/${uploadId.toString()}/delete`)
    .send({ reason })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deleteArtistDescriptionAdmin = (user, userWithDescription, reason) => {
  return request(app)
    .post(
      `/admins/artists/${userWithDescription._id.toString()}/description/delete`
    )
    .send({ reason })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deleteUserDescriptionAdmin = (user, userWithDescription, reason) => {
  return request(app)
    .post(
      `/admins/users/${userWithDescription._id.toString()}/description/delete`
    )
    .send({ reason })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.hidePostAdmin = (user, post, reason) => {
  return request(app)
    .post(`/admins/posts/${post._id.toString()}/hide`)
    .send({ reason })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deletePostAdmin = (user, post, reason) => {
  return request(app)
    .post(`/admins/posts/${post._id.toString()}/delete`)
    .send({ reason })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.unhidePostAdmin = (user, post, reason) => {
  return request(app)
    .post(`/admins/posts/${post._id.toString()}/unhide`)
    .send({ reason })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.muteUser = (
  user,
  userToRestrict,
  restrictions,
  durationInMinutes = 60,
  messageToUser = "dsgt srznb rzgn dhn dhtndtz ",
  reason = " srtbhr stnbtr zntzn thzn tzhn dtzndtg ntdzhntdhzn thz nh"
) => {
  return request(app)
    .post(`/admins/users/${userToRestrict._id.toString()}/mute`)
    .send({ reason, messageToUser, restrictions, durationInMinutes })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.unmuteUser = (user, userToUnRestrict, restrictionIds) => {
  return request(app)
    .post(`/admins/users/${userToUnRestrict._id.toString()}/unmute`)
    .send({ restrictionIds })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};

exports.createMyPartyGuest = (user, myPartyGuest) => {
  return request(app)
    .post("/users/mypartyguests")
    .send({
      guest: myPartyGuest._id.toString(),
    })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.patchMyPartyGuest = (user, myPartyGuest, data) => {
  return request(app)
    .patch(`/users/mypartyguests/${myPartyGuest._id}`)
    .send(data)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.changeProfileBanner = (user, userToPatch, data) => {
  return request(app)
    .put(`/users/${userToPatch._id}/profilebanner`)
    .send(data)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deleteProfileBanner = (user, userToPatch) => {
  return request(app)
    .delete(`/users/${userToPatch._id}/profilebanner`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deleteMyPartyGuest = (user, myPartyGuest) => {
  return request(app)
    .delete(`/users/mypartyguests/${myPartyGuest._id}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};

//#region Ticketing
exports.ticketing = {};
exports.ticketing.getShopOnboardUrl = (user) => {
  return request(app)
    .get("/ticketing/shops/onboard")
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.ticketing.getMyStripeAccount = (user) => {
  return request(app)
    .get("/ticketing/shops/myaccount")
    .set("Authorization", user.TOKEN);
  //.expect("Content-Type", /json/);
};
exports.ticketing.createTicket = (user, ticket) => {
  const ticketData = generateTicket();
  return request(app)
    .post("/ticketing/tickets")
    .send({ ...ticketData, ...ticket })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.ticketing.patchTicket = (user, ticket, data) => {
  return request(app)
    .patch(`/ticketing/tickets/${ticket._id}`)
    .send(data)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.ticketing.getTickets = (user, party, query = "") => {
  return request(app)
    .get(`/ticketing/parties/${party._id}/tickets?${query}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.ticketing.getTicketPrice = (user, { net, taxPerMille }) => {
  return request(app)
    .post("/ticketing/tickets/calculateprice")
    .send({ net, taxPerMille })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
const stripe = require("stripe");
exports.ticketing.sendWebhook = (data) => {
  const payloadString = JSON.stringify(data);
  const secret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET_TICKETING;
  const header = stripe.webhooks.generateTestHeaderString({
    payload: payloadString,
    secret,
  });
  return (
    request(app)
      .post("/ticketing/webhooks")
      .set("stripe-signature", header)
      //.buffer(payloadString)
      .send(data)
  );
};
exports.ticketing.sendConnectWebhook = (data) => {
  const payloadString = JSON.stringify(data);
  const secret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET_TICKETING;
  const header = stripe.webhooks.generateTestHeaderString({
    payload: payloadString,
    secret,
  });
  return (
    request(app)
      .post("/ticketing/webhooks/connect")
      .set("stripe-signature", header)
      //.buffer(payloadString)
      .send(data)
  );
};
exports.ticketing.getTicketingShop = (user, ticketingShopId) => {
  return request(app)
    .get(`/ticketing/shops/${ticketingShopId}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.ticketing.createTicketingShopWithTicket = async (
  user,
  partyData = {},
  ticketData = {}
) => {
  const url = await this.ticketing.getShopOnboardUrl(user).expect(200);
  const stripeAccountId = url.body.stripeAccountId;

  await this.ticketing
    .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
    .expect(200);
  await this.ticketing
    .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
    .expect(200);
  const party = await this.createParty(user, partyData).expect(200);
  const ticket = await this.ticketing
    .createTicket(user, { ...ticketData, party: party.body._id })
    .expect(200);

  return [
    party.body,
    ticket.body,
    (
      await this.ticketing
        .getTicketingShop(user, ticket.body.ticketingShop)
        .expect(200)
    ).body,
  ];
};
exports.ticketing.createTicketingShopWithTicketAndBuyTicket = async (
  user,
  buingUser,
  partyData = {}
) => {
  const url = await this.ticketing.getShopOnboardUrl(user).expect(200);
  const stripeAccountId = url.body.stripeAccountId;

  await this.ticketing
    .sendConnectWebhook(WEBHOOK_CARDS_ENABLED(stripeAccountId))
    .expect(200);
  await this.ticketing
    .sendConnectWebhook(WEBHOOK_TRANSFERS_ENABLED(stripeAccountId))
    .expect(200);
  const party = await this.createParty(user, partyData).expect(200);
  const ticket = await this.ticketing
    .createTicket(user, {
      party: party.body._id,
    })
    .expect(200);
  await this.ticketing
    .purchaseTickets(buingUser, [
      {
        ticketId: ticket.body._id,
        quantity: 1,
      },
    ])
    .expect(200);
  let transactions = await TicketingTransactions.MODEL.find({
    user: buingUser._id,
  });
  const ticketingShop = (
    await this.ticketing
      .getTicketingShop(user, ticket.body.ticketingShop)
      .expect(200)
  ).body;
  // send paymentintent.successfull webhook
  await this.ticketing
    .sendConnectWebhook(
      WEBHOOK_PAYMENT_INTENT_SUCCEEDED({
        accountId: ticketingShop.stripeAccountId,
        transactionId: transactions[transactions.length - 1]._id.toString(),
      })
    )
    .expect(200);
  let [userTicket] = await UserTicket.MODEL.find({
    user: buingUser._id,
    party: party.body._id,
  });
  return [party.body, ticket.body, ticketingShop, userTicket];
};
exports.ticketing.purchaseTickets = (user, orders) => {
  return request(app)
    .post("/ticketing/tickets/purchase")
    .send({ orders })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.ticketing.deleteTicket = (user, ticket) => {
  return request(app)
    .delete(`/ticketing/tickets/${ticket._id}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.ticketing.cancelParty = (user, party, message) => {
  return request(app)
    .post("/ticketing/cancelparty")
    .send({ party: party._id.toString(), message: message })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.ticketing.shareUserTicket = (user, userTicket, receipient) => {
  return request(app)
    .patch(`/ticketing/usertickets/${userTicket._id}`)
    .send({ sharedWith: receipient._id.toString() })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.ticketing.declineSharedUserTicket = (user, userTicket) => {
  return request(app)
    .patch(`/ticketing/usertickets/${userTicket._id}`)
    .send({ sharedWith: null })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.ticketing.acceptSharedUserTicket = (user, userTicket) => {
  return request(app)
    .patch(`/ticketing/usertickets/${userTicket._id}`)
    .send({ user: user._id.toString() })
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.ticketing.scanUserTicket = (user, userTicket) => {
  return request(app)
    .post("/ticketing/usertickets/checkin")
    .set("Authorization", user.TOKEN)
    .send({ qrCodeValue: userTicket.qrCodeValue, party: userTicket.party })
    .expect("Content-Type", /json/);
};
exports.menucard = {};
exports.menucard.createMenucard = (user, menucard = {}) => {
  const menuCard = generateMenucard(menucard);
  return request(app)
    .post("/menucards")
    .set("Authorization", user.TOKEN)
    .send(menuCard)
    .expect("Content-Type", /json/);
};
exports.menucard.orderFromMenucard = (user, menuCard, order) => {
  return request(app)
    .post(`/menucards/${menuCard._id}/order`)
    .set("Authorization", user.TOKEN)
    .send(order)
    .expect("Content-Type", /json/);
};
exports.menucard.acceptOrder = (user, menuCard) => {
  return request(app)
    .patch(`/menucardorders/${menuCard._id}/status`)
    .set("Authorization", user.TOKEN)
    .send({ status: "successful" })
    .expect("Content-Type", /json/);
};
// #endregion
exports.loginAsUser = (admin, user, data) => {
  return request(app)
    .post(`/admins/users/${user._id}/gettoken`)
    .send(data)
    .set("Authorization", admin.TOKEN)
    .expect("Content-Type", /json/);
};

exports.getReferralTree = (user, query = "") => {
  return request(app)
    .get(`/referraltree?${query}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};

exports.createPayout = (user, payout) => {
  return request(app)
    .post("/payouts")
    .send(payout)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.patchPayout = (user, payout, data) => {
  return request(app)
    .patch(`/payouts/${payout._id}`)
    .send(data)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.getPayouts = (user, query) => {
  return request(app)
    .patch(`/payouts?${query}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.createNewsletter = (user, newsletter) => {
  return request(app)
    .post("/newsletter")
    .send(newsletter)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.publishNewsletter = (user, newsletter) => {
  return request(app)
    .post(`/newsletter/${newsletter._id}/publish`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.patchNewsletter = (user, newsletter, data) => {
  return request(app)
    .patch(`/newsletter/${newsletter._id}`)
    .send(data)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.getNewsletter = (user, newsletterId) => {
  return request(app)
    .get(`/newsletter/${newsletterId}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};
exports.deleteNewsletter = (user, newsletter) => {
  return request(app)
    .delete(`/newsletter/${newsletter._id}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};

exports.defaultAdminRights = {
  manageUserProfiles: false,
  manageUserLinks: false,
  muteUser: false,
  lockUser: false,
  advancedMemberSearch: false,
  deleteRating: false,
  deleteUserFinally: false,
  manageMedia: false,
  manageComments: false,
  manageParties: false,
  inviteGuestsToParties: false,
  managePartyPoints: false,
  manageMembership: false,
  editTranslation: false,
  changeTC: false,
  manageMainMenu: false,
  rateVideoIdent: false,
  manageViolationReports: false,
  viewStatistics: false,
  viewAdminLog: false,
  manageAdmins: false,
  canSeeSecretParties: false,
  loginAsUser: false,
  createUserProfiles: false,
};

exports.createPartyStaff = (
  user,
  party,
  staffUser,
  data = {
    rights: {
      canScanTickets: true,
      canScanOrders: true,
    },
  }
) => {
  return request(app)
    .post(`/parties/${party._id.toString()}/staff`)
    .set("Authorization", user.TOKEN)
    .send([{ ...data, user: staffUser._id.toString() }])
    .expect("Content-Type", /json/);
};
exports.patchPartyStaff = (user, party, staffUser, data) => {
  return request(app)
    .patch(`/parties/${party._id.toString()}/staff/${staffUser._id}`)
    .set("Authorization", user.TOKEN)
    .send(data)
    .expect("Content-Type", /json/);
};
exports.deletePartyStaff = (user, party, staffUser) => {
  return request(app)
    .delete(`/parties/${party._id.toString()}/staff/${staffUser._id}`)
    .set("Authorization", user.TOKEN)
    .expect("Content-Type", /json/);
};

const uploadProfilePic = async (user) => {
  return await uploadFile(user, randomProfilePicture());
};
exports.uploadProfilePic = uploadProfilePic;
const uploadVerificationVideo = async (user) => {
  return await uploadFile(user, randomVideo());
};
exports.uploadVerificationVideo = uploadVerificationVideo;

const uploadPartyPic = async (user) => {
  return await uploadFile(user, randomPartyPicture());
};
exports.uploadPartyPic = uploadPartyPic;

const uploadPartyHeader = async (user) => {
  return await uploadFile(user, randomPartyHeaderPicture());
};
exports.uploadPartyHeader = uploadPartyHeader;
const uploadFile = async (user, path) => {
  const id = mongoose.Types.ObjectId();
  const key = `${user._id.toString()}/${id.toString()}`;
  const file = await readFile(path);

  await REAL_S3.uploadObject(process.env.S3_BUCKET, key, file, "image/jpeg");

  const upload = await Upload.create({
    _id: id,
    done: true,
    user: user._id.toString(),
    path: `https://${process.env.S3_BUCKET}.s3.eu-central-1.amazonaws.com/${key}`,
    key,
    bucket: process.env.S3_BUCKET,
  });

  return upload;
};
const randomProfilePicture = () =>
  `${__dirname}/data/images/profilePictures/${Math.floor(
    Math.random() * 92
  )}.jpg`;
const randomPartyPicture = () =>
  `${__dirname}/data/images/partyPictures/${Math.floor(
    Math.random() * 18
  )}.jpg`;
const randomPartyHeaderPicture = () =>
  `${__dirname}/data/images/partyHeaders/${Math.floor(Math.random() * 33)}.jpg`;
const randomVideo = () => `${__dirname}/data/videos/video.mp4`;

exports.getDatePlusHours = (hours) => {
  const date = new Date();
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return date;
};
exports.getDatePlusMinutes = (minutes) => {
  const date = new Date();
  date.setTime(date.getTime() + minutes * 60 * 1000);
  return date;
};
