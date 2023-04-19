const googleMaps = require("@google/maps");

const googleMapsClient = process.env.DISABLE_GOOGLE_MAPS
  ? null
  : googleMaps.createClient({
      key: process.env.GOOGLE_MAPS_API_KEY,
      Promise: Promise,
    });

const findPlace = async (query, countryCode) => {
  const result = await googleMapsClient
    .placesAutoComplete({
      input: query,
      language: countryCode,
      types: ["(cities)"],
      // components: { country: ['de', 'ch', 'at', 'uk', 'nl'] }
    })
    .asPromise()
    .then((response) => {
      return response.json.predictions;
    })
    .catch((error) => console.log(error));

  const formattedResponse = result.map((element) => {
    return {
      description: element.description,
      place_id: element.place_id,
    };
  });
  return formattedResponse;
};

const findAddress = async (query, countryCode) => {
  const result = await googleMapsClient
    .placesAutoComplete({
      input: query,
      language: countryCode,
      // components: { country: ['de', 'ch', 'at', 'uk', 'nl'] }
    })
    .asPromise()
    .then((response) => {
      return response.json.predictions;
    })
    .catch((error) => console.log(error));

  const formattedResponse = result.map((element) => {
    return {
      description: element.description,
      place_id: element.place_id,
    };
  });
  return formattedResponse;
};

const findPlaceDetailed = async (placeId, countryCode) => {
  const result = await googleMapsClient
    .reverseGeocode({
      place_id: placeId,
      language: countryCode,
    })
    .asPromise()
    .then((response) => {
      return response.json.results;
    })
    .catch((err) => {
      console.log(err);
    });

  return result;
};

const findPlaceDetailedWithLongLat = async (lat, long, countryCode) => {
  const result = await googleMapsClient
    .reverseGeocode({
      latlng: [lat, long],
      language: countryCode,
    })
    .asPromise()
    .then((response) => {
      return response.json.results;
    });

  return result;
};

const findLongLat = async (query, countryCode) => {
  const result = await googleMapsClient
    .geocode({
      address: query,
      language: countryCode,
    })
    .asPromise()
    .then((response) => {
      return response.json.results;
    })
    .catch((err) => {
      console.log(err);
    });

  return result;
};

const findAddressToLongLat = async (longitude, latitude) => {
  const response = await findPlaceDetailedWithLongLat(latitude, longitude);
  let returnValue = {
    address: {
      street: null,
      houseNumber: null,
      city: null,
      postcode: null,
      country: null,
    },
  };

  let index = 0;
  if (!response.length) {
    return returnValue;
  } else {
    if (response[0]?.types[0] === "plus_code") {
      index = 1;
      if (response.length < 2) return returnValue;
    }
    if (!response[index].address_components) return returnValue;
    if (!response[index].address_components.length) return returnValue;
  }
  response[index].address_components.forEach((element) => {
    if (element.types.includes("street_number"))
      returnValue.address.houseNumber = element.long_name;
    if (element.types.includes("route"))
      returnValue.address.street = element.long_name;
    if (element.types.includes("locality"))
      returnValue.address.city = element.long_name;
    if (element.types.includes("postal_code"))
      returnValue.address.postcode = element.long_name;
    if (element.types.includes("country"))
      returnValue.address.country = element.long_name;
  });

  return returnValue;
};

const generateLocation = async (data) => {
  if (process.env.DISABLE_GOOGLE_MAPS) return data;
  if (data?.placeId) {
    const home = await findPlaceDetailed(data.placeId);
    const location = home[0].geometry.location;
    const addressComponents = home[0].address_components;
    function getComponentByName(addressComponents, name) {
      const found = addressComponents.find((ac) => ac.types?.includes(name));
      if (!found) return null;
      return found.long_name;
    }
    data.address = {
      street: getComponentByName(addressComponents, "route"),
      houseNumber: getComponentByName(addressComponents, "street_number"),
      city: getComponentByName(addressComponents, "locality"),
      postcode: getComponentByName(addressComponents, "postal_code"),
      country: getComponentByName(addressComponents, "country"),
    };
    /*const addressResponse = await findAddressToLongLat(
      location.lng,
      location.lat
    );
    data.address = addressResponse.address;*/
    /*data.location = {
      coordinates: [location.lng, location.lat],
      type: "Point",
    };*/
  } else if (data?.location?.coordinates) {
    let longitude = data?.location?.coordinates[0];
    let latitude = data?.location?.coordinates[1];
    const addressResponse = await findAddressToLongLat(longitude, latitude);
    data.address = addressResponse.address;
  }
  return data;
};

//Create random lat/long coordinates in a specified radius around a center point
const obfuscateGeo = (center, radius) => {
  var y0 = center.latitude;
  var x0 = center.longitude;
  var rd = radius / 111300; //about 111300 meters in one degree

  var u = Math.random();
  var v = Math.random();

  var w = rd * Math.sqrt(u);
  var t = 2 * Math.PI * v;
  var x = w * Math.cos(t);
  var y = w * Math.sin(t);

  //Adjust the x-coordinate for the shrinking of the east-west distances
  var xp = x / Math.cos(y0);

  var newlat = y + y0;
  var newlon = x + x0;
  var newlon2 = xp + x0;

  return {
    latitude: newlat.toFixed(5),
    longitude: newlon2.toFixed(5),
    //    'distance': distance(center.latitude, center.longitude, newlat, newlon).toFixed(2),
    //    'distance2': distance(center.latitude, center.longitude, newlat, newlon2).toFixed(2),
  };
};

exports.findPlace = findPlace;
exports.findAddress = findAddress;
exports.findPlaceDetailed = findPlaceDetailed;
exports.findPlaceDetailedWithLongLat = findPlaceDetailedWithLongLat;
exports.findLongLat = findLongLat;
exports.findAddressToLongLat = findAddressToLongLat;
exports.generateLocation = generateLocation;
exports.obfuscateGeo = obfuscateGeo;
