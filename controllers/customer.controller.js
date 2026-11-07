import { customerService } from '../services/customer.service.js';

/**
 * POST /api/customer/register
 * Register a new customer with accessToken & refreshToken cookies + bearer token in body
 */
export const registerCustomer = async (req, res, next) => {
  try {
    const result = await customerService.register(res, req.body);
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/customer/login
 * Customer login with identifier (email/phone) and password
 */
export const loginCustomer = async (req, res, next) => {
  try {
    const result = await customerService.login(res, req.body);
    res.status(200).json({
      success: true,
      message: 'Login successful',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/customer/refresh
 * Explicit endpoint to refresh customer accessToken and rotate refreshToken
 */
export const refreshCustomerToken = async (req, res, next) => {
  try {
    const result = await customerService.refreshToken(req, res);
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/customer/logout
 * Clears authentication cookies
 */
export const logoutCustomer = async (req, res, next) => {
  try {
    const result = await customerService.logout(res);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customer/me
 * Retrieves current customer's profile
 */
export const getCustomerProfile = async (req, res, next) => {
  try {
    const customerId = req.customer?._id || req.customer?.id;
    const customer = await customerService.getProfile(customerId);
    res.status(200).json({
      success: true,
      customer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/customer/profile
 * Updates customer profile and preferences
 */
export const updateCustomerProfile = async (req, res, next) => {
  try {
    const customerId = req.customer?._id || req.customer?.id;
    const customer = await customerService.updateProfile(customerId, req.body);
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      customer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customer/bookings
 * Returns paginated bookings belonging to authenticated customer
 */
export const getCustomerBookings = async (req, res, next) => {
  try {
    const result = await customerService.getCustomerBookings(req.customer, req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customer/bookings/:bookingNumber/track
 * Returns live lifecycle tracking details for a specific booking
 */
export const trackCustomerBooking = async (req, res, next) => {
  try {
    const tracking = await customerService.trackBooking(
      req.params.bookingNumber,
      req.customer
    );
    res.status(200).json({
      success: true,
      tracking,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/customer/bookings/:bookingNumber/cancel
 * Passenger cancels booking
 */
export const cancelCustomerBooking = async (req, res, next) => {
  try {
    const result = await customerService.cancelBooking(
      req.params.bookingNumber,
      req.customer,
      req.body?.reason
    );
    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/customer/bookings/:bookingNumber/modify
 * Passenger requests booking time change / notes
 */
export const modifyCustomerBooking = async (req, res, next) => {
  try {
    const result = await customerService.modifyBooking(
      req.params.bookingNumber,
      req.customer,
      req.body
    );
    res.status(200).json({
      success: true,
      message: 'Modification request submitted to dispatch team',
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customer/bookings/:bookingNumber/invoice
 * Returns structured invoice data for passenger
 */
export const getCustomerInvoice = async (req, res, next) => {
  try {
    const invoice = await customerService.getInvoice(
      req.params.bookingNumber,
      req.customer
    );
    res.status(200).json({
      success: true,
      invoice,
    });
  } catch (error) {
    next(error);
  }
};

