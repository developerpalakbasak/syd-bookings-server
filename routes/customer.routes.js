import { Router } from 'express';
import {
  registerCustomer,
  loginCustomer,
  refreshCustomerToken,
  logoutCustomer,
  getCustomerProfile,
  updateCustomerProfile,
  getCustomerBookings,
  trackCustomerBooking,
  cancelCustomerBooking,
  modifyCustomerBooking,
  getCustomerInvoice,
} from '../controllers/customer.controller.js';
import { authenticateCustomer } from '../middlewares/auth.middleware.js';

const router = Router();

/* ==========================================================================
   AUTHENTICATION ROUTES (Customer / Passenger)
   ========================================================================== */
// POST /api/customer/register - Register new customer account
router.post('/register', registerCustomer);

// POST /api/customer/login - Customer login via email or phone
router.post('/login', loginCustomer);

// POST /api/customer/refresh - Refresh tokens with rotation
router.post('/refresh', refreshCustomerToken);

// POST /api/customer/logout - Clear auth cookies & logout
router.post('/logout', authenticateCustomer, logoutCustomer);

// GET /api/customer/me - Get current customer profile
router.get('/me', authenticateCustomer, getCustomerProfile);

// PUT /api/customer/profile - Update profile & default preferences
router.put('/profile', authenticateCustomer, updateCustomerProfile);


/* ==========================================================================
   BOOKINGS & TRIPS ROUTES (Passenger Panel)
   ========================================================================== */
// GET /api/customer/bookings - List customer's bookings (upcoming, past, cancelled)
router.get('/bookings', authenticateCustomer, getCustomerBookings);

// GET /api/customer/bookings/:bookingNumber/track - Real-time tracking data
router.get('/bookings/:bookingNumber/track', authenticateCustomer, trackCustomerBooking);

// POST /api/customer/bookings/:bookingNumber/cancel - Cancel booking
router.post('/bookings/:bookingNumber/cancel', authenticateCustomer, cancelCustomerBooking);

// POST /api/customer/bookings/:bookingNumber/modify - Request modification
router.post('/bookings/:bookingNumber/modify', authenticateCustomer, modifyCustomerBooking);

// GET /api/customer/bookings/:bookingNumber/invoice - Structured invoice data
router.get('/bookings/:bookingNumber/invoice', authenticateCustomer, getCustomerInvoice);

export default router;

