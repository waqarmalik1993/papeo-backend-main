const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.InvitesSchema = {
  POST_invite_me: Joi.object().keys({
    inviteToken: Joi.string().required(),
  }),
  POST: Joi.object().keys({
    users: Joi.array()
      .items(Joi.string().pattern(MONGO_ID_REGEX))
      .min(1)
      .unique()
      .required(),
  }),
  partiesToInviteUsersTo_QUERY: Joi.object().keys({
    user_to_invite: Joi.string().pattern(MONGO_ID_REGEX).required(),
  }),
  search: Joi.object().keys({
    distance_from: Joi.number().min(0).max(200),
    distance_to: Joi.number()
      .min(0)
      .max(200)
      .when("distance_from", {
        is: Joi.exist(),
        then: Joi.number().min(0).max(200).greater(Joi.ref("distance_from")),
      }),
    long: Joi.number().precision(8).min(-180).max(180).required(), // long
    lat: Joi.number().precision(8).min(-90).max(90).required(), // lat
    sex: Joi.array().items(Joi.string().valid("male", "female", "other")),
    include: Joi.array().items(
      Joi.string().valid(
        "following",
        "following_me",
        "friends",
        "my_party_guests",
        "authenticated_users",
        "party_king_members",
        "artists"
      )
    ),
    age_from: Joi.number().min(16).max(99),
    age_to: Joi.number().min(16).max(99),
    skip: Joi.number().min(0),
    limit: Joi.number().min(0),
    last_activity_at: Joi.date().less("now"),
    text_search: Joi.string(),
    party: Joi.string().pattern(MONGO_ID_REGEX).required(),
    $limit: Joi.number().max(100),
    $skip: Joi.number(),
  }),
  searchV2: Joi.object().keys({
    distance_from: Joi.number().min(0).max(200),
    distance_to: Joi.number().min(0).max(200), // query parameter nicht mitschicken wenn unbegrenzt
    long: Joi.number().precision(8).min(-180).max(180).required(), // long
    lat: Joi.number().precision(8).min(-90).max(90).required(), // lat
    sex: Joi.array().items(Joi.string().valid("male", "female", "diverse")),
    include: Joi.array().items(
      Joi.string().valid(
        "following",
        "following_me",
        "friends",
        "my_party_guests",
        "others"
      )
    ),
    age_from: Joi.number().min(16).max(99),
    age_to: Joi.number().min(16).max(99),
    skip: Joi.number().min(0),
    limit: Joi.number().min(0),
    last_activity_at: Joi.date().less("now"),
    text_search: Joi.string(),
    party: Joi.string().pattern(MONGO_ID_REGEX).required(),
    is_authenticated: Joi.boolean(),
    is_party_king: Joi.boolean(),
    is_artist: Joi.boolean(),
    $limit: Joi.number().max(100),
    $skip: Joi.number(),
  }),
};
