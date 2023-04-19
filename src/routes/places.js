const auth = require("../middleware/auth.js").auth;
const places = require("../services/places/placesService.js");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const PlacesSchema = require("../modules/validation/places.js").PlacesSchema;
const validate = require("../modules/validation/validate.js");
const RateLimit = require("../services/rateLimiting/rateLimitingService");
module.exports = async (app) => {
  app.post("/places/address", auth, async (req, res, next) => {
    try {
      res.send(await places.findAddress(req.body));
    } catch (e) {
      next(e);
    }
  });
  app.get("/places/address", auth, async (req, res, next) => {
    try {
      validate(PlacesSchema.GET_QUERY, req.query);
      const { placeId, countryCode } = req.query;
      if (
        await RateLimit.isRateLimited(
          req.user._id.toString(),
          "GET/places/address",
          100
        )
      ) {
        throw papeoError(PAPEO_ERRORS.RATE_LIMITED);
      }
      res.send(await places.findPlaceDetailed(placeId, countryCode));
    } catch (e) {
      next(e);
    }
  });
  app.post("/places/longlat", auth, async (req, res, next) => {
    try {
      validate(PlacesSchema.search.LATLONG, req.body);
      const { lat, long, countryCode } = req.body;
      if (
        await RateLimit.isRateLimited(
          req.user._id.toString(),
          "POST/places/longlat",
          100
        )
      ) {
        throw papeoError(PAPEO_ERRORS.RATE_LIMITED);
      }
      const result = await places.findAddressLongLat(lat, long, countryCode);
      console.log(result);
      res.send(result);
    } catch (e) {
      next(e);
    }
  });
};
