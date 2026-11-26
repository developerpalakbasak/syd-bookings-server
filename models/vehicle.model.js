import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    models: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    maxPassengers: {
      type: Number,
      required: true,
      default: 4,
      min: 1,
    },
    maxCheckin: {
      type: Number,
      required: true,
      default: 2,
      min: 0,
    },
    maxCarryon: {
      type: Number,
      required: true,
      default: 2,
      min: 0,
    },
    trailerAvailable: {
      type: Boolean,
      default: false,
    },
    multiplier: {
      type: Number,
      required: true,
      default: 1.0,
      min: 0.1,
    },
    baseFareAUD: {
      type: Number,
      required: true,
      default: 158.7,
      min: 0,
    },
    image: {
      type: String,
      default: '/images/fleet/executive-sedan.jpg',
    },
    included: {
      type: [String],
      default: [
        'Fixed price — all tolls, taxes & airport fees included',
        'Free waiting time & real-time flight tracking',
        'Free cancellation up to 4 hours before pick-up',
        'Professional accredited chauffeur & meet-and-greet',
      ],
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Vehicle =
  mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);
