import { stripe, stripePublishableKey } from '../config/stripe.js';
import { Booking } from '../models/booking.model.js';
import { Payment } from '../models/payment.model.js';
import { bookingService } from './booking.service.js';

class PaymentService {
  /**
   * Helper to extract total numeric fare from booking.fare
   */
  extractFareAmount(fare) {
    if (typeof fare === 'number') return fare;
    if (fare && typeof fare === 'object') {
      if (typeof fare.total === 'number') return fare.total;
      if (typeof fare.amount === 'number') return fare.amount;
      if (fare.total && !isNaN(Number(fare.total))) return Number(fare.total);
      if (fare.amount && !isNaN(Number(fare.amount))) return Number(fare.amount);
    }
    return 0;
  }

  /**
   * Helper to extract string summary of location
   */
  formatLocation(location) {
    if (!location) return '';
    if (typeof location === 'string') return location;
    return location.address || location.name || JSON.stringify(location);
  }

  /**
   * Returns Stripe public configuration for frontend
   */
  getConfig() {
    return {
      publishableKey: stripePublishableKey,
    };
  }

  /**
   * Creates a Stripe PaymentIntent for a specific booking
   */
  async createPaymentIntent({ bookingId, bookingNumber, amount: customAmount, currency: customCurrency }) {
    const refOrId = bookingId || bookingNumber;
    if (!refOrId) {
      const err = new Error('Booking ID or bookingNumber is required');
      err.statusCode = 400;
      throw err;
    }

    const booking = await bookingService.findByReferenceOrId(refOrId);

    if (booking.paymentStatus === 'paid') {
      const err = new Error(`Booking ${booking.bookingNumber} is already marked as paid`);
      err.statusCode = 400;
      throw err;
    }

    // Resolve fare amount
    const rawAmount = customAmount !== undefined ? Number(customAmount) : this.extractFareAmount(booking.fare);
    if (!rawAmount || isNaN(rawAmount) || rawAmount <= 0) {
      const err = new Error('A valid fare total greater than 0 is required for payment');
      err.statusCode = 400;
      throw err;
    }

    // Resolve currency
    const currency = (customCurrency || booking.fare?.currency || 'AUD').toLowerCase();

    // Amount in cents for Stripe (e.g. $85.00 AUD -> 8500 cents)
    const amountInCents = Math.round(rawAmount * 100);

    const pickupText = this.formatLocation(booking.pickup);
    const dropoffText = this.formatLocation(booking.dropoff);

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      receipt_email: booking.passengerEmail || undefined,
      description: `SYD Transport - Booking ${booking.bookingNumber} (${booking.vehicleType})`,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        bookingId: booking._id.toString(),
        bookingNumber: booking.bookingNumber,
        vehicleType: booking.vehicleType || '',
        passengerName: booking.passengerName || '',
        passengerPhone: booking.passengerPhone || '',
        pickup: pickupText.substring(0, 500),
        dropoff: dropoffText.substring(0, 500),
      },
    });

    // Update booking paymentDetails
    booking.paymentDetails = {
      ...booking.paymentDetails,
      paymentIntentId: paymentIntent.id,
      paidAmount: rawAmount,
      paidCurrency: currency.toUpperCase(),
    };
    await booking.save();

    // Create or update Payment ledger entry
    await Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        stripePaymentIntentId: paymentIntent.id,
        amount: rawAmount,
        currency: currency.toUpperCase(),
        status: paymentIntent.status,
        customerEmail: booking.passengerEmail || '',
        metadata: paymentIntent.metadata,
      },
      { upsert: true, new: true }
    );

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      publishableKey: stripePublishableKey,
      amount: rawAmount,
      currency: currency.toUpperCase(),
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        vehicleType: booking.vehicleType,
        passengerName: booking.passengerName,
        passengerEmail: booking.passengerEmail,
        fare: booking.fare,
        paymentStatus: booking.paymentStatus,
      },
    };
  }

  /**
   * Confirms payment for a booking using Stripe paymentIntentId
   */
  async confirmPayment({ paymentIntentId, bookingId, bookingNumber }) {
    if (!paymentIntentId) {
      const err = new Error('paymentIntentId is required');
      err.statusCode = 400;
      throw err;
    }

    // Retrieve live payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Find the associated booking
    const targetRefOrId =
      bookingId || bookingNumber || paymentIntent.metadata?.bookingId || paymentIntent.metadata?.bookingNumber;

    let booking = null;
    if (targetRefOrId) {
      booking = await bookingService.findByReferenceOrId(targetRefOrId);
    } else {
      booking = await Booking.findOne({ 'paymentDetails.paymentIntentId': paymentIntentId });
    }

    if (!booking) {
      const err = new Error(`Associated booking not found for PaymentIntent '${paymentIntentId}'`);
      err.statusCode = 404;
      throw err;
    }

    const isSuccessful = paymentIntent.status === 'succeeded';
    const receiptUrl =
      paymentIntent.latest_charge && typeof paymentIntent.latest_charge === 'object'
        ? paymentIntent.latest_charge.receipt_url
        : '';

    // Update booking if succeeded
    if (isSuccessful) {
      booking.paymentStatus = 'paid';
      if (booking.status === 'pending') {
        booking.status = 'confirmed';
      }
      booking.paymentDetails = {
        ...booking.paymentDetails,
        paymentIntentId: paymentIntent.id,
        paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
        paidAmount: paymentIntent.amount_received / 100,
        paidCurrency: paymentIntent.currency.toUpperCase(),
        paidAt: new Date(),
        receiptUrl: receiptUrl || booking.paymentDetails?.receiptUrl || '',
      };
      await booking.save();
    } else if (paymentIntent.status === 'canceled') {
      booking.paymentStatus = 'failed';
      await booking.save();
    }

    // Update Payment ledger
    const paymentRecord = await Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      {
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        stripePaymentIntentId: paymentIntent.id,
        amount: (paymentIntent.amount_received || paymentIntent.amount) / 100,
        currency: paymentIntent.currency.toUpperCase(),
        status: paymentIntent.status,
        paymentMethodType: paymentIntent.payment_method_types?.[0] || 'card',
        customerEmail: booking.passengerEmail || '',
        receiptUrl: receiptUrl || '',
        metadata: paymentIntent.metadata,
      },
      { upsert: true, new: true }
    );

    return {
      success: isSuccessful,
      status: paymentIntent.status,
      message: isSuccessful ? 'Payment confirmed successfully' : `Payment status is ${paymentIntent.status}`,
      booking,
      payment: paymentRecord,
    };
  }

  /**
   * Creates a hosted Stripe Checkout Session for a booking
   */
  async createCheckoutSession({ bookingId, bookingNumber, successUrl, cancelUrl }) {
    const refOrId = bookingId || bookingNumber;
    if (!refOrId) {
      const err = new Error('Booking ID or bookingNumber is required');
      err.statusCode = 400;
      throw err;
    }

    const booking = await bookingService.findByReferenceOrId(refOrId);

    if (booking.paymentStatus === 'paid') {
      const err = new Error(`Booking ${booking.bookingNumber} is already marked as paid`);
      err.statusCode = 400;
      throw err;
    }

    const rawAmount = this.extractFareAmount(booking.fare);
    if (!rawAmount || isNaN(rawAmount) || rawAmount <= 0) {
      const err = new Error('A valid fare total greater than 0 is required for payment');
      err.statusCode = 400;
      throw err;
    }

    const currency = (booking.fare?.currency || 'AUD').toLowerCase();
    const amountInCents = Math.round(rawAmount * 100);

    const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
    const pickupText = this.formatLocation(booking.pickup);

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `SYD Transport - ${booking.vehicleType} Service`,
              description: `Booking #${booking.bookingNumber} • Pickup: ${pickupText.substring(0, 100)}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: booking.passengerEmail || undefined,
      success_url:
        successUrl || `${clientOrigin}/payment-success?session_id={CHECKOUT_SESSION_ID}&bookingNumber=${booking.bookingNumber}`,
      cancel_url:
        cancelUrl || `${clientOrigin}/payment-cancel?bookingNumber=${booking.bookingNumber}`,
      metadata: {
        bookingId: booking._id.toString(),
        bookingNumber: booking.bookingNumber,
        vehicleType: booking.vehicleType || '',
      },
    });

    booking.paymentDetails = {
      ...booking.paymentDetails,
      checkoutSessionId: session.id,
      paidAmount: rawAmount,
      paidCurrency: currency.toUpperCase(),
    };
    await booking.save();

    return {
      sessionId: session.id,
      sessionUrl: session.url,
      bookingNumber: booking.bookingNumber,
    };
  }

  /**
   * Retrieves payment status and history for a booking
   */
  async getPaymentStatus(refOrId) {
    const booking = await bookingService.findByReferenceOrId(refOrId);

    // If there is an existing paymentIntentId and status is pending, check latest from Stripe
    let liveStripeStatus = null;
    if (booking.paymentDetails?.paymentIntentId && booking.paymentStatus !== 'paid') {
      try {
        const intent = await stripe.paymentIntents.retrieve(booking.paymentDetails.paymentIntentId);
        liveStripeStatus = intent.status;
        if (intent.status === 'succeeded') {
          booking.paymentStatus = 'paid';
          if (booking.status === 'pending') {
            booking.status = 'confirmed';
          }
          await booking.save();
        }
      } catch {
        // Fallback silently if stripe check fails
      }
    }

    const payments = await Payment.find({ bookingId: booking._id }).sort({ createdAt: -1 });

    return {
      bookingNumber: booking.bookingNumber,
      bookingId: booking._id,
      vehicleType: booking.vehicleType,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      fare: booking.fare,
      paymentDetails: booking.paymentDetails,
      liveStripeStatus,
      payments,
    };
  }

  /**
   * Handles asynchronous webhooks from Stripe
   */
  async handleWebhook(rawBody, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else {
      event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    }

    const { type, data } = event;

    if (type === 'payment_intent.succeeded') {
      const paymentIntent = data.object;
      const bookingId = paymentIntent.metadata?.bookingId;
      const bookingNumber = paymentIntent.metadata?.bookingNumber;

      if (bookingId || bookingNumber) {
        await this.confirmPayment({
          paymentIntentId: paymentIntent.id,
          bookingId,
          bookingNumber,
        });
      }
    } else if (type === 'payment_intent.payment_failed') {
      const paymentIntent = data.object;
      const bookingId = paymentIntent.metadata?.bookingId;
      if (bookingId) {
        await Booking.findByIdAndUpdate(bookingId, {
          paymentStatus: 'failed',
        });
      }
    } else if (type === 'checkout.session.completed') {
      const session = data.object;
      const bookingId = session.metadata?.bookingId;
      const bookingNumber = session.metadata?.bookingNumber;

      if (bookingId || bookingNumber) {
        const booking = await bookingService.findByReferenceOrId(bookingId || bookingNumber);
        booking.paymentStatus = 'paid';
        if (booking.status === 'pending') {
          booking.status = 'confirmed';
        }
        booking.paymentDetails = {
          ...booking.paymentDetails,
          checkoutSessionId: session.id,
          paidAmount: (session.amount_total || 0) / 100,
          paidCurrency: (session.currency || 'AUD').toUpperCase(),
          paidAt: new Date(),
        };
        await booking.save();
      }
    }

    return { received: true, eventType: type };
  }
}

export const paymentService = new PaymentService();
