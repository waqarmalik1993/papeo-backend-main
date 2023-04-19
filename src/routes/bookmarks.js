const auth = require("../middleware/auth.js").auth;
const Bookmark = require("../services/bookmarks/bookmarksService.js");
const Party = require("../services/parties/partiesService");
const Upload = require("../services/uploads/uploadsService");
const {
  createActivityTargetGroup,
} = require("../services/activities/createActivityTargetGroup");
const {
  getFriendIdsFromUser,
  getFollowerIdsFromUser,
} = require("../services/activities/helper/getTargetGroup");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;

module.exports = async (app) => {
  app.get("/bookmarks", auth, async (req, res, next) => {
    try {
      if (req.query.user && req.query.user !== req.user._id.toString()) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }
      const bookmarks = await Bookmark.find({
        query: { ...req.query },
      });
      if (req.query.$populate === "party") {
        bookmarks.data = await Promise.all(
          bookmarks.data.map(async (b) => {
            const bookmarkCopy = { ...b };
            if (!b.party) {
              console.log(`Bookmark ${b._id} has no party attached`);
              return null;
            }
            bookmarkCopy.party.uploads = (
              await Promise.allSettled(
                b.party.uploads.map((u) => Upload.get(u))
              )
            )
              //TODO check for not existing uploads
              .filter((upload) => upload.status === "fulfilled")
              .map((u) => u.value);

            bookmarkCopy.party = {
              ...bookmarkCopy.party,
              ...(await Party.getCounts(req.user, bookmarkCopy.party)),
            };
            return bookmarkCopy;
          })
        );
        // Filter out Bookmarks that doesnt have a party
        bookmarks.data = bookmarks.data.filter((b) => b !== null);
      }
      res.send(bookmarks);
    } catch (e) {
      next(e);
    }
  });

  app.delete("/parties/:partyId/bookmarks", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      let removedBookmark = await Bookmark.removeByUserIdAndPartyId(
        req.user._id,
        partyId
      );
      res.send(removedBookmark);
      /*
      await createActivityTargetGroup({
        type: "partyBookmarkedRemoved",
        otherUsers: [req.user._id],
        parties: [partyId],
        targetGroups: {
          friends: getFriendIdsFromUser(req.user),
          following: await getFollowerIdsFromUser(req.user._id),
        },
        sendNotification: true,
      });
      */
    } catch (e) {
      next(e);
    }
  });

  app.post("/parties/:partyId/bookmarks", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      let user = req.user;
      const party = await Party.get(partyId);
      let createdBookmark = await Bookmark.create({
        user: req.user._id,
        party: partyId,
      });
      if (party.privacyLevel !== "secret") {
        await createActivityTargetGroup({
          type: "partyBookmarked",
          otherUsers: [user._id],
          parties: [partyId],
          targetGroups: {
            friends: getFriendIdsFromUser(user),
            following: await getFollowerIdsFromUser(req.user._id),
          },
          sendNotification: true,
        });
      }
      res.send(createdBookmark);
    } catch (e) {
      next(e);
    }
  });
};
