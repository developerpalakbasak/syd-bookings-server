import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Prevents password from being returned in queries by default
      minlength: [6, 'Password must be at least 6 characters long'],
    },
    role: {
      type: String,
      default: 'passenger',
      enum: ['passenger'],
    },
    avatar: {
      type: String,
      default: '',
    },
    preferences: {
      defaultLuggage: {
        type: Number,
        default: 2,
      },
      defaultPassengers: {
        type: Number,
        default: 1,
      },
      preferredVehicleType: {
        type: String,
        enum: ['Chauffeur', 'Taxi', 'All'],
        default: 'Chauffeur',
      },
      favoritePlaces: [
        {
          label: { type: String, default: 'Home' },
          address: { type: String, required: true },
        },
      ],
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for alias 'name' to 'fullName'
customerSchema.virtual('name')
  .get(function () {
    return this.fullName;
  })
  .set(function (v) {
    this.fullName = v;
  });

export const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

