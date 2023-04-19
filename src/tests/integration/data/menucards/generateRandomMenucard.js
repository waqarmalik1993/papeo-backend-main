const faker = require("faker");
faker.locale = "de";
const { ObjectId } = require("mongoose").Types;
exports.generateMenucard = (data) => {
  const date = faker.date.future();
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);

  return {
    name: "Menükarte #1",
    cashPaymentAllowed: true,
    ppPaymentAllowed: false,
    ppPaymentLimit: 0,
    info: "dfgbv",
    isDraft: true,
    ppPaymentLimited: false,
    categories: [
      {
        name: "Category 1",
        upload: null,
        articles: [
          {
            name: "Gin Tonic",
            description: "mmm lecker lecker",
            pricePP: 10000,
            upload: null,
            price: {
              net: 1000,
              taxPerMille: 1900,
            },
          },
        ],
      },
    ],
    ...data,
  };
};
