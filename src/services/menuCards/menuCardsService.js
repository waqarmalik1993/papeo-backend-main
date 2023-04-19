const service = require("feathers-mongoose");
const Model = require("../../models/menuCards.model");
const Party = require("../parties/partiesService");
const options = {
  Model: Model(),
  paginate: {
    default: 10,
    max: 1000,
  },
  multi: [],
  whitelist: [],
};
exports.MODEL = options.Model;

const create = async (data) => {
  data.categories = calculatePricesForMenuCardCategoriesAndItems(
    data.categories
  );
  const result = await service(options).create(data);
  return result;
};
const get = async (id) => {
  const result = await service(options).get(id);
  return result;
};
const find = async (params) => {
  const result = await service(options).find(params);
  return result;
};
const patch = async (id, data, params) => {
  data.categories = calculatePricesForMenuCardCategoriesAndItems(
    data.categories
  );
  let result = await service(options).patch(id, data, params);
  return result;
};

const remove = async (id, params) => {
  const result = await service(options).remove(id, params);
  await Party.MODEL.updateMany({ menuCard: id }, { menuCard: null });
  return result;
};

const calculateFees = (net, platformFeePercent) => {
  return Math.round(net * (platformFeePercent / 100));
};
exports.calculateFees = calculateFees;
const calculateTax = (net, taxPerMille) => {
  return Math.round((net * taxPerMille) / 1000);
};
exports.calculateTax = calculateTax;
const calculatePrice = (price, platformFeePercent = 10) => {
  if (!price.net) throw new Error("item has not net price");
  if (!price.taxPerMille && price.taxPerMille !== 0) {
    throw new Error("item has not taxPerMille");
  }
  const net = price.net;
  const taxPerMille = price.taxPerMille;
  const fees = calculateFees(net, platformFeePercent);
  const tax = calculateTax(net, taxPerMille);
  const gross = net + tax;
  const total = gross + fees;
  return {
    taxPerMille,
    net,
    gross,
    fees,
    tax,
    total,
  };
};
exports.calculatePrice = calculatePrice;
const calculatePricesForMenuCardCategoriesAndItems = (menuCardCategories) => {
  return menuCardCategories.map((category) => ({
    ...category,
    articles: category.articles.map((article) => ({
      ...article,
      price: calculatePrice(article.price, 0),
    })),
  }));
};
exports.calculatePricesForMenuCardCategoriesAndItems =
  calculatePricesForMenuCardCategoriesAndItems;

const getArticlesWithCategoryName = (menuCard) => {
  const articles = [];
  for (const category of menuCard.categories) {
    for (const article of category.articles) {
      articles.push({ article, categoryName: category.name });
    }
  }
  return articles;
};
exports.getArticlesWithCategoryName = getArticlesWithCategoryName;
exports.patch = patch;
exports.get = get;
exports.find = find;
exports.remove = remove;

exports.create = create;
