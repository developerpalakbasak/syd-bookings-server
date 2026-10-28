import { Router } from 'express';
import {
  loginAdmin,
  logoutAdmin,
  getMyProfile,
  createAdminUser,
  getAllAdmins,
  getAdminById,
  updateAdminUser,
  setAdminPassword,
  deleteAdminUser,
} from '../controllers/admin.controller.js';
import {
  getAllBookings,
  getBookingByIdOrRef,
  updateBooking,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
} from '../controllers/booking.controller.js';
import {
  getAllPayments,
  getPaymentStatus,
} from '../controllers/payment.controller.js';
import {
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
} from '../controllers/route.controller.js';
import {
  authenticateAdmin,
  requireSuperAdmin,
} from '../middlewares/auth.middleware.js';

const router = Router();

/* ==========================================================================
   AUTH ROUTES (Public login / Protected logout & me)
   ========================================================================== */
// POST /api/admin/login - Login for admin / superadmin (sets accessToken & refreshToken in cookies)
router.post('/login', loginAdmin);

// POST /api/admin/logout - Invalidate refreshToken & clear cookies
router.post('/logout', authenticateAdmin, logoutAdmin);

// GET /api/admin/me - Current logged-in admin's profile
router.get('/me', authenticateAdmin, getMyProfile);


/* ==========================================================================
   SUPERADMIN: ADMIN MANAGEMENT (CRUD + Set Password)
   - Only accessible by users with role 'superadmin'
   ========================================================================== */
// List all admins
router.get('/admins', authenticateAdmin, requireSuperAdmin, getAllAdmins);

// Create new admin / superadmin
router.post('/admins', authenticateAdmin, requireSuperAdmin, createAdminUser);

// Get admin details by ID
router.get('/admins/:id', authenticateAdmin, requireSuperAdmin, getAdminById);

// Update admin details/role/status
router.put('/admins/:id', authenticateAdmin, requireSuperAdmin, updateAdminUser);
router.patch('/admins/:id', authenticateAdmin, requireSuperAdmin, updateAdminUser);

// Set/change password for an admin
router.post('/admins/:id/set-password', authenticateAdmin, requireSuperAdmin, setAdminPassword);
router.patch('/admins/:id/set-password', authenticateAdmin, requireSuperAdmin, setAdminPassword);

// Delete an admin
router.delete('/admins/:id', authenticateAdmin, requireSuperAdmin, deleteAdminUser);


/* ==========================================================================
   BOOKINGS MANAGEMENT
   - See and edit bookings (Admin or Superadmin)
   ========================================================================== */
router.get('/bookings', authenticateAdmin, getAllBookings);
router.get('/bookings/:refOrId', authenticateAdmin, getBookingByIdOrRef);
router.put('/bookings/:refOrId', authenticateAdmin, updateBooking);
router.patch('/bookings/:refOrId', authenticateAdmin, updateBooking);
router.patch('/bookings/:refOrId/status', authenticateAdmin, updateBookingStatus);
router.post('/bookings/:refOrId/cancel', authenticateAdmin, cancelBooking);
router.delete('/bookings/:refOrId', authenticateAdmin, deleteBooking);


/* ==========================================================================
   PAYMENTS MANAGEMENT
   - See payments and payment details (Admin or Superadmin)
   ========================================================================== */
router.get('/payments', authenticateAdmin, getAllPayments);
router.get('/payments/booking/:refOrId', authenticateAdmin, getPaymentStatus);


/* ==========================================================================
   ROUTES CRUD
   - Create, Read, Update, Delete routes (Admin or Superadmin)
   ========================================================================== */
router.get('/routes', authenticateAdmin, getAllRoutes);
router.post('/routes', authenticateAdmin, createRoute);
router.get('/routes/:id', authenticateAdmin, getRouteById);
router.put('/routes/:id', authenticateAdmin, updateRoute);
router.patch('/routes/:id', authenticateAdmin, updateRoute);
router.delete('/routes/:id', authenticateAdmin, deleteRoute);

export default router;
