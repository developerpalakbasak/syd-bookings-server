import { Router } from 'express';
import {
  createBooking,
  getAllBookings,
  getBookingByIdOrRef,
  updateBooking,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
} from '../controllers/booking.controller.js';

import {
  createPaymentIntent,
  confirmPayment,
  recordCashPayment,
  getPaymentStatus,
} from '../controllers/payment.controller.js';

const router = Router();

// REST API endpoints for bookings
router.post('/', createBooking);
router.get('/:refOrId', getBookingByIdOrRef);
router.patch('/:refOrId/status', updateBookingStatus);
router.patch('/:refOrId', updateBooking);
router.post('/:refOrId/cancel', cancelBooking);
router.delete('/:refOrId', deleteBooking);

// Nested payment endpoints for convenience
router.post('/:refOrId/create-payment-intent', createPaymentIntent);
router.post('/:refOrId/pay', createPaymentIntent);
router.post('/:refOrId/confirm-payment', confirmPayment);
router.post('/:refOrId/cash', recordCashPayment);
router.get('/:refOrId/payment-status', getPaymentStatus);

export default router;
