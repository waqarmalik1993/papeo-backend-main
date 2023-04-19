const faker = require("faker");
faker.locale = "de";
const { ObjectId } = require("mongoose").Types;
exports.generateUserTicket = () => {
  const date = faker.date.future();
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);

  return {
    ticketingShop: ObjectId(),
    party: ObjectId(),
    user: ObjectId(),
    ticket: ObjectId(),
    qrCodeValue: "test",
    purchasedPrice: 1000,
    allowExternalSharing: true,
    allowInternalSharing: true,
  };
};
