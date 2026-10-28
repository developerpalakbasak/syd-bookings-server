import { paymentService } from '../services/payment.service.js';

/**
 * GET /api/payments
 * Lists all payments with filtering and pagination
 */
export const getAllPayments = async (req, res, next) => {
  try {
    const { status, bookingNumber, limit, skip } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (bookingNumber) filter.bookingNumber = bookingNumber.toUpperCase();

    const limitNum = limit ? Math.min(Number(limit), 100) : 50;
    const skipNum = skip ? Number(skip) : 0;

    const { Payment } = await import('../models/payment.model.js');
    const [total, payments] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter)
        .populate('bookingId')
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .exec(),
    ]);

    res.status(200).json({
      success: true,
      total,
      limit: limitNum,
      skip: skipNum,
      payments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/config
 * Returns public payment configuration (e.g. Stripe publishable key)
 */
export const getPaymentConfig = async (req, res, next) => {
  try {
    const config = paymentService.getConfig();
    res.status(200).json({
      success: true,
      ...config,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/create-intent
 * Creates a Stripe PaymentIntent for a booking
 */
export const createPaymentIntent = async (req, res, next) => {
  try {
    const { bookingId, bookingNumber, amount, currency } = req.body;
    const refOrId = req.params.refOrId || bookingId || bookingNumber;

    const intentData = await paymentService.createPaymentIntent({
      bookingId: refOrId,
      bookingNumber,
      amount,
      currency,
    });

    res.status(200).json({
      success: true,
      message: 'Payment intent created successfully',
      ...intentData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/confirm
 * Confirms payment status for a booking using Stripe paymentIntentId
 */
export const confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId, bookingId, bookingNumber } = req.body;
    const refOrId = req.params.refOrId || bookingId || bookingNumber;

    const result = await paymentService.confirmPayment({
      paymentIntentId,
      bookingId: refOrId,
      bookingNumber,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/create-checkout-session
 * Generates a hosted Stripe Checkout URL for redirect-based payment flows
 */
export const createCheckoutSession = async (req, res, next) => {
  try {
    const { bookingId, bookingNumber, successUrl, cancelUrl } = req.body;
    const refOrId = req.params.refOrId || bookingId || bookingNumber;

    const sessionData = await paymentService.createCheckoutSession({
      bookingId: refOrId,
      bookingNumber,
      successUrl,
      cancelUrl,
    });

    res.status(200).json({
      success: true,
      message: 'Checkout session created successfully',
      ...sessionData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/booking/:refOrId
 * Retrieves payment status, fare, and transaction history for a booking
 */
export const getPaymentStatus = async (req, res, next) => {
  try {
    const { refOrId } = req.params;
    const paymentStatus = await paymentService.getPaymentStatus(refOrId);

    res.status(200).json({
      success: true,
      data: paymentStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/webhook
 * Handles asynchronous Stripe events (webhooks)
 */
export const handleStripeWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'];
    const payload = req.rawBody || req.body;

    const result = await paymentService.handleWebhook(payload, signature);
    res.status(200).json(result);
  } catch (error) {
    console.error('[Stripe Webhook Error]:', error.message);
    res.status(400).json({ success: false, message: `Webhook Error: ${error.message}` });
  }
};
