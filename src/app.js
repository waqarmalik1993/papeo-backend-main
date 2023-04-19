const express = require("@feathersjs/express");
const feathers = require("@feathersjs/feathers");
const helmet = require("helmet");
const cors = require("cors");
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");
const compress = require("compression");
const createDatabaseConnection = require("./database.js");
const morgan = require("morgan");
const usersRoute = require("./routes/users.js");
const partiesRoute = require("./routes/parties.js");
const errorsRoute = require("./routes/errors.js");
const postsRoute = require("./routes/posts.js");
const partyRatingsRoute = require("./routes/partyRatings.js");
const partyGuestsRoute = require("./routes/partyGuests.js");
const partyBookmarksRoute = require("./routes/bookmarks.js");
const placesRoute = require("./routes/places.js");
const swipesRoute = require("./routes/swipes.js");
const friendsRoute = require("./routes/friends.js");
const followersRoute = require("./routes/followers.js");
const feedRoute = require("./routes/feed.js");
const reportsRoute = require("./routes/reports.js");
const invitesRoute = require("./routes/invites.js");
const partyAdminsRoute = require("./routes/partyAdmins.js");
const imageMentionsRoute = require("./routes/imageMentions.js");
const messagesRoute = require("./routes/messages.js");
const uploadsRoute = require("./routes/uploads");
const verificationsRoute = require("./routes/verifications");
const webhooksRoute = require("./routes/webhooks");
const webhooksTicketingRoute = require("./routes/webhooksTicketing");
const transactionsRoute = require("./routes/transactions");
const paymentsRoute = require("./routes/payments");
const activitiesRoute = require("./routes/activities");
const membershipRoute = require("./routes/membership");
const adminsRoute = require("./routes/admins");
const referralsRoute = require("./routes/referrals");
const referralTreeRoute = require("./routes/referraltree");
const competitionsRoute = require("./routes/competitions");
const shareRoute = require("./routes/sharing");
const myPartyGuestsRoute = require("./routes/myPartyGuests");
const ticketingRoute = require("./routes/ticketing");
const payoutsRoute = require("./routes/payouts");
const partyStaffRoute = require("./routes/partyStaff");
const menuCardsRoute = require("./routes/menuCards");
const newsletterRoute = require("./routes/newsletter");
const serverless = require("serverless-http");
const { headObject } = require("./services/uploads/s3.js");
const Upload = require("./services/uploads/uploadsService");
const PartyGuest = require("./services/partyGuests/partyGuestsService");
const TicketingTransaction = require("./services/ticketing/ticketingTransactionService");
const Newsletter = require("./services/newsletter/newsletterService");
const Invite = require("./services/invites/invitesService");
const { handleOnSiteCheck } = require("./modules/onSiteCheck/onsideCheck");
const { sanitize } = require("./middleware/sanitize");
const {
  handlePartyExpiration,
} = require("./modules/partyExpiration/partyExpiration");
const {
  handleCompetitionExpiration,
} = require("./modules/competitionExpiration/competitionExpiration");
const {
  handleRestrictionExpiration,
} = require("./modules/restrictionExpiration/restrictionExpiration");
const {
  handleSubscriptionStatus,
} = require("./modules/subscription/checkSubscriptionStatus");
const {
  handleCompetitionOnSiteReminder,
} = require("./modules/competitionOnSiteReminder/competitionOnSiteReminder");
const {
  handlePartyChange,
  handlePartyReminderPush,
} = require("./services/parties/partiesService");
const {
  recalculateLevelCountsAndUpdate,
} = require("./services/referralTree/referralTreeService");
const { handlePartyRatingPush } = require("./services/ratings/ratingsService");
const app = express(feathers());
exports.app = app;
if (!process.env.TEST) {
  Sentry.init({
    dsn: process.env.SENTRY,
    environment: process.env.SENTRY_ENV,
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app }),
    ],

    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 1.0,
  });

  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

if (!process.env.TEST) {
  app.use(morgan(":method :url :status - :response-time ms"));
}

app.use(helmet());
app.use(cors());
app.use(compress());

// dont move webhooks route below json parser, stripe webhook needs the raw body for request signing
webhooksRoute(app);
webhooksTicketingRoute(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.configure(express.rest());

app.use(sanitize);
verificationsRoute(app);
transactionsRoute(app);
membershipRoute(app);
myPartyGuestsRoute(app);
usersRoute(app);
partiesRoute(app);
errorsRoute(app);
postsRoute(app);
partyRatingsRoute(app);
partyGuestsRoute(app);
partyBookmarksRoute(app);
swipesRoute(app);
friendsRoute(app);
placesRoute(app);
followersRoute(app);
feedRoute(app);
reportsRoute(app);
invitesRoute(app);
partyAdminsRoute(app);
imageMentionsRoute(app);
messagesRoute(app);
uploadsRoute(app);
paymentsRoute(app);
activitiesRoute(app);
adminsRoute(app);
competitionsRoute(app);
referralsRoute(app);
referralTreeRoute(app);
shareRoute(app);
ticketingRoute(app);
payoutsRoute(app);
partyStaffRoute(app);
menuCardsRoute(app);
newsletterRoute(app);

/*
app.get("/test", async function (req, res) {
  res.send(await Upload.generateAndSaveThumbnail("61011f4402f7ca34cd3bc873"));
});
*/

let server = null;
module.exports.startServer = async () => {
  await createDatabaseConnection();
  if (!server) {
    server = app.listen(process.env.PORT || 3000);
    server.on("listening", () =>
      console.log(`Papeo API running on port ${server.address().port}`)
    );
  }
};

app.use(express.notFound());
if (!process.env.TEST) app.use(Sentry.Handlers.errorHandler());
app.use(express.errorHandler({}));

//export default server;

module.exports.handler = async (event, context) => {
  console.log(JSON.stringify(event));
  context.callbackWaitsForEmptyEventLoop = false;
  await createDatabaseConnection();
  const result = await serverless(app)(event, context);
  return result;
};
module.exports.uploadsEventHandler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await createDatabaseConnection();
  console.log(JSON.stringify(event));
  await Promise.all(
    event.Records.map(async (record) => {
      const key = record.s3.object.key;
      const uploadId = key.split("/")[1];
      const metadata = await headObject(key);
      console.log({ metadata });
      const isAllowed = Upload.isMimetypeAllowed(metadata.ContentType);
      // try catch to avoid lambda retries
      try {
        if (!isAllowed) {
          await Upload.remove(uploadId);
          console.log(
            `deleted file because mimetype is not allowed, mimetype: ${metadata.ContentType}`
          );
          return "deleted file because mimetype is not allowed";
        }
        await Upload.setUploadDone(key, metadata.ContentType);
        // Thumbnail nicht im upload Bucket speichern, sonst gibt es einen Loop!
        if (Upload.needsThumbnail(metadata.ContentType)) {
          await Upload.generateAndSaveThumbnail(uploadId, metadata.ContentType);
          return "uploaded with thumbnail";
        }
      } catch (error) {
        console.log(error);
      }
    })
  );
  return "uploaded without thumnail creation";
};

const scheduledHandler = async (event, context) => {
  console.log(JSON.stringify(event));
  context.callbackWaitsForEmptyEventLoop = false;
  await createDatabaseConnection();
  try {
    await handleSubscriptionStatus();
  } catch (error) {
    console.log(error);
  }
  try {
    await handleOnSiteCheck();
  } catch (error) {
    console.log(error);
  }
  try {
    await handlePartyChange();
  } catch (error) {
    console.log(error);
  }
  try {
    await handlePartyReminderPush();
  } catch (error) {
    console.log(error);
  }
  try {
    await handlePartyRatingPush();
  } catch (error) {
    console.log(error);
  }
  try {
    await handlePartyExpiration();
  } catch (error) {
    console.log(error);
  }
  try {
    await handleRestrictionExpiration();
  } catch (error) {
    console.log(error);
  }
  try {
    await handleCompetitionExpiration();
  } catch (error) {
    console.log(error);
  }
  try {
    await handleCompetitionOnSiteReminder();
  } catch (error) {
    console.log(error);
  }
  try {
    await TicketingTransaction.expireTransactions();
  } catch (error) {
    console.log(error);
  }
};
module.exports.scheduledHandler = scheduledHandler;
// scheduledHandler({}, {});
const scheduledHandlerEvery24h = async (event, context) => {
  console.log(JSON.stringify(event));
  context.callbackWaitsForEmptyEventLoop = false;
  await createDatabaseConnection();
  try {
    await PartyGuest.sendNewPartyGuestsNotificationToPartyGuests();
  } catch (error) {
    console.log(error);
  }
};
module.exports.scheduledHandlerEvery24h = scheduledHandlerEvery24h;

const scheduledHandlerEvery1h = async (event, context) => {
  console.log(JSON.stringify(event));
  context.callbackWaitsForEmptyEventLoop = false;
  await createDatabaseConnection();
  try {
    await recalculateLevelCountsAndUpdate();
  } catch (error) {
    console.log(error);
  }
};
module.exports.scheduledHandlerEvery1h = scheduledHandlerEvery1h;

const asyncWorker = async (event, context) => {
  console.log(JSON.stringify(event));
  context.callbackWaitsForEmptyEventLoop = false;
  await createDatabaseConnection();
  try {
    switch (event.action) {
    case "publishNewsletter":
      await Newsletter.sendNotifications(event.newsletterId);
      break;
    case "inviteUsers":
      await Invite.inviteUsers(
        event.invitingUserId,
        event.invitedUserIds,
        event.partyId
      );
      break;

    default:
      break;
    }
  } catch (error) {
    console.log(error);
  }
};
module.exports.asyncWorker = asyncWorker;
