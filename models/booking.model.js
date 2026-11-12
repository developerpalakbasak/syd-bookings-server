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

    // Number of luggage / bags
    luggage: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
      alias: 'bags',
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
      required: true,
      trim: true,
      lowercase: true,
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

    // Link to customer if authenticated
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },

    // Assigned Driver details (visible in Live Tracking)
    driverInfo: {
      driverName: { type: String, default: '' },
      driverPhone: { type: String, default: '' },
      vehicleMakeModel: { type: String, default: '' },
      licensePlate: { type: String, default: '' },
      currentLocation: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
      etaMinutes: { type: Number, default: null },
    },

    // Flight tracking number for airport pickups
    flightNumber: {
      type: String,
      trim: true,
      default: '',
    },

    // Passenger modification request
    modificationRequest: {
      requestedAt: { type: Date, default: null },
      newPickupTime: { type: Date, default: null },
      note: { type: String, default: '' },
      status: {
        type: String,
        enum: ['none', 'pending_approval', 'approved', 'rejected'],
        default: 'none',
      },
    },

    // Fare details (supports number or detailed breakdown)
    fare: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ currency: 'AUD', total: 0 }),
    },

    // Payment status
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'cash_to_driver', 'card'],
      default: 'pending',
    },

    // Payment method (online transaction or cash)
    paymentMethod: {
      type: String,
      enum: ['online', 'cash', 'card'],
      default: 'cash',
      lowercase: true,
      trim: true,
    },

    // Payment transaction details
    paymentDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        paymentIntentId: '',
        checkoutSessionId: '',
        paymentMethod: '',
        paidAmount: 0,
        paidCurrency: 'AUD',
        paidAt: null,
        receiptUrl: '',
      }),
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
