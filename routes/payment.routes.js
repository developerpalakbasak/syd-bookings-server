import { Router } from 'express';
import {
  getPaymentConfig,
  createPaymentIntent,
  confirmPayment,
  recordCashPayment,
  createCheckoutSession,
  getPaymentStatus,
  handleStripeWebhook,
} from '../controllers/payment.controller.js';

const router = Router();

// Configuration
router.get('/config', getPaymentConfig);

// Stripe Payment Intent (for embedded Stripe Elements)
router.post('/create-intent', createPaymentIntent);

// Stripe Hosted Checkout Session (for redirect flows)
router.post('/create-checkout-session', createCheckoutSession);

// Confirm / verify payment status
router.post('/confirm', confirmPayment);
router.post('/cash', recordCashPayment);

// Payment status and history for a booking
router.get('/booking/:refOrId', getPaymentStatus);

// Stripe asynchronous Webhook listener
router.post('/webhook', handleStripeWebhook);

export default router;
