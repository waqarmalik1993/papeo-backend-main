const errors = require("@feathersjs/errors");
module.exports = function validate(schema, body) {
  const { error } = schema.validate(body);
  if (error) throw new errors.BadRequest(error.details[0].message);
}
