import { Router } from 'express';
import {
  createBooking,
  getAllBookings,
  getBookingByIdOrRef,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
} from '../controllers/booking.controller.js';

const router = Router();

// REST API endpoints for bookings
router.post('/', createBooking);
router.get('/', getAllBookings);
router.get('/:refOrId', getBookingByIdOrRef);
router.patch('/:refOrId/status', updateBookingStatus);
router.post('/:refOrId/cancel', cancelBooking);
router.delete('/:refOrId', deleteBooking);

export default router;
