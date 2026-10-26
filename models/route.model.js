import mongoose from 'mongoose';

const locationDetailsSchema = new mongoose.Schema(
  {
    address: { type: String, default: '', trim: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    code: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    firstPlace: { type: String, required: true, trim: true, index: true },
    lastPlace: { type: String, required: true, trim: true, index: true },
    vehicleAndFares: {
      type: Map,
      of: Number,
      required: true,
      validate: [
        (val) => {
          if (!val) return false;
          const size = val instanceof Map ? val.size : Object.keys(val).length;
          return size >= 1;
        },
        'vehicleAndFares must contain at least 1 vehicle fare',
      ],
    },
    increaseFarePerPerson: {
      type: Map,
      of: Number,
      default: {},
    },
    currency: { type: String, default: 'AUD', trim: true, uppercase: true },
    distanceKm: { type: Number, default: null },
    durationMin: { type: Number, default: null },
    firstPlaceDetails: { type: locationDetailsSchema, default: () => ({}) },
    lastPlaceDetails: { type: locationDetailsSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: '', trim: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

routeSchema.index({ firstPlace: 1, lastPlace: 1 });

export const Route = mongoose.models.Route || mongoose.model('Route', routeSchema);
