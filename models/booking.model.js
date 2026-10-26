import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    // Unique human-readable booking reference e.g., "SYD-K9J4M2"
    bookingNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },

    // Pickup location details (address, coordinates, or name)
    pickup: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // Dropoff location details (address, coordinates, or name)
    dropoff: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
      default: '',
    },

    // Date & Time for the scheduled pickup
    pickupTime: {
      type: Date,
      required: false,
      default: Date.now,
    },

    // Number of passengers
    passengers: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    // Vehicle Type requested
    vehicleType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Passenger contact details
    passengerName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    passengerPhone: {
      type: String,
      required: true,
      trim: true,
      index: true,
      alias: 'passengerPhon',
    },

    passengerEmail: {
      type: String,
      trim: true,
      default: '',
    },

    // Booking lifecycle status
    status: {
      type: String,
      required: true,
      enum: [
        'pending',
        'confirmed',
        'assigned',
        'on_the_way',
        'arrived',
        'in_progress',
        'completed',
        'cancelled',
      ],
      default: 'pending',
      index: true,
    },

    // Fare details (supports number or detailed breakdown)
    fare: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ currency: 'AUD', total: 0 }),
    },

    // Payment status
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'cash_to_driver', 'card'],
      default: 'pending',
    },

    // Internal notes or special requests
    notes: {
      type: String,
      default: '',
      trim: true,
    },

    // Reason if cancelled
    cancellationReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for fast lookup
bookingSchema.index({ passengerPhone: 1, createdAt: -1 });

export const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
