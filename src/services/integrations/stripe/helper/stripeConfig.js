const stripe = require("stripe")(process.env.STRIPE_PRIVATE);

let subscriptionPlansStripe = {
  staging: [
    {
      title: "King Membership",
      description: "Party King monatlich",
      mode: "subscription",
      duration: "monthly",
      price: 1999,
      currency: "€",
      priceId: "price_1JQ8n0CFiriIz47Yv8wPbrEK",
    },
    {
      title: "King Membership",
      description: "Party King jährlich",
      mode: "subscription",
      duration: "yearly",
      price: 11999,
      currency: "€",
      priceId: "price_1JQ8n0CFiriIz47YfrIML75e",
    },
  ],
  production: [
    {
      title: "King Membership",
      description: "Party King monatlich",
      mode: "subscription",
      duration: "monthly",
      price: 1999,
      currency: "€",
      priceId: "price_1JQtAACFiriIz47YtC3DfeYR",
    },
    {
      title: "King Membership",
      description: "Party King jährlich",
      mode: "subscription",
      duration: "yearly",
      price: 11999,
      currency: "€",
      priceId: "price_1JQtAACFiriIz47YL94DFT2z",
    },
  ],
};

let pointPlansStripe = {
  staging: [
    {
      title: "1000",
      description: "",
      mode: "payment",
      price: 1999,
      currency: "€",
      priceId: "price_1M2BfYCFiriIz47YTj9oyxKf",
    },
    {
      title: "5250",
      description: "",
      mode: "payment",
      price: 9499,
      currency: "€",
      priceId: "price_1M2BfwCFiriIz47YEniX5WVz",
    },
    {
      title: "11000",
      description: "",
      mode: "payment",
      price: 17599,
      currency: "€",
      priceId: "price_1M2BgICFiriIz47YAhekXk8M",
    },
    {
      title: "42000",
      description: "",
      mode: "payment",
      price: 63999,
      currency: "€",
      priceId: "price_1M2BgbCFiriIz47YOczJsBQs",
    },
  ],
  production: [
    {
      title: "1000",
      description: "",
      mode: "payment",
      price: 1999,
      currency: "€",
      priceId: "price_1M2BcwCFiriIz47YdcEAhrVo",
    },
    {
      title: "5250",
      description: "",
      mode: "payment",
      price: 9499,
      currency: "€",
      priceId: "price_1M2BdjCFiriIz47Y50nUt6ge",
    },
    {
      title: "11000",
      description: "",
      mode: "payment",
      price: 17599,
      currency: "€",
      priceId: "price_1M2BeBCFiriIz47Ylt9y5Ocg",
    },
    {
      title: "42000",
      description: "",
      mode: "payment",
      price: 63999,
      currency: "€",
      priceId: "price_1M2BeoCFiriIz47YQC0djgEM",
    },
  ],
};

module.exports = {
  subscriptionPlansStripe: subscriptionPlansStripe[process.env.STAGE],
  pointPlansStripe: pointPlansStripe[process.env.STAGE],
  stripe,
};
