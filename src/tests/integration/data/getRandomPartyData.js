const faker = require("faker");
faker.locale = "de";

function generateNearbyCoords() {
  const coords = faker.address
    .nearbyGPSCoordinate(["52.5411171", "13.3509304"])
    .map((c) => parseFloat(c));
  return [coords[1], coords[0]];
}
exports.generateParty = () => {
  const date = faker.date.future();
  const endDate = new Date(date);
  endDate.setTime(date.getTime() + 24 * 60 * 60 * 1000);

  return {
    // rating: { avg: null, count: null },
    location: {
      type: "Point",
      coordinates: generateNearbyCoords(),
    },
    name:
      faker.vehicle.manufacturer() + " Party at " + faker.company.companyName(),
    //organizers: [],
    description: faker.lorem.words(20),
    tags: ["bunkerrave", "techno"],
    status: "published",
    entranceFeeText: faker.lorem.words(5),
    capacity: 100,
    informationForAcceptedGuests: faker.lorem.words(20),
    startDate: date.toISOString(),
    endDate: endDate.toISOString(),
    //calculatedEndDate: endDate.toISOString(),
    type: "private",
    privacyLevel: "open",
    ticketingSettings: {
      allowExternalSharing: true,
      allowInternalSharing: true,
      limitTicketPurchasesPerUser: false,
      ticketPurchasesPerUser: 0,
      guestlistPurchaseOnly: false,
      boxOffice: false,
    },
    /*nameUpdatedDate: null,
    descriptionUpdatedDate: null,
    addressUpdatedDate: null,
    entranceFeeUpdatedDate: null,
    capacityUpdatedDate: null,
    informationForAcceptedGuestsUpdatedDate: null,
    startDateUpdatedDate: null,
    endDateUpdatedDate: null,*/
    //owner: owner.toString(),
    //uploads: [],
    //updatedAt: faker.date.past(),
    //createdAt: faker.date.past(),
  };
};
