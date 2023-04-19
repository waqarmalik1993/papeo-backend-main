const User = require("../services/users/usersService.js");

const Menucard = require("../services/menuCards/menuCardsService");
const MenuCardOrder = require("../services/menuCards/menuCardOrdersService");
const Party = require("../services/parties/partiesService");

const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const { MenuCardsSchema } = require("../modules/validation/menuCards");
const { BadRequest, Forbidden, NotFound } = require("@feathersjs/errors");

const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
const papeoError = require("../modules/errors/errors.js").papeoError;
const USER_POPULATION_FIELDS = {
  partyFriends: 1,
  _id: 1,
  obfuscatedHomeLocation: 1,
  verification: 1,
  rating: 1,
  firstName: 1,
  lastName: 1,
  fullName: 1,
  username: 1,
  languageSetting: 1,
  usernameLowercase: 1,
  locked: 1,
  roles: 1,
  sex: 1,
  city: 1,
  parties: 1,
  profileTags: 1,
  profilePicture: 1,
  firstLogin: 1,
  firstLoginAt: 1,
  lastLoginAt: 1,
  lastActivityAt: 1,
  birthday: 1,
  failedLoginAttempts: 1,
  successfulLoginCount: 1,
  isPartyKing: 1,
  isArtist: 1,
  referredBy: 1,
  createdAt: 1,
  updatedAt: 1,
  __v: 1,
  isArtistUpdatedDate: 1,
  artistDescription: 1,
  isAdmin: 1,
  isSuperAdmin: 1,
  attendedCompetitionParty: 1,
  obfuscatedCurrentLocation: 1,
  description: 1,
  referralCodes: 1,
};
module.exports = async (app) => {
  app.post("/menucards", auth, async (req, res, next) => {
    try {
      validate(MenuCardsSchema.POST, req.body);
      return res.send(
        await Menucard.create({
          ...req.body,
          user: req.user._id,
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.put("/menucards/:menuCardId", auth, async (req, res, next) => {
    try {
      validate(MenuCardsSchema.PUT, req.body);
      const { menuCardId } = req.params;
      const menuCard = await Menucard.get(menuCardId);
      if (menuCard.user.toString() !== req.user._id.toString()) {
        throw new Forbidden();
      }
      return res.send(
        await Menucard.patch(menuCardId, {
          ...req.body,
        })
      );
    } catch (e) {
      next(e);
    }
  });
  app.post("/menucards/:menuCardId/order", auth, async (req, res, next) => {
    try {
      validate(MenuCardsSchema.order, req.body);
      const { menuCardId } = req.params;
      const order = await MenuCardOrder.create({
        ...req.body,
        menuCard: menuCardId,
        user: req.user._id,
      });
      const priceTotal = MenuCardOrder.calculateGrossTotal(order);
      const response = {
        order: {
          ...order,
          totalPrice: priceTotal.eur,
          totalPricePP: priceTotal.pp,
          user: await User.get(order.user),
          paymentInformation: undefined,
        },
        paymentInformation: order.paymentInformation,
      };
      return res.send(response);
    } catch (e) {
      next(e);
    }
  });
  app.post("/menucards/calculatefees", auth, async (req, res, next) => {
    try {
      validate(MenuCardsSchema.calculateFees, req.body);
      res.send(Menucard.calculatePrice(req.body, 0));
    } catch (error) {
      next(error);
    }
  });
  app.post("/menucards/scan", auth, async (req, res, next) => {
    try {
      validate(MenuCardsSchema.scan, req.body);
      const order = await MenuCardOrder.MODEL.findOne({
        qrCodeValue: req.body.qrCodeValue,
        party: req.body.party,
      })
        .populate([
          {
            path: "user",
            select: USER_POPULATION_FIELDS,
          },
          {
            path: "staff",
            select: USER_POPULATION_FIELDS,
          },
        ])
        .lean();
      if (!order) throw new NotFound();
      const price = MenuCardOrder.calculateGrossTotal(order);
      return res.send({
        totalPrice: price.eur,
        totalPricePP: price.pp,
        ...order,
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/menucards/:menuCardId", auth, async (req, res, next) => {
    try {
      const { menuCardId } = req.params;
      return res.send(await Menucard.get(menuCardId));
    } catch (e) {
      next(e);
    }
  });
  app.get("/menucards", auth, async (req, res, next) => {
    try {
      return res.send(await Menucard.find({ query: { ...req.query } }));
    } catch (e) {
      next(e);
    }
  });
  app.delete("/menucards/:menuCardId", auth, async (req, res, next) => {
    try {
      const { menuCardId } = req.params;
      const menuCard = await Menucard.get(menuCardId);
      if (menuCard.user.toString() !== req.user._id.toString()) {
        throw new Forbidden();
      }
      return res.send(await Menucard.remove(menuCardId));
    } catch (e) {
      next(e);
    }
  });
  app.patch(
    "/menucardorders/:menuCardOrderId/status",
    auth,
    async (req, res, next) => {
      try {
        validate(MenuCardsSchema.orders.PATCH_status, req.body);
        const { menuCardOrderId } = req.params;
        const menuCardOrder = await MenuCardOrder.get(menuCardOrderId);
        const party = await Party.get(menuCardOrder.party);
        if (
          !User.hasStaffRightsTo(
            req.user,
            party,
            User.staffRights.canScanOrders
          )
        ) {
          throw new Forbidden();
        }
        const result = await MenuCardOrder.patch(menuCardOrderId, {
          ...req.body,
          staff: req.user._id,
        });
        return res.send(result);
      } catch (e) {
        next(e);
      }
    }
  );
  app.patch(
    "/menucardorders/:menuCardOrderId",
    auth,
    async (req, res, next) => {
      try {
        validate(MenuCardsSchema.orders.PATCH, req.body);
        const { menuCardOrderId } = req.params;
        const menuCardOrder = await MenuCardOrder.get(menuCardOrderId);
        if (menuCardOrder.user.toString() !== req.user._id.toString()) {
          throw new Forbidden();
        }
        const result = await MenuCardOrder.patch(
          menuCardOrderId,
          {
            ...req.body,
          },
          {
            query: {
              $populate: [
                {
                  path: "user",
                  select: USER_POPULATION_FIELDS,
                },
                {
                  path: "staff",
                  select: USER_POPULATION_FIELDS,
                },
              ],
            },
          }
        );
        return res.send(result);
      } catch (e) {
        next(e);
      }
    }
  );
  app.get("/menucardorders", auth, async (req, res, next) => {
    try {
      const orders = await MenuCardOrder.find({
        query: {
          ...req.query,
          user: req.user._id,
          $populate: [
            {
              path: "user",
              select: USER_POPULATION_FIELDS,
            },
            {
              path: "staff",
              select: USER_POPULATION_FIELDS,
            },
          ],
        },
      });

      orders.data = orders.data.map((order) => {
        const price = MenuCardOrder.calculateGrossTotal(order);
        return {
          totalPrice: price.eur,
          totalPricePP: price.pp,
          ...order,
        };
      });
      return res.send(orders);
    } catch (e) {
      next(e);
    }
  });
  app.get("/parties/:partyId/menucardorders", auth, async (req, res, next) => {
    try {
      const { partyId } = req.params;
      const party = await Party.get(partyId);
      if (
        !User.hasStaffRightsTo(
          req.user,
          party,
          User.staffRights.canScanOrders
        ) ||
        !User.hasStaffRightsTo(req.user, party, User.staffRights.canScanTickets)
      ) {
        throw new Forbidden();
      }
      const orders = await MenuCardOrder.find({
        query: {
          ...req.query,
          party: partyId,
          $populate: [
            {
              path: "user",
              select: USER_POPULATION_FIELDS,
            },
            {
              path: "staff",
              select: USER_POPULATION_FIELDS,
            },
          ],
        },
      });
      orders.data = orders.data.map((order) => {
        const price = MenuCardOrder.calculateGrossTotal(order);
        return {
          totalPrice: price.eur,
          totalPricePP: price.pp,
          ...order,
        };
      });
      return res.send(orders);
    } catch (e) {
      next(e);
    }
  });
};
