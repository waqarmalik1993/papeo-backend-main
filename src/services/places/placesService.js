const location = require("../../modules/location/findLocation.js");
const PlacesSchema = require("../../modules/validation/places.js").PlacesSchema;
const validate = require("../../modules/validation/validate.js");
const places = require("../../routes/places.js");
exports.findAddress = async (data) => {
  validate(PlacesSchema.search.ADDRESS, data);
  let { searchValue, countryCode } = data;
  const places = await location.findAddress(searchValue, countryCode);
  return places;
};
exports.findPlaceDetailed = async (placeId, countryCode) => {
  const res = await location.findPlaceDetailed(placeId, countryCode);
  return res[0];
};

exports.findAddressLongLat = async (lat, long, countryCode) => {
  const res = await location.findPlaceDetailedWithLongLat(lat, long, countryCode);
  return res;
};
