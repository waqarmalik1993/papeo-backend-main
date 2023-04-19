const Joi = require("joi");
const { languageCodes } = require("./modules/languageCodes");
const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.AdminSchema = {
  PATCH: Joi.object().required().keys({
    manageUserProfiles: Joi.boolean().required(),
    manageUserLinks: Joi.boolean().required(),
    muteUser: Joi.boolean().required(),
    lockUser: Joi.boolean().required(),
    advancedMemberSearch: Joi.boolean().required(),
    deleteRating: Joi.boolean().required(),
    deleteUserFinally: Joi.boolean().required(),
    manageMedia: Joi.boolean().required(),
    manageComments: Joi.boolean().required(),
    manageParties: Joi.boolean().required(),
    inviteGuestsToParties: Joi.boolean().required(),
    managePartyPoints: Joi.boolean().required(),
    manageMembership: Joi.boolean().required(),
    editTranslation: Joi.boolean().required(),
    changeTC: Joi.boolean().required(),
    manageMainMenu: Joi.boolean().required(),
    rateVideoIdent: Joi.boolean().required(),
    manageViolationReports: Joi.boolean().required(),
    viewStatistics: Joi.boolean().required(),
    viewAdminLog: Joi.boolean().required(),
    manageAdmins: Joi.boolean().required(),
    manageCompetitions: Joi.boolean(),
    canSeeSecretParties: Joi.boolean(),
    loginAsUser: Joi.boolean(),
    enablePayouts: Joi.boolean(),
    payoutPayouts: Joi.boolean(),
    editNewsletter: Joi.boolean(),
    createNewsletter: Joi.boolean(),
    createUserProfiles: Joi.boolean(),
  }),
  lockUser: Joi.object()
    .required()
    .keys({
      reason: Joi.string().min(30).required(),
      messageToUser: Joi.string(),
    }),
  deleteParty: Joi.object()
    .required()
    .keys({
      reason: Joi.string().min(30).required(),
      messageToUsers: Joi.string(),
    }),
  deletePartyTag: Joi.object().required().keys({
    tag: Joi.string().required(),
  }),
  patchParty: Joi.object()
    .required()
    .keys({
      type: Joi.string().valid("private", "commercial"),
      privacyLevel: Joi.string().valid("closed"),
      messageToOwner: Joi.string().required(),
    }),
  putTOS: Joi.object().required().keys({
    termsOfService: Joi.string().required(),
  }),
  putTOSQuery: Joi.object()
    .required()
    .keys({
      lang: Joi.string()
        .valid(...languageCodes)
        .required(),
    }),
  putAdminRolePresets: Joi.array()
    .items(
      Joi.object().required().keys({
        name: Joi.string().required(),
        manageUserProfiles: Joi.boolean().required(),
        manageUserLinks: Joi.boolean().required(),
        muteUser: Joi.boolean().required(),
        lockUser: Joi.boolean().required(),
        advancedMemberSearch: Joi.boolean().required(),
        deleteRating: Joi.boolean().required(),
        deleteUserFinally: Joi.boolean().required(),
        manageMedia: Joi.boolean().required(),
        manageComments: Joi.boolean().required(),
        manageParties: Joi.boolean().required(),
        inviteGuestsToParties: Joi.boolean().required(),
        managePartyPoints: Joi.boolean().required(),
        manageMembership: Joi.boolean().required(),
        editTranslation: Joi.boolean().required(),
        changeTC: Joi.boolean().required(),
        manageMainMenu: Joi.boolean().required(),
        rateVideoIdent: Joi.boolean().required(),
        manageViolationReports: Joi.boolean().required(),
        viewStatistics: Joi.boolean().required(),
        viewAdminLog: Joi.boolean().required(),
        manageAdmins: Joi.boolean().required(),
        manageCompetitions: Joi.boolean(),
        canSeeSecretParties: Joi.boolean(),
        loginAsUser: Joi.boolean(),
        enablePayouts: Joi.boolean(),
        payoutPayouts: Joi.boolean(),
        editNewsletter: Joi.boolean(),
        createNewsletter: Joi.boolean(),
        createUserProfiles: Joi.boolean(),
      })
    )
    .required(),
  muteUser: Joi.object()
    .required()
    .keys({
      reason: Joi.string().min(30).required(),
      messageToUser: Joi.string(),
      restrictions: Joi.array()
        .items(
          Joi.string()
            .valid(
              "reportMedia",
              "createParties",
              "uploadMedia",
              "commentMedia",
              "participateInParties",
              "login"
            )
            .required()
        )
        .required(),
      durationInMinutes: Joi.number().required(),
    }),
  unmuteUser: Joi.object()
    .required()
    .keys({
      restrictionIds: Joi.array()
        .items(Joi.string().pattern(MONGO_ID_REGEX))
        .required(),
    }),
  adminTransaction: Joi.object()
    .required()
    .keys({
      amount: Joi.number().min(0).required(),
      reason: Joi.string().required(),
    }),
  deleteUser: Joi.object()
    .required()
    .keys({
      reason: Joi.string().min(30).required(),
      emailToUser: Joi.string(),
    }),
  deleteReason: Joi.object()
    .required()
    .keys({
      reason: Joi.string().min(30).required(),
    }),
  deleteHashtag: Joi.object()
    .required()
    .keys({
      reason: Joi.string().min(30).required(),
      tag: Joi.string().required(),
    }),
  createSubscription: Joi.object()
    .required()
    .keys({
      duration: Joi.string()
        .valid(
          "daily",
          "three_day",
          "weekly",
          "monthly",
          "two_month",
          "three_month",
          "six_month",
          "yearly",
          "lifetime"
        )
        .required(),
      reason: Joi.string().min(30).required(),
    }),
  deletedSubscription: Joi.object()
    .required()
    .keys({
      reason: Joi.string().min(30).required(),
    }),
  changedArtistStatus: Joi.object()
    .required()
    .keys({
      isArtist: Joi.boolean().required(),
      reason: Joi.string().min(30).required(),
    }),
  putPartyPointsConfig: Joi.object()
    .required()
    .keys({
      invites: Joi.object().required().keys({
        friends: Joi.number().required(),
        partyKing: Joi.number().required(),
        noPartyKing: Joi.number().required(),
      }),
      createAdditionalParties: Joi.object().required().keys({
        partyKing: Joi.number().required(),
        noPartyKing: Joi.number().required(),
      }),
      broadcastMessage: Joi.number().required(),
      referral: Joi.object().required().keys({
        referredUser: Joi.number().required(),
        referrer: Joi.number().required(),
      }),
    }),
  getToken: Joi.object().required().keys({
    reason: Joi.string().required(),
  }),
  createUserProfile: Joi.object()
    .keys({}),
};
