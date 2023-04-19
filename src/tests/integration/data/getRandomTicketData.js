const faker = require("faker");
faker.locale = "de";
exports.generateTicket = () => {
  const sellingStartDate = faker.date.past();
  const sellingEndDate = faker.date.future();

  return {
    name: "Test",
    totalAvailability: 100,
    sellingStartDate: sellingStartDate.toISOString(),
    sellingEndDate: sellingEndDate.toISOString(),
    paused: false,
    visibility: {
      hostOnly: false,
      adminsOnly: false,
      friendsOnly: false,
      guestlistOnly: false,
    },
    price: {
      net: 1000,
      taxPerMille: 190,
    },
  };
};
