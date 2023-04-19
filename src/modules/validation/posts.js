const Joi = require("joi");

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
exports.PostsSchema = {
  PATCH: Joi.object().keys({
    description: Joi.string(),
    deactivated: Joi.boolean(),
  }),
  comments: {
    POST: Joi.object().keys({
      comment: Joi.string().required(),
      parentComment: Joi.string().regex(MONGO_ID_REGEX).allow(null),
      linkedUsers: Joi.array().items(
        Joi.object().keys({
          alias: Joi.string().required(),
          user: Joi.string().regex(MONGO_ID_REGEX).required(),
        })
      ),
    }),
    COMMENT: Joi.object().keys({
      post: Joi.string().regex(MONGO_ID_REGEX).required(),
      user: Joi.string().regex(MONGO_ID_REGEX).required(),
      parentComment: Joi.string().regex(MONGO_ID_REGEX).allow(null),
      linkedUsers: Joi.array().items(
        Joi.object().keys({
          alias: Joi.string().required(),
          user: Joi.string().regex(MONGO_ID_REGEX).required(),
        })
      ),
      comment: Joi.string().required(),
    }),
    PATCH: Joi.object().keys({
      parentComment: Joi.string().regex(MONGO_ID_REGEX).allow(null),
      linkedUsers: Joi.array().items(
        Joi.object().keys({
          alias: Joi.string().required(),
          user: Joi.string().regex(MONGO_ID_REGEX).required(),
        })
      ),
      comment: Joi.string(),
      deactivated: Joi.boolean(),
    }),
  },
};
