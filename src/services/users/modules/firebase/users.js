const admin = require("firebase-admin");
const User = require("../../usersService");
const firebaseAdminConfig = require(`../../../../credentials/papeo-firebase-adminsdk-${
  process.env.STAGE || "dev"
}`);

// const firebaseAdminConfig = require(`../../../../credentials/papeo-firebase-adminsdk-staging`);
if (process.env.TEST !== "TRUE") {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseAdminConfig),
  });
}

const DB = process.env.TEST === "TRUE" ? null : admin.firestore();
if (process.env.TEST !== "TRUE") {
  DB.settings({ ignoreUndefinedProperties: true });
}

let disableFirebase = false;
const setDisableFirebase = (value) => {
  disableFirebase = value;
};

const createFirebaseUser = async (mongoUser) => {
  if (disableFirebase) return;
  const userId = mongoUser._id.toString();
  let createdUser = await admin.auth().createUser({
    uid: userId,
  });
  await DB.collection("users")
    .doc(userId)
    .set({
      username: mongoUser.username || null,
      profilePicture: mongoUser.profilePicture || null,
      lastActivityAt: mongoUser.lastActivityAt,
      fcmTokens: mongoUser.tokens
        .map((t) => t.fcmToken)
        .filter((t) => t !== undefined),
      pushAllowed: true,
      presence: "online",
      isPartyKing: mongoUser.isPartyKing || false,
      isArtist: mongoUser.isArtist || false,
      blockedUsers: mongoUser.blockedUsers || [],
      blockedByUsers: mongoUser.blockedByUsers || [],
    });
  return createdUser;
};

const sendPartyMessage = async ({ party, senderId, receiverId, message }) => {
  if (disableFirebase) return receiverId;
  // check if conversation exists already
  let conversation = await getFirebaseConversationByPartyAndMembers(party._id, [
    senderId,
    receiverId,
  ]);
  // create party conversation if not existing
  if (!conversation) {
    conversation = await createFirebasePartyConversation(
      [senderId, receiverId],
      party
    );
  }

  // send message
  return await sendMessage({
    conversationId: conversation,
    senderId: senderId,
    receiverId: receiverId,
    text: message,
    party: party._id,
  });
};
exports.sendPartyMessage = sendPartyMessage;

const sendMessage = async ({
  conversationId,
  senderId,
  receiverId,
  text,
  partyId = null,
}) => {
  const document = await DB.collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc();

  return await document.set({
    doneUpload: true,
    filePath: null,
    location: null,
    receiverId: receiverId.toString(),
    seen: false,
    senderId: senderId.toString(),
    text,
    type: "text",
    upload: null,
    id: document.id,
    partyId,
    timestamp: admin.firestore.Timestamp.now(),
  });
};
exports.sendMessage = sendMessage;

const getFirebaseConversation = async (conversationId) => {
  const conversation = await (
    await DB.collection("conversations").doc(conversationId).get()
  ).data();
  return conversation;
};
exports.getFirebaseConversation = getFirebaseConversation;

const getFirebaseConversationByPartyAndMembers = async (partyId, members) => {
  const [docs1, docs2] = await Promise.all([
    await DB.collection("conversations")
      .where("partyId", "==", partyId.toString())
      .where(
        "members",
        "==",
        members.map((i) => i.toString())
      )
      .limit(1)
      .get(),
    await DB.collection("conversations")
      .where("partyId", "==", "61acefdc13cf1d0009a1a88a")
      .where(
        "members",
        "==",
        members
          .slice()
          .reverse()
          .map((i) => i.toString())
      )
      .limit(1)
      .get(),
  ]);
  if (!docs1.empty) return docs1.docs[0].id;
  if (!docs2.empty) return docs2.docs[0].id;
  return false;
};
exports.getFirebaseConversationByPartyAndMembers =
  getFirebaseConversationByPartyAndMembers;

const createFirebaseConversation = async (members, partyId = null) => {
  const ref = await DB.collection("conversations").doc();
  await ref.set({
    id: ref.id,
    members: members.map((m) => m.toString()),
    partyId,
  });
  return ref.id;
};
exports.createFirebaseConversation = createFirebaseConversation;

const createFirebasePartyConversation = async (members, party) => {
  const ref = await DB.collection("conversations").doc();
  await ref.set({
    id: ref.id,
    members: members.map((m) => m.toString()),
    partyId: party._id.toString(),
    title: party.name,
    timestamp: admin.firestore.Timestamp.now(),
    thumbnail:
      party.uploads && party.uploads[0] ? party.uploads[0].toString() : null,
  });
  return ref.id;
};
exports.createFirebasePartyConversation = createFirebasePartyConversation;

const updateFirebaseImageMessage = async (
  conversationId,
  messageId,
  upload
) => {
  if (disableFirebase) return;
  const newMsgRef = DB.collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .doc(messageId);
  return await newMsgRef.update({
    doneUpload: true,
    upload: {
      original: upload._id.toString(),
      thumbnail: upload.thumbnail?.toString(),
    },
  });
};

const patchFirebaseUser = async (userId, data) => {
  if (disableFirebase) return;
  userId = userId.toString();
  const patchData = {};
  if (data.username) patchData.username = data.username;
  if (data.profilePicture) {
    patchData.profilePicture = data.profilePicture.toString();
  }
  if (data.lastActivityAt) patchData.lastActivityAt = data.lastActivityAt;
  if (data.languageSetting) patchData.languageSetting = data.languageSetting;
  if (data.isPartyKing !== undefined) patchData.isPartyKing = data.isPartyKing;
  if (data.isArtist !== undefined) patchData.isArtist = data.isArtist;
  if (data.blockedUsers !== undefined)
    patchData.blockedUsers = data.blockedUsers;
  if (data.blockedByUsers !== undefined)
    patchData.blockedByUsers = data.blockedByUsers;

  if (data.tokens) {
    patchData.fcmTokens = data.tokens
      .map((t) => t.fcmToken)
      .filter((t) => t !== undefined);
  }
  if (data.$push?.tokens?.fcmToken) {
    patchData.fcmTokens = admin.firestore.FieldValue.arrayUnion(
      data.$push.tokens.fcmToken
    );
  }
  if (Object.keys(patchData).length === 0) return false;

  let patchedUser = await DB.collection("users").doc(userId).update(patchData);
  /*try {
        patchedUser = await DB.collection("users").doc(userId).update(patchData);
      } catch (error) {
        await createFirebaseUser(await User.get(userId));
        patchedUser = await DB.collection("users").doc(userId).update(patchData);
      }*/
  return patchedUser;
};

const removeFirebaseUser = async (userId) => {
  if (disableFirebase) return;
  userId = userId.toString();
  await admin.auth().deleteUser(userId);
};

const generateFirebaseJWT = async (userId) => {
  if (disableFirebase) return "FIREBASE_JWT";
  userId = userId.toString();
  return admin.auth().createCustomToken(userId);
};

const createPartyConversationAndSendMessage = async ({
  party,
  receiverId,
  senderId,
  message,
}) => {
  if (process.env.TEST) return;
  const conversation = await createFirebasePartyConversation(
    [senderId.toString(), receiverId.toString()],
    party
  );
  console.log("CREATED CONVERSATION: ", conversation);
  await sendMessage({
    conversationId: conversation,
    senderId: senderId,
    receiverId: receiverId.toString(),
    text: message,
    partyId: party._id.toString(),
  });
};
exports.createPartyConversationAndSendMessage =
  createPartyConversationAndSendMessage;

exports.setDisableFirebase = setDisableFirebase;
exports.createFirebaseUser = createFirebaseUser;
exports.updateFirebaseImageMessage = updateFirebaseImageMessage;
exports.patchFirebaseUser = patchFirebaseUser;
exports.removeFirebaseUser = removeFirebaseUser;
exports.generateFirebaseJWT = generateFirebaseJWT;
