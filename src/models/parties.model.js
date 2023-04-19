const mongoose = require("mongoose");

const { Schema } = mongoose;
module.exports = function () {
  const modelName = "parties";
  const schema = new mongoose.Schema(
    {
      name: {
        type: String,
        default: null,
      },
      owner: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      admins: [
        {
          user: {
            type: Schema.Types.ObjectId,
            ref: "users",
          },
          rights: {
            canManageParty: { type: Boolean, default: false },
            canManageGuestlist: { type: Boolean, default: false },
            canManagePartyPhotos: { type: Boolean, default: false },
            canBroadcastMessages: { type: Boolean, default: false },
            canSeeAdminHistory: { type: Boolean, default: false },
          },
        },
      ],
      staff: [
        {
          user: {
            type: Schema.Types.ObjectId,
            ref: "users",
          },
          responsibility: { type: String },
          rights: {
            canScanTickets: { type: Boolean, default: false },
            canScanOrders: { type: Boolean, default: false },
          },
        },
      ],
      rating: {
        avg: {
          type: Number,
          default: null,
        },
        count: {
          type: Number,
          default: 0,
        },
      },
      description: { type: String, default: null },
      tags: [{ type: String }],
      status: {
        type: String,
        enum: ["draft", "ready_for_review", "published"],
        default: "draft",
      },
      type: { type: String, enum: ["private", "commercial"] },
      privacyLevel: { type: String, enum: ["closed", "open", "secret"] },
      placeId: { type: String, default: null },
      address: {
        street: { type: String, default: null },
        houseNumber: { type: String, default: null },
        city: { type: String, default: null },
        postcode: { type: String, default: null },
        country: { type: String, default: null },
      },
      location: {
        type: {
          type: String, // Don't do `{ location: { type: String } }`
          enum: ["Point"], // 'location.type' must be 'Point'
          default: "Point",
        },
        coordinates: {
          type: [],
          default: null,
          index: { type: "2dsphere", sparse: false },
        },
      },
      ticketingSettings: {
        type: {
          allowExternalSharing: { type: Boolean, default: false },
          allowInternalSharing: { type: Boolean, default: false },
          limitTicketPurchasesPerUser: { type: Boolean, default: false },
          ticketPurchasesPerUser: { type: Number, default: 0 },
          guestlistPurchaseOnly: { type: Boolean, default: false },
          boxOffice: { type: Boolean, default: false },
        },
      },
      entranceFeeText: { type: String, default: null },
      capacity: { type: Number, default: null },
      informationForAcceptedGuests: { type: String, default: null },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      calculatedEndDate: { type: Date, default: null },
      expired: { type: Boolean, default: false },
      expired12h: { type: Boolean, default: false },
      cancelled: { type: Boolean, default: false },
      uploads: [
        {
          type: Schema.Types.ObjectId,
          ref: "uploads",
          default: null,
        },
      ],
      competition: {
        type: Schema.Types.ObjectId,
        ref: "competitions",
        default: null,
      },
      nameUpdatedDate: {
        type: Date,
        default: null,
      },
      descriptionUpdatedDate: {
        type: Date,
        default: null,
      },
      addressUpdatedDate: {
        type: Date,
        default: null,
      },
      entranceFeeUpdatedDate: {
        type: Date,
        default: null,
      },
      capacityUpdatedDate: {
        type: Date,
        default: null,
      },
      informationForAcceptedGuestsUpdatedDate: {
        type: Date,
        default: null,
      },
      startDateUpdatedDate: {
        type: Date,
        default: null,
      },
      endDateUpdatedDate: {
        type: Date,
        default: null,
      },
      inviteToken: { type: String, select: false },
      menuCard: {
        type: Schema.Types.ObjectId,
        ref: "menucards",
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );
  schema.index({
    name: "text",
    description: "text",
    "address.city": "text",
    tags: "text",
  });
  // This is necessary to avoid models compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongoose.modelNames().includes(modelName)) {
    mongoose.deleteModel(modelName);
  }
  return mongoose.model(modelName, schema);
};
