const { ACTIVITIES_LANG, text } = require("../helper/internationalization");

exports.translateActivity = (activity, lang = "de") => {
  let type = ACTIVITIES_LANG[activity.type];
  try {
    switch (activity.type) {
    case "userImageMentioned":
      // TODO CHECKEN
      // otherUsers [userDerMarkeiertwurde, userDerMarkiertHat]
      if (ownUserCheck(activity)) {
        activity.title = text(
          type.own.title,
          [activity.otherUsers[1].username],
          lang
        );
        activity.body = text(
          type.own.body,
          [activity.otherUsers[1].username],
          lang
        );
        activity.notification = {
          command: "openPost",
          contentId: activity.posts[0]._id.toString(),
        };
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openPost",
          contentId: activity.posts[0]._id.toString(),
        };
      }
      break;
    case "userImageMentionedDeleted":
      // TODO CHECKEN
      if (ownUserCheck(activity)) {
        activity.title = text(
          type.own.title,
          [activity.otherUsers[1].username],
          lang
        );
        activity.body = text(
          type.own.body,
          [activity.otherUsers[1].username],
          lang
        );
        activity.notification = {
          command: "openPost",
          contentId: activity.posts[0]._id.toString(),
        };
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openPost",
          contentId: activity.posts[0]._id.toString(),
        };
      }
      break;
    case "membershipUpgrade":
      // TODO CHECKEN
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(type.own.body, [], lang);
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      }
      break;
    case "membershipDowngrade":
      // TODO CHECKEN
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(type.own.body, [], lang);
        activity.notification = {
          command: "openMembership",
        };
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      }
      break;
    case "artistActive":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(type.own.body, [], lang);
        activity.notification = {
          command: "openProfile",
          contentId: activity.user._id.toString(),
        };
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      }
      break;
    case "artistInactive":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(type.own.body, [], lang);
        activity.notification = {
          command: "openProfile",
          contentId: activity.user._id.toString(),
        };
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      }
      break;
    case "newFollower":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openProfile",
        contentId: activity.otherUsers[0]?._id.toString(),
      };
      break;
    case "followerRemoved":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openProfile",
        contentId: activity.otherUsers[0]?._id.toString(),
      };
      break;
    case "newFriendRequest":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openFriendRequests",
        contentId: activity.otherUsers[0]?._id.toString(),
      };
      break;
    case "friendRequestAccepted":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openProfile",
        contentId: activity.otherUsers[0]?._id.toString(),
      };
      break;
    case "friendRequestDeclined":
      // TODO Implementation
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openProfile",
        contentId: activity.otherUsers[0]?._id.toString(),
      };
      break;
    case "friendRemoved":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openProfile",
        contentId: activity.otherUsers[0]?._id.toString(),
      };
      break;
    case "postNewLike":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openPost",
        contentId: activity.posts[0]._id.toString(),
      };
      break;
    case "userReported":
      // TODO CHECKEN
      activity.title = text(type.own.title, [], lang);
      activity.body = text(type.own.body, [], lang);
      activity.notification = {};
      break;
    case "partyCanceled":
      // TODO CHECKEN
      // Warteliste + Gästeliste
      // Party gemerkt haben
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [activity.additionalInformation.name],
        lang
      );
      activity.notification = {};
      break;
    case "partyGuestDeclined":
      // TODO CHECKEN
      // Nutzer muss ert akzeptiert worden sein und dann declined worden sein.
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(
          type.own.body,
          [activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      } else {
      }
      break;
    case "partyGuestRemoved":
      // TODO CHECKEN
      // Nutzer muss ert akzeptiert worden sein und dann declined worden sein.
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(
          type.own.body,
          [activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      } else {
        // Freunde
        // Follower
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "partyGuestAccepted":
      // TODO CHECKEN
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(
          type.own.body,
          [activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      } else {
        // Freunde
        // Follower
        activity.title = text(type.other.title, [], lang);
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username, activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "partyGuestRequested":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(type.other.title, [], lang);
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username, activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openPartyManagement",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "partyGuestOnSite":
      // TODO CHECKEN
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [activity.otherUsers[0]?.username, activity.parties[0]?.name],
        lang
      );
      activity.notification = {
        command: "openParty",
        contentId: activity.parties[0]?._id.toString(),
      };
      break;
    case "partyBookmarked":
      // TODO CHECKEN
      // Freunde
      // Follower
      activity.title = text(
        type.other.title,
        [activity.parties[0]?.name],
        lang
      );
      activity.body = text(
        type.other.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openParty",
        contentId: activity.parties[0]?._id.toString(),
      };
      break;
    case "partyBookmarkedRemoved":
      // TODO CHECKEN
      // Freunde
      // Follower
      activity.title = text(
        type.other.title,
        [activity.parties[0]?.name],
        lang
      );
      activity.body = text(
        type.other.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openParty",
        contentId: activity.parties[0]?._id.toString(),
      };
      break;
    case "patchedPartyInformation":
      // TODO CHECKEN
      // Freunde
      // Follower
      activity.title = text(
        type.other.title,
        [activity.parties[0]?.name],
        lang
      );
      activity.body = text(
        type.other.body,
        [activity.additionalInformation.text],
        lang
      );
      activity.notification = {
        command: "openParty",
        contentId: activity.parties[0]?._id.toString(),
      };
      break;
    case "newPostComment":
      // Er selbst
      // Party Besitzer
      // Ander Kommentar Leute
      activity.title = text(type.other.title, [], lang);
      activity.body = text(
        type.other.body,
        [
          activity.otherUsers[0]?.username,
          shortComment(activity.additionalInformation.text),
        ],
        lang
      );
      activity.notification = {
        command: "openPost",
        contentId: activity.posts[0]._id.toString(),
      };

      break;
    case "newPostCommentMention":
      activity.title = text(type.other.title, [], lang);
      activity.body = text(
        type.other.body,
        [
          activity.otherUsers[0]?.username,
          shortComment(activity.additionalInformation.text),
        ],
        lang
      );
      activity.notification = {
        command: "openPost",
        contentId: activity.posts[0]._id.toString(),
      };

      break;
    case "editPostComment":
      // TODO
      // Er selbst
      // Party Besitzer
      // Ander Kommentar Leute
      activity.title = text(type.other.title, [], lang);
      activity.body = text(
        type.other.body,
        [
          activity.otherUsers[0]?.username,
          shortComment(activity.additionalInformation.text),
        ],
        lang
      );
      activity.notification = {
        command: "openPost",
        contentId: activity.posts[0]._id.toString(),
      };
      break;
    case "deletedPostComment":
      // TODO
      // Er selbst
      // Party Besitzer
      // Ander Kommentar Leute
      activity.title = text(type.other.title, [], lang);
      activity.body = text(
        type.other.body,
        [shortComment(activity.additionalInformation.text)],
        lang
      );
      activity.notification = {
        command: "openPost",
        contentId: activity.posts[0]._id.toString(),
      };
      break;
    case "reportedPostComment":
      // TODO
      // Er selbst der hochgeladen hat
      // Person die das Kommentar verfasst hat
      // Party Besitzer
      activity.title = text(type.other.title, [], lang);
      activity.body = text(
        type.other.body,
        [shortComment(activity.additionalInformation.text)],
        lang
      );
      activity.notification = {
        command: "openPost",
        contentId: activity.posts[0]._id.toString(),
      };
      break;
    case "newPartyPost":
      // TODO
      /*
        - Veranstalter (Notification 05.01)
        - Benutzer auf der Gäste- oder Warteliste der Party (Notification 05.01)
        - Benutzer die sich die Party gemerkt haben (Notification 05.01)
        - Freunde des Benutzers, der das Medium hochgeladen hat (Notification 05.02)
        - Follower des Benutzers, der das Medium hochgeladen hat (Notification 05.03)
      */
      activity.title = text(
        type.other.title,
        [activity.parties[0]?.name],
        lang
      );
      activity.body = text(
        type.other.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openPost",
        contentId: activity.posts[0]._id.toString(),
      };
      break;
    case "newProfilePost":
      // TODO
      /*
- Besitzer des Profils (Notification 05.07)
- Freunde des Profils, in welches das Medium hochgeladen wurde (Notification 05.02)
- Follower des Profils, in welches das Medium hochgeladen wurde (Notification 05.02)
- Freunde des Benutzers, der das Bild hochgeladen hat (Notification 05.02)
- Follower des Benutzers, der das Medium hochgeladen hat (Notification 05.03)
        */
      activity.title = text(
        type.other.title,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.body = text(type.other.body, [], lang);
      activity.notification = {
        command: "openPost",
        contentId: activity.posts[0]._id.toString(),
      };
      break;
    case "invitedParty":
      // TODO
      /*
      Person die eingeladen wurden!!!
      */

      // TODO AdditionalInformation ob der Nutzer ein Party Admin ist!!!  Also Veranstalter
      activity.title = text(
        type.other.title,
        [activity.parties[0]?.name],
        lang
      );
      activity.body = text(
        type.other.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openParty",
        contentId: activity.parties[0]?._id.toString(),
      };
      break;
    case "addedIdentvideo":
      // TODO
      /*
       Freunde
       Follower
            */
      activity.title = text(type.other.title, [], lang);
      activity.body = text(
        type.other.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openIdentvideo",
        contentId: activity.user._id.toString(),
      };
      break;
    case "addedAdmin":
      activity.title = text(type.other.title, ["Papeo"], lang);
      activity.body = text(
        type.other.body,
        [activity.otherUsers[0]?.username],
        lang
      );
      activity.notification = {
        command: "openProfile",
        contentId: activity.otherUsers[0]?._id.toString(),
      };
      break;
    case "addedPartyAdmin":
      // TODO CHECKEN
      if (ownUserCheck(activity)) {
        activity.title = text(
          type.own.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.own.body,
          [activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      } else {
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username, activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "removedPartyAdmin":
      // TODO CHECKEN
      if (ownUserCheck(activity)) {
        activity.title = text(
          type.own.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.own.body,
          [activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      } else {
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username, activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "partyGuestRemovedHimself":
      // TODO CHECKEN
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "adminDeletedPartyRating":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(
          type.own.body,
          [activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      } else {
        activity.title = text(type.other.title, [], lang);
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username, activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "partyParticipatesOnCompetition":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.parties[0]?.name, activity.competitions[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "userIsNowVerified":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(type.own.body, [], lang);
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      } else {
        activity.title = text(type.other.title, [], lang);
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      }
      break;
    case "identVideoWasDeclined":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(type.own.body, [], lang);
      } else {
      }
      break;
    case "userWasMentionedInYourUpload":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(type.other.title, [], lang);
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username, activity.otherUsers[1].username],
          lang
        );
        activity.notification = {
          command: "openPost",
          contentId: activity.posts[0]._id.toString(),
        };
      }
      break;
    case "userMentionWasDeletedInYourUpload":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(type.other.title, [], lang);
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openPost",
          contentId: activity.posts[0]._id.toString(),
        };
      }
      break;
    case "partyWasPublished":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "partyRatingCreated":
      if (
      /* ########## Vorsicht beim copy & paste */ activity.ratings[0].partyOwner.toString() ===
          activity.user._id.toString()
      ) {
        activity.title = text(
          type.own.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.own.body,
          [activity.ratings[0].value, activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      } else {
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.ratings[0].value, activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "sharedParty":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "sharedPost":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openPost",
          contentId: activity.posts[0]._id.toString(),
        };
      }
      break;
    case "sharedUser":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username, activity.otherUsers[1].username],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[1]._id.toString(),
        };
      }
      break;
    case "deletedPostCommentByAdmin":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(
          type.own.body,
          [
            activity.additionalInformation.comment,
            activity.additionalInformation.reason,
          ],
          lang
        );
        activity.notification = {
          command: "openPost",
          contentId: activity.posts[0]._id.toString(),
        };
      } else {
        activity.title = text(type.other.title, [], lang);
        activity.body = text(
          type.other.body,
          [
            activity.otherUsers[0]?.username,
            activity.additionalInformation.comment,
            activity.additionalInformation.reason,
          ],
          lang
        );
        activity.notification = {
          command: "openPost",
          contentId: activity.posts[0]._id.toString(),
        };
      }
      break;
    case "deletedProfilePictureByAdmin":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(
          type.own.body,
          [activity.additionalInformation.reason],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      } else {
      }
      break;
    case "deletedArtistDescriptionByAdmin":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(
          type.own.body,
          [activity.additionalInformation.reason],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      } else {
      }
      break;
    case "deletedProfileDescriptionByAdmin":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(
          type.own.body,
          [activity.additionalInformation.reason],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      } else {
      }
      break;
    case "hiddenPostByAdmin":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(
          type.own.body,
          [activity.additionalInformation.reason],
          lang
        );
        activity.notification = {
          command: "openPost",
          contentId: activity.posts[0]._id.toString(),
        };
      } else {
        activity.title = text(type.other.title, [], lang);
        activity.body = text(
          type.other.body,
          [
            activity.otherUsers[0]?.username,
            activity.additionalInformation.reason,
          ],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "deletedPostByAdmin":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(
          type.own.body,
          [activity.additionalInformation.reason],
          lang
        );
      } else {
        activity.title = text(type.other.title, [], lang);
        activity.body = text(
          type.other.body,
          [
            activity.otherUsers[0]?.username,
            activity.additionalInformation.reason,
          ],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "deletedPostByPartyAdmin":
      if (ownUserCheck(activity)) {
        activity.title = text(type.own.title, [], lang);
        activity.body = text(type.own.body, [], lang);
      } else {
        activity.title = text(type.other.title, [], lang);
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
    case "editedPartyAdminRights":
      if (ownUserCheck(activity)) {
        activity.title = text(
          type.own.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(type.own.body, [], lang);
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      } else {
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "partyGuestAcceptedByPartyAdmin":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username, activity.otherUsers[1].username],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "partyGuestRemovedByPartyAdmin":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username, activity.otherUsers[1].username],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "userHasChangedHisProfilePicture":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      }
      break;
    case "userHasChangedHisProfileDescription":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      }
      break;
    case "userHasChangedHisUsername":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [
            activity.otherUsers[0]?.username,
            activity.additionalInformation.oldUsername,
            activity.additionalInformation.newUsername,
          ],
          lang
        );
        activity.notification = {
          command: "openProfile",
          contentId: activity.otherUsers[0]?._id.toString(),
        };
      }
      break;
    case "competitionClosedPartyRanked":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.competitions[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.parties[0]?.name, activity.additionalInformation.ranking],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "competitionOnSiteReminder":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.competitions[0]?.name],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "guestListIsFullClosedParty":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.parties[0]?.name],
          lang
        );
        activity.body = text(type.other.body, [], lang);
        activity.notification = {
          command: "openParty",
          contentId: activity.parties[0]?._id.toString(),
        };
      }
      break;
    case "newPartyGuests":
      activity.title = text(
        type.other.title,
        [activity.parties[0]?.name],
        lang
      );
      activity.body = text(
        type.other.body,
        [activity.additionalInformation.newPartyGuestCount],
        lang
      );
      activity.notification = {
        command: "openParty",
        contentId: activity.parties[0]?._id.toString(),
      };

      break;
    case "restrictionAdded_reportMedia":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionEndTime,
          activity.additionalInformation.messageToUser,
        ],
        lang
      );
      break;
    case "restrictionAdded_createParties":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionEndTime,
          activity.additionalInformation.messageToUser,
        ],
        lang
      );
      break;
    case "restrictionAdded_uploadMedia":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionEndTime,
          activity.additionalInformation.messageToUser,
        ],
        lang
      );
      break;
    case "restrictionAdded_commentMedia":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionEndTime,
          activity.additionalInformation.messageToUser,
        ],
        lang
      );
      break;
    case "restrictionAdded_participateInParties":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionEndTime,
          activity.additionalInformation.messageToUser,
        ],
        lang
      );
      break;
    case "restrictionAdded_login":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionEndTime,
          activity.additionalInformation.messageToUser,
        ],
        lang
      );
      break;
    case "restrictionRemoved_reportMedia":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionStartTime,
          activity.additionalInformation.restrictionEndTime,
        ],
        lang
      );

      break;
    case "restrictionRemoved_createParties":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionStartTime,
          activity.additionalInformation.restrictionEndTime,
        ],
        lang
      );

      break;
    case "restrictionRemoved_uploadMedia":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionStartTime,
          activity.additionalInformation.restrictionEndTime,
        ],
        lang
      );

      break;
    case "restrictionRemoved_commentMedia":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionStartTime,
          activity.additionalInformation.restrictionEndTime,
        ],
        lang
      );

      break;
    case "restrictionRemoved_participateInParties":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionStartTime,
          activity.additionalInformation.restrictionEndTime,
        ],
        lang
      );

      break;
    case "restrictionRemoved_login":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [
          activity.additionalInformation.restrictionStartTime,
          activity.additionalInformation.restrictionEndTime,
        ],
        lang
      );

      break;
    case "userTicketShared":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username, activity.parties[0]?.name],
          lang
        );
        activity.notification = {
          command: "openUserTicketShare",
          contentId: activity.userTickets[0]._id.toString(),
        };
      }
      break;
    case "userTicketSharedAccepted":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
      }
      break;
    case "userTicketSharedRejected":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(
          type.other.title,
          [activity.otherUsers[0]?.username],
          lang
        );
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username],
          lang
        );
      }
      break;
    case "partyStaffCreated":
      if (ownUserCheck(activity)) {
      } else {
        activity.title = text(type.other.title, [], lang);
        activity.body = text(
          type.other.body,
          [activity.otherUsers[0]?.username, activity.parties[0]?.name],
          lang
        );
      }
      break;
    case "partyStaffCancelled":
      activity.title = text(type.other.title, [], lang);
      activity.body = text(
        type.other.body,
        [activity.otherUsers[0]?.username, activity.parties[0]?.name],
        lang
      );
      break;
    case "newsletter":
      activity.title = text(type.own.title, [], lang);
      activity.body = text(
        type.own.body,
        [activity.newsletter[0]?.title],
        lang
      );
      activity.notification = {
        command: "openNewsletter",
        contentId: activity.newsletter[0]._id.toString(),
      };

      break;
    default:
      return null;
    }

    return deleteEmptyFields(activity);
  } catch (e) {
    console.log(e);
    return null;
  }
};

const deleteEmptyFields = (activity) => {
  for (let element in activity) {
    if (
      activity?.[element] === null ||
      (Array.isArray(activity?.[element]) && !activity?.[element]?.length)
    ) {
      delete activity?.[element];
    }
  }
  return activity;
};

// TODO Checken ob es der eigene Nutzer ist!

const ownUserCheck = (activity) => {
  const otherUserId = activity.otherUsers[0]?._id
    ? activity.otherUsers[0]?._id.toString()
    : activity.otherUsers[0]?.toString();

  const activityUserId = activity.user._id
    ? activity.user._id.toString()
    : activity.user.toString();
  return otherUserId === activityUserId;
};

/*
      switch (activity.subType) {
      case "own":
        activity.title = "Markierung";
        activity.body = "Deine Markierung auf dem Bild von XXX wurde entfernt";
        activity.notification = {
          command: "openPost",
          postId: "",
        };
        break;
      case "other":
        activity.title = "Markierung";
        activity.body = "XXX wurde aus einem Beitrag entfernt";
        activity.notification = {
          command: "openPost",
          postId: "",
        };
        break;
      }
 */

const shortComment = (stringToShort) => {
  if (stringToShort.length > 45)
    stringToShort = stringToShort.substr(0, 45) + "...";
  return stringToShort;
};
