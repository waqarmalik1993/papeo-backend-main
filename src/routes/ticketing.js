const validate = require("../modules/validation/validate.js");
const auth = require("../middleware/auth.js").auth;
const optionalAuth = require("../middleware/optionalAuth").optionalAuth;
const User = require("../services/users/usersService");
const Party = require("../services/parties/partiesService");
const TicketingShop = require("../services/ticketing/ticketingShopService");
const PartyGuest = require("../services/partyGuests/partyGuestsService");
const TicketingTicket = require("../services/ticketing/ticketingTicketService");
const MenuCardOrder = require("../services/menuCards/menuCardOrdersService");
const TicketingTransaction = require("../services/ticketing/ticketingTransactionService");
const TicketingUserTicket = require("../services/ticketing/ticketingUserTicketService");
const firebaseModule = require("../services/users/modules/firebase/users");
const { TicketingSchema } = require("../modules/validation/ticketing");
const stripeTicketing = require("../services/integrations/stripe/ticketingStripe");
const papeoError = require("../modules/errors/errors.js").papeoError;
const PAPEO_ERRORS = require("../modules/errors/errors.js").PAPEO_ERRORS;
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

// from https://stackoverflow.com/questions/6117814/get-week-of-year-in-javascript-like-in-php
function getWeekNumber(d) {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  var weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  // Return array of year and week number
  return [d.getUTCFullYear(), weekNo];
}

const { NotFound, BadRequest, Forbidden } = require("@feathersjs/errors");
const { Types } = require("mongoose");
module.exports = async (app) => {
  app.get("/ticketing/shops/onboard", auth, async (req, res) => {
    console.log(req.user._id);
    let ticketingShop = await TicketingShop.getTicketingShopForUser(
      req.user._id
    );
    if (!ticketingShop) {
      const stripeMerchant = await stripeTicketing.createExpressMerchantAccount(
        {
          userId: req.user._id.toString(),
        }
      );
      ticketingShop = await TicketingShop.create({
        user: req.user._id,
        stripeAccountId: stripeMerchant.id,
      });
    }
    // TODO
    const origin = process.env.API_ROOT_URL;
    const accountLinkURL = await stripeTicketing.generateOnboardingLink(
      ticketingShop.stripeAccountId,
      origin
    );
    res.send({
      onboardingUrl: accountLinkURL,
      stripeAccountId: ticketingShop.stripeAccountId,
    });
  });
  app.get("/ticketing/shops/dashboard", auth, async (req, res) => {
    const ticketingShop = await TicketingShop.getTicketingShopForUser(
      req.user._id
    );
    if (!ticketingShop) {
      throw new NotFound();
    }

    res.send({
      loginLink: await stripeTicketing.generateLoginLink(
        ticketingShop.stripeAccountId
      ),
    });
  });
  app.get(
    "/ticketing/shops/success",
    /* !!!! auth, */ async (req, res) => {
      res.send("success");
    }
  );
  app.get("/ticketing/shops", optionalAuth, async (req, res) => {
    res.send(
      await TicketingShop.find({ query: { user: req.user?._id, ...req.query } })
    );
  });
  app.get("/ticketing/parties/:partyId/tickets", auth, async (req, res) => {
    const { partyId } = req.params;
    const party = await Party.get(partyId);
    if (req.user._id.toString() !== party.owner.toString()) {
      req.query["visibility.hostOnly"] = false;

      if (!req.user.isAdmin) {
        req.query["visibility.adminsOnly"] = false;
      }
      const isUserAttendingPartyGuest =
        await PartyGuest.isUserAttendingPartyGuest(party._id, req.user._id);
      if (!isUserAttendingPartyGuest) {
        req.query["visibility.guestlistOnly"] = false;
      }
      const isFriendWithOwner = !!req.user.partyFriends.find(
        (pf) => pf.friend.toString() === party.owner.toString()
      );
      if (!isFriendWithOwner) {
        req.query["visibility.friendsOnly"] = false;
      }
    }
    res.send(
      await TicketingTicket.find({ query: { ...req.query, party: party._id } })
    );
  });
  // all tickets for dashboard
  app.get("/ticketing/parties/:partyId/tickets/all", auth, async (req, res) => {
    const { partyId } = req.params;
    const partyDb = await Party.get(partyId);
    if (partyDb.owner.toString() !== req.user._id.toString()) {
      throw new Forbidden();
    }
    const tickets = await TicketingTicket.MODEL.find({
      ...req.query,
      party: partyId,
    });
    res.send({
      totalBought: tickets.reduce((partialSum, a) => partialSum + a.bought, 0),
      totalAvailability: tickets.reduce(
        (partialSum, a) => partialSum + a.totalAvailability,
        0
      ),
      tickets,
    });
  });
  app.get("/ticketing/usertickets/all", auth, async (req, res) => {
    res.send(
      await TicketingUserTicket.MODEL.find({
        //...req.query,
        user: req.user._id,
      }).populate([
        {
          path: "ticket",
          select:
            "name party availability totalAvailability bought visibility price sellingStartDate sellingEndDate",
        },
        {
          path: "party",
          select:
            "name rating address location description tags placeId startDate endDate expired uploads privacyLevel ticketingSettings",
        },
        {
          path: "user",
          select: USER_POPULATION_FIELDS,
        },
      ])
    );
  });
  app.get(
    "/ticketing/usertickets/:userTicketId",
    auth,
    async (req, res, next) => {
      try {
        const userTicket = await TicketingUserTicket.get(
          req.params.userTicketId,
          {
            query: {
              $populate: [
                {
                  path: "ticket",
                  select:
                    "name party availability totalAvailability visibility price sellingStartDate sellingEndDate",
                },
                {
                  path: "party",
                  select:
                    "name rating address location description tags placeId startDate endDate expired uploads privacyLevel ticketingSettings",
                },
                {
                  path: "user",
                  select: USER_POPULATION_FIELDS,
                },
              ],
            },
          }
        );
        if (
          userTicket.user?._id?.toString() !== req.user._id.toString() &&
          userTicket.sharedWith?.toString() !== req.user._id.toString()
        ) {
          throw new Forbidden();
        }
        return res.send(userTicket);
      } catch (error) {
        next(error);
      }
    }
  );
  app.get("/ticketing/usertickets", auth, async (req, res) => {
    res.send(
      await TicketingUserTicket.find({
        query: {
          ...req.query,
          user: req.user._id,
          $populate: [
            {
              path: "ticket",
              select:
                "name party availability totalAvailability visibility price sellingStartDate sellingEndDate",
            },
            {
              path: "party",
              select:
                "name rating address location description tags placeId startDate endDate expired uploads privacyLevel ticketingSettings",
            },
            {
              path: "user",
              select: USER_POPULATION_FIELDS,
            },
          ],
        },
      })
    );
  });
  app.get(
    "/ticketing/parties/:partyId/usertickets",
    auth,
    async (req, res, next) => {
      try {
        const { partyId } = req.params;
        const { search } = req.query;
        if (search) {
          req.query.usernameLowercase = new RegExp(search.toLowerCase(), "i");
        }
        delete req.query.search;
        const party = await Party.get(partyId);
        if (
          !User.hasStaffRightsTo(
            req.user,
            party,
            User.staffRights.canScanTickets
          ) &&
          req.user._id.toString() !== party.owner.toString()
        ) {
          throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
        }

        res.send(
          await TicketingUserTicket.find({
            query: {
              ...req.query,
              party: partyId,
              $populate: [
                {
                  path: "ticket",
                  select:
                    "name party availability totalAvailability bought visibility price sellingStartDate sellingEndDate",
                },
                {
                  path: "party",
                  select:
                    "name rating address location description tags placeId startDate endDate expired uploads privacyLevel ticketingSettings",
                },
                {
                  path: "user",
                  select: USER_POPULATION_FIELDS,
                },
              ],
            },
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );
  app.patch(
    "/ticketing/usertickets/:userTicketId",
    auth,
    async (req, res, next) => {
      const { userTicketId } = req.params;
      try {
        validate(TicketingSchema.userTickets.PATCH, req.body);
        const userTicket = await TicketingUserTicket.get(userTicketId);
        if (req.body.sharedWith !== undefined) {
          if (req.body.sharedWith !== null) {
            if (userTicket.user.toString() !== req.user._id.toString()) {
              throw new Forbidden();
            }
          } else {
            if (
              userTicket.user.toString() !== req.user._id.toString() &&
              userTicket.sharedWith.toString() !== req.user._id.toString()
            ) {
              throw new Forbidden();
            }
          }
        }
        if (req.body.user !== undefined) {
          if (
            !userTicket.sharedWith ||
            req.body.user !== userTicket.sharedWith.toString()
          ) {
            throw new Forbidden();
          }
        }

        res.send(
          await TicketingUserTicket.patch(userTicketId, req.body, {
            user: req.user,
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );
  app.get("/ticketing/shops/myaccount", auth, async (req, res, next) => {
    try {
      const ticketingShop = await TicketingShop.getTicketingShopForUser(
        req.user._id
      );
      if (!ticketingShop) throw new NotFound();
      res.send(
        await stripeTicketing.getExpressMerchantAccount({
          accountId: ticketingShop.stripeAccountId,
        })
      );
    } catch (error) {
      next(error);
    }
  });
  app.get("/ticketing/mystripeaccount", auth, async (req, res, next) => {
    try {
      if (!req.user.stripeCustomerId) throw new NotFound();
      res.send(
        await stripeTicketing.getStripeCustomerExtendedPaymentMethods(
          req.user.stripeCustomerId
        )
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/ticketing/shops/:ticketingShopId", auth, async (req, res, next) => {
    try {
      const { ticketingShopId } = req.params;
      res.send(await TicketingShop.get(ticketingShopId));
    } catch (error) {
      next(error);
    }
  });
  app.post("/ticketing/tickets", auth, async (req, res, next) => {
    delete req.body._id;
    try {
      validate(TicketingSchema.tickets.POST, req.body);
      const body = req.body;
      const ticketShop = await TicketingShop.getTicketingShopForUser(
        req.user._id
      );
      if (!ticketShop) {
        throw new BadRequest("You must have a ticket shop to create a ticket");
      }
      if (!ticketShop.isActive) {
        throw new BadRequest("Your ticket shop setup is not completed");
      }
      const party = await Party.get(body.party);
      if (!party.owner.equals(req.user._id)) {
        throw new Forbidden(
          "You must be the owner of the party to create tickets"
        );
      }

      res.send(
        await TicketingTicket.create({
          ticketingShop: ticketShop._id,
          user: req.user._id,
          ...body,
        })
      );
    } catch (error) {
      next(error);
    }
  });
  app.patch("/ticketing/tickets/:ticketId", auth, async (req, res, next) => {
    const { ticketId } = req.params;
    try {
      validate(TicketingSchema.tickets.PATCH, req.body);
      const body = req.body;
      const ticket = await TicketingTicket.get(ticketId);
      if (!ticket.user.equals(req.user._id)) {
        throw new Forbidden("You must be the owner of the ticket to edit it");
      }

      res.send(await TicketingTicket.patch(ticket._id, body));
    } catch (err) {
      next(err);
    }
  });
  app.delete("/ticketing/tickets/:ticketId", auth, async (req, res, next) => {
    const { ticketId } = req.params;
    try {
      validate(TicketingSchema.tickets.PATCH, req.body);
      const ticket = await TicketingTicket.get(ticketId);
      if (!ticket.user.equals(req.user._id)) {
        throw new Forbidden("You must be the owner of the ticket to delete it");
      }
      res.send(
        await TicketingTicket.patch(ticket._id, {
          deleted: true,
          paused: true,
        })
      );
    } catch (err) {
      next(err);
    }
  });
  app.post("/ticketing/setuppaymentmethod", auth, async (req, res, next) => {
    try {
      const stripeCustomer = await User.createStripeCustomerIfNotExists(
        req.user
      );
      const result = await stripeTicketing.createSetupIntent(stripeCustomer);
      res.send(result);
    } catch (error) {
      next(error);
    }
  });
  app.post("/ticketing/tickets/purchase", auth, async (req, res, next) => {
    function unique(value, index, self) {
      return self.indexOf(value) === index;
    }
    try {
      validate(TicketingSchema.tickets.purchase, req.body);
      const { applepay, googlepay } = req.query;
      const orderWithTicketObjects = await Promise.all(
        req.body.orders.map(async (order) => ({
          ticket: await TicketingTicket.get(order.ticketId),
          ...order,
        }))
      );
      // check if all tickets are from the same merchant
      const merchantIds = orderWithTicketObjects
        .map((o) => o.ticket.ticketingShop.toString())
        .filter(unique);
      if (merchantIds.length > 1) {
        throw new BadRequest("Orders from different merchants are not allowed");
      }
      // check if all tickets are from the same party
      const partyIds = orderWithTicketObjects
        .map((o) => o.ticket.party.toString())
        .filter(unique);
      if (partyIds.length > 1) {
        throw new BadRequest("Orders from different parties are not allowed");
      }
      // check if ticket.sellingEndDate is reached or ticket.sellingStartDate is not reached
      const tickets = orderWithTicketObjects.map((o) => o.ticket);
      const now = new Date();
      const ticketsWithExpiredSellingEndDate = tickets.filter(
        (t) => t.sellingEndDate < now
      );
      if (ticketsWithExpiredSellingEndDate.length > 0) {
        throw new BadRequest("Ticket selling end date is reached");
      }
      const ticketsWithNotStartedSellingStartDate = tickets.filter(
        (t) => t.sellingStartDate > now
      );
      if (ticketsWithNotStartedSellingStartDate.length > 0) {
        throw new BadRequest("Ticket selling start date is not reached");
      }

      const party = await Party.get(partyIds[0]);
      if (party.cancelled) {
        throw papeoError(PAPEO_ERRORS.CANNOT_BUY_TICKET_PARTY_IS_CANCELLED);
      }
      const ticketingShop = await TicketingShop.get(merchantIds[0]);

      if (
        !req.user.stripeCustomerId &&
        applepay !== "true" &&
        googlepay !== "true"
      ) {
        throw new BadRequest("No customer or payment method created");
      }
      const paymentIntent = await TicketingTicket.purchase(
        req.user,
        ticketingShop,
        partyIds[0],
        orderWithTicketObjects,
        // dont use default payment method when payed with googlepay or applepay
        applepay !== "true" && googlepay !== "true"
      );
      res.send({
        clientSecret: paymentIntent.client_secret,
        paymentMethod: paymentIntent.payment_method,
        paymentIntent: paymentIntent.id,
        accountId: ticketingShop.stripeAccountId,
      });
    } catch (error) {
      next(error);
    }
  });
  app.post(
    "/ticketing/tickets/calculateprice",
    auth,
    async (req, res, next) => {
      try {
        validate(TicketingSchema.tickets.calculateTicketFees, req.body);
        res.send(TicketingTicket.calculatePrice(req.body));
      } catch (error) {
        next(error);
      }
    }
  );
  app.post("/ticketing/cancelparty", auth, async (req, res, next) => {
    try {
      validate(TicketingSchema.tickets.cancelParty, req.body);
      const body = req.body;
      const party = await Party.get(body.party);

      if (!party.owner.equals(req.user._id)) {
        throw new Forbidden("You must be the owner of the party to cancel it");
      }
      if (party.cancelled) {
        throw new BadRequest("Party is already cancelled");
      }
      const ticketShop = await TicketingShop.getTicketingShopForUser(
        req.user._id
      );
      if (!ticketShop) {
        throw new BadRequest("You must have a ticket shop to cancel a party");
      }
      if (!ticketShop.isActive) {
        throw new BadRequest("Your ticket shop setup is not completed");
      }

      await Party.cancelParty(party._id);
      const partyGuests = await PartyGuest.MODEL.find({
        party: party._id,
      }).populate("user");
      if (body.message) {
        await Promise.all(
          partyGuests.map(async (pg) => {
            return await firebaseModule.sendPartyMessage({
              senderId: req.user._id,
              receiverId: pg.user._id,
              party,
              message: body.message,
            });
          })
        );
      }
      res.send({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  app.post("/ticketing/usertickets/checkin", auth, async (req, res, next) => {
    try {
      validate(TicketingSchema.userTickets.checkin, req.body);

      const userTicket = await TicketingUserTicket.MODEL.findOne({
        qrCodeValue: req.body.qrCodeValue,
        party: req.body.party,
      });
      if (!userTicket) throw new NotFound();
      if (userTicket.refunded)
        throw papeoError(PAPEO_ERRORS.TICKETING_TICKET_WAS_REFUNDED);
      const party = await Party.get(req.body.party);
      if (
        !User.hasStaffRightsTo(
          req.user,
          party,
          User.staffRights.canScanTickets
        ) &&
        req.user._id.toString() !== party.owner.toString()
      ) {
        throw papeoError(PAPEO_ERRORS.WRONG_USER_ROLE);
      }

      if (userTicket.checkedIn) {
        throw papeoError(PAPEO_ERRORS.TICKET_ALREADY_SCANNED);
      }
      const result = await TicketingUserTicket.patch(userTicket._id, {
        checkedIn: true,
        checkedInDate: new Date(),
      });
      const [user, ticket] = await Promise.all([
        User.get(result.user),
        TicketingTicket.get(result.ticket),
      ]);
      res.send({ ...result, party, user, ticket });
    } catch (error) {
      next(error);
    }
  });

  app.get("/ticketing/shops/stats/revenue", auth, async (req, res, next) => {
    try {
      let { year } = req.query;
      year = parseInt(year);
      if (!year) {
        throw new BadRequest("queryparameter year not set");
      }
      const ticketingShop = await TicketingShop.MODEL.findOne({
        user: req.user._id,
      });
      if (!ticketingShop) throw new NotFound("ticketingshop not found");
      const pipeline = [
        {
          $match: {
            ticketingShop: ticketingShop._id,
            status: "succeeded",
            createdAt: {
              $gte: new Date(`${year}-01-01T00:00:00.000Z`),
              $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
            },
          },
        },
        {
          $project: {
            amount: 1,
            month: { $month: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$month",
            sum: { $sum: "$amount" },
          },
        },
      ];
      const ticketRevenuePipelineResult =
        await TicketingTransaction.MODEL.aggregate(pipeline);
      let ticketRevenue = ticketRevenuePipelineResult.map((r) => ({
        month: r._id,
        revenueTickets: r.sum,
      }));

      // menucard revenue
      const successfulMenuCardOrders = await MenuCardOrder.MODEL.find({
        ticketingShop: ticketingShop._id,
        createdAt: {
          $gte: new Date(`${year}-01-01T00:00:00.000Z`),
          $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`),
        },
        status: "successful",
      })
        .select("orders paymentMethod createdAt")
        .lean();

      const menuCardRevenue = [];
      for (const order of successfulMenuCardOrders) {
        const month = order.createdAt.getMonth() + 1;
        const total = MenuCardOrder.calculateGrossTotal(order, true);

        const found = menuCardRevenue.find((r) => r.month === month);
        if (found) {
          found.revenueMenuCard += total.eur;
        } else {
          menuCardRevenue.push({ month, revenueMenuCard: total.eur });
        }
      }
      const result = [];
      // add revenues together
      for (let i = 1; i <= 12; i++) {
        const ticketRevenueEntry = ticketRevenue.find((r) => r.month === i);
        const menuCardRevenueEntry = menuCardRevenue.find((r) => r.month === i);

        const totalRevenue =
          (ticketRevenueEntry?.revenueTickets || 0) +
          (menuCardRevenueEntry?.revenueMenuCard || 0);

        const revenueTickets = ticketRevenueEntry?.revenueTickets || 0;
        const revenueMenuCard = menuCardRevenueEntry?.revenueMenuCard || 0;
        result.push({
          month: i,
          revenue: totalRevenue,
          revenueTickets: revenueTickets,
          revenueMenuCard: revenueMenuCard,
        });
      }
      console.log({ menuCardRevenue });
      res.send({
        year,
        totalRevenue: result.reduce(
          (partialSum, a) => partialSum + a.revenue,
          0
        ),
        revenue: result,
      });
    } catch (error) {
      next(error);
    }
  });
  app.get(
    "/ticketing/parties/:partyId/stats/revenue",
    auth,
    async (req, res, next) => {
      try {
        let { partyId } = req.params;
        const party = await Party.get(partyId);
        if (!party) throw new NotFound();
        /*if (party.owner.toString() !== req.user._id.toString()) {
          throw new Forbidden();
        }*/
        // Tickets sold
        const pipeline = [
          {
            $match: {
              party: party._id,
              status: "succeeded",
            },
          },
          {
            $project: {
              amount: 1,
              week: { $week: "$createdAt" },
              year: { $year: "$createdAt" },
            },
          },

          {
            $project: {
              amount: 1,
              week: 1,
              year: 1,
              weekyear: {
                $concat: [
                  { $substr: ["$year", 0, -1] },
                  "-",
                  { $substr: ["$week", 0, -1] },
                ],
              },
            },
          },
          {
            $group: {
              _id: "$weekyear",
              ticketSales: { $sum: "$amount" },
            },
          },
        ];
        let ticketingRevenue = await TicketingTransaction.MODEL.aggregate(
          pipeline
        );

        ticketingRevenue = ticketingRevenue.map((r) => ({
          _id: r._id,
          sum: r.ticketSales,
          ticketSalesEur: r.ticketSales,
          menuCardSalesEur: 0,
          menuCardSalesPP: 0,
        }));

        // menucard revenue
        const successfulMenuCardOrders = await MenuCardOrder.MODEL.find({
          party: party._id,
          status: "successful",
        })
          .select("orders paymentMethod createdAt")
          .lean();

        const menuCardRevenue = {};
        for (const order of successfulMenuCardOrders) {
          const total = MenuCardOrder.calculateGrossTotal(order, true);
          const key = `${order.createdAt.getFullYear()}-${
            getWeekNumber(order.createdAt)[1]
          }`; // 2021-34, 2021-1
          if (!menuCardRevenue[key]) {
            menuCardRevenue[key] = {
              _id: key,
              sum: 0,
              ticketSalesEur: 0,
              menuCardSalesEur: 0,
              menuCardSalesPP: 0,
            };
          }
          menuCardRevenue[key].menuCardSalesPP += total.pp;
          menuCardRevenue[key].menuCardSalesEur += total.eur;
          menuCardRevenue[key].sum += total.eur;
        }

        // merge ticketing and menucard revenue
        for (const key in menuCardRevenue) {
          const menuCardRevenueItem = menuCardRevenue[key];
          const ticketingRevenueItem = ticketingRevenue.find(
            (r) => r._id === key
          );
          if (ticketingRevenueItem) {
            ticketingRevenueItem.menuCardSalesPP =
              menuCardRevenueItem.menuCardSalesPP;
            ticketingRevenueItem.menuCardSalesEur =
              menuCardRevenueItem.menuCardSalesEur;
            ticketingRevenueItem.sum += menuCardRevenueItem.menuCardSalesEur;
          } else {
            ticketingRevenue.push(menuCardRevenueItem);
          }
        }

        res.send({
          party: partyId,
          totalRevenue: ticketingRevenue.reduce(
            (partialSum, a) => partialSum + a.sum,
            0
          ),
          revenue: ticketingRevenue,
        });
      } catch (error) {
        next(error);
      }
    }
  );
  app.get(
    "/ticketing/parties/:partyId/stats/revenue/menucard",
    auth,
    async (req, res, next) => {
      try {
        let { partyId } = req.params;
        const party = await Party.get(partyId);
        if (!party) throw new NotFound();
        /*if (party.owner.toString() !== req.user._id.toString()) {
          throw new Forbidden();
        }*/
        const successfulMenuCardOrders = await MenuCardOrder.MODEL.find({
          party: party._id,
          status: "successful",
        })
          .select("orders staff paymentMethod")
          .lean();
        /*
          Format:
          {
              "6391e426fffc40645ae48817": {
                  "quantity": 7,
                  "articleName": "Gin Tonic 1",
                  "categoryName": "Category 1"
              },
              "6391f4f57443e3671ca42519": {
                  "quantity": 8,
                  "articleName": "Gin Tonic 2",
                  "categoryName": "Category 1"
              }
          }
        */
        const boughtArticles = {};
        for (const entry of successfulMenuCardOrders) {
          for (const order of entry.orders) {
            if (boughtArticles[order.articleId.toString()] === undefined) {
              boughtArticles[order.articleId.toString()] = {
                quantity: order.quantity,
                articleName: order.article.name,
                categoryName: order.categoryName,
              };
            } else {
              boughtArticles[order.articleId.toString()].quantity +=
                order.quantity;
            }
          }
        }
        /*
          Format:
          [
              {
                  "quantity": 7,
                  "articleName": "Gin Tonic 1",
                  "categoryName": "Category 1",
                  "articleId": "6391e426fffc40645ae48817"
              },
              {
                  "quantity": 8,
                  "articleName": "Gin Tonic 2",
                  "categoryName": "Category 1",
                  "articleId": "6391f4f57443e3671ca42519"
              }
          ]
        */
        const transformed = Object.keys(boughtArticles).map((articleId) => ({
          ...boughtArticles[articleId],
          articleId,
        }));
        const staffStats = {};
        let totalPP = 0;
        let totalEur = 0;
        // totalPP and total Eur berechnen, order.paymentMethod beachten
        for (const order of successfulMenuCardOrders) {
          const grossTotal = MenuCardOrder.calculateGrossTotal(order, true);
          totalPP += grossTotal.pp;
          totalEur += grossTotal.eur;
          if (staffStats[order.staff.toString()] === undefined) {
            staffStats[order.staff.toString()] = {
              staffId: order.staff.toString(),
              totalEur: grossTotal.eur,
              totalPP: grossTotal.pp,
            };
          } else {
            staffStats[order.staff.toString()].totalEur += grossTotal.eur;
            staffStats[order.staff.toString()].totalPP += grossTotal.pp;
          }
        }
        const transformedStaff = Object.keys(staffStats).map((staffId) => ({
          ...staffStats[staffId],
          staffId,
        }));
        const populatedStaff = await Promise.all(
          transformedStaff.map(async (staff) => {
            try {
              const staffDb = await User.MODEL.findById({ _id: staff.staffId })
                .select(USER_POPULATION_FIELDS)
                .lean();
              // const staffParty = party.staff.find(
              //   (s) => s.user.toString() === staff.staffId
              // );
              return {
                ...staff,
                staff: staffDb ? staffDb : null,
              };
            } catch (error) {
              return {
                ...staff,
                staff: null,
              };
            }
          })
        );
        res.send({
          totalPP,
          totalEur,
          staffStats: populatedStaff,
          articleStats: transformed,
        });
      } catch (error) {
        next(error);
      }
    }
  );
};
