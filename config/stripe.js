import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';

if (!stripeSecretKey) {
  console.warn('[Stripe Config] STRIPE_SECRET_KEY is not defined in environment variables.');
}

export const stripe = new Stripe(stripeSecretKey);
export { stripePublishableKey };
