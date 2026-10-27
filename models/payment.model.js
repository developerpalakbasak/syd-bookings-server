import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    bookingNumber: {
      type: String,
      required: true,
      index: true,
      uppercase: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
      index: true,
    },
    stripeCheckoutSessionId: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'AUD',
      uppercase: true,
    },
    status: {
      type: String,
      enum: [
        'requires_payment_method',
        'requires_confirmation',
        'requires_action',
        'processing',
        'succeeded',
        'canceled',
        'failed',
      ],
      default: 'requires_payment_method',
      index: true,
    },
    paymentMethodType: {
      type: String,
      default: 'card',
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    receiptUrl: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
