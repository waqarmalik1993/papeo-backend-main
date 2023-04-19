const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const DB = admin.firestore();
const client = new admin.firestore.v1.FirestoreAdminClient();

DB.settings({ ignoreUndefinedProperties: true });
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.messagePush = functions
  .region("europe-west3")
  .firestore.document("conversations/{conversationId}/messages/{messageId}")
  .onWrite(async (change, context) => {
    // return if message was deleted
    if (!change.after.exists) {
      console.log(`message was deleted`);
      return;
    }

    const msg = change.after.data();
    functions.logger.info(JSON.stringify({ msg }));
    functions.logger.info(JSON.stringify({ context }));
    if (msg.doneUpload === false) return;
    if (msg.pushNotificationSend) {
      console.log("push notification already sent");
      return;
    }

    let sender = null;
    try {
      sender = await (
        await DB.collection("users").doc(msg.senderId).get()
      ).data();
    } catch (error) {
      console.error(`Error: sender with id: ${msg.senderId} not found`);
      console.error(error);
      return;
    }

    let receiver = null;
    try {
      receiver = await (
        await DB.collection("users").doc(msg.receiverId).get()
      ).data();
    } catch (error) {
      console.error(`Error: receiver with id: ${msg.receiverId} not found`);
      console.error(error);
      return;
    }

    if (!receiver.fcmTokens) console.error(`Error: receiver has no fcmToken`);
    // if (!msg.text) console.error(`Error: msg.text has no value`);

    let text = msg.text;
    const lang = receiver.languageSetting || "de";
    // I18N
    const title = {
      de: {
        image: "Foto",
        video: "Video",
        voice: "Sprachnachricht",
        file: "Datei",
      },
      en: {
        image: "Photo",
        video: "Video",
        voice: "Voice message",
        file: "File",
      },
      fr: {
        image: "Photo",
        video: "Vidéo",
        voice: "Message vocal",
        file: "Fichier",
      },
      es: {
        image: "Foto",
        video: "Vídeo",
        voice: "Mensaje de voz",
        file: "Archivo",
      },
      it: {
        image: "Foto",
        video: "Video",
        voice: "Messaggio vocale",
        file: "File",
      },
    };
    if (msg.type === "image") text = "📷 " + title[lang].image;
    if (msg.type === "video") text = "📹 " + title[lang].video;
    if (msg.type === "voice") text = "📢 " + title[lang].voice;
    if (msg.type === "file") text = "🗄 " + title[lang].file;
    if (receiver.pushAllowed) {
      await Promise.all(
        receiver.fcmTokens.map(async (fcmToken) => {
          await admin
            .messaging()
            .send({
              token: fcmToken,
              notification: {
                title: sender.username || "anonymous user",
                body: text,
              },
              data: {
                command: "openConversation",
                contentId: context.params.conversationId,
                senderId: msg.senderId,
                senderProfilePicture: sender.profilePicture,
                clickAction: "FLUTTER_NOTIFICATION_CLICK",
              },
            })
            .catch((e) => {
              console.error(`fcmToken: ${fcmToken} not valid`);
            });
        })
      );
    }
    // set pushNotificationSend=true
    const msgDocument = await DB.collection("conversations")
      .doc(context.params.conversationId)
      .collection("messages")
      .doc(context.params.messageId);
    await msgDocument.set(
      {
        pushNotificationSend: true,
      },
      { merge: true }
    );
  });

exports.backup = functions
  .region("europe-west3")
  .pubsub.schedule("every 24 hours")
  .onRun(() => {
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    const databaseName = client.databasePath(projectId, "(default)");

    return client
      .exportDocuments({
        name: databaseName,
        // Add your bucket name here
        outputUriPrefix: `gs://papeo-production.appspot.com/backup/${new Date().toISOString()}`,
        // Empty array == all collections
        collectionIds: [],
      })
      .then(([response]) => {
        console.log(`Operation Name: ${response.name}`);
        return response;
      })
      .catch((err) => {
        console.error(err);
        throw new Error("Export operation failed");
      });
  });
