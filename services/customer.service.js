import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Customer } from '../models/customer.model.js';
import { Booking } from '../models/booking.model.js';
import {
  generateAccessToken,
  generateRefreshToken,
  decodeToken,
  parseDurationToMs,
  getCookieOptions,
} from '../utils/token.util.js';

class CustomerService {
  /**
   * Helper to issue auth cookies and record last login
   */
  async setAuthCookiesAndSave(res, customer) {
    const accessToken = generateAccessToken(customer);
    const refreshToken = generateRefreshToken(customer);

    const accessMs = parseDurationToMs(
      process.env.ACCESS_TOKEN_VALIDITY,
      (parseInt(process.env.ACCESS_COOKIES_VALIDITY, 10) || 30) * 60 * 1000
    );
    const refreshMs = parseDurationToMs(
      process.env.REFRESH_TOKEN_VALIDITY,
      (parseInt(process.env.REFRESH_COOKIES_VALIDITY, 10) || 7) * 24 * 60 * 60 * 1000
    );

    customer.lastLoginAt = new Date();
    await customer.save();

    // Standard cookies & customer-namespaced cookies
    res.cookie('accessToken', accessToken, getCookieOptions(accessMs));
    res.cookie('refreshToken', refreshToken, getCookieOptions(refreshMs));
    res.cookie('customerAccessToken', accessToken, getCookieOptions(accessMs));
    res.cookie('customerRefreshToken', refreshToken, getCookieOptions(refreshMs));

    return {
      token: accessToken,
      accessToken,
      refreshToken,
      customer: {
        id: customer._id,
        _id: customer._id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        role: customer.role || 'passenger',
        avatar: customer.avatar || '',
        preferences: customer.preferences || {},
        isVerified: customer.isVerified !== false,
        isActive: customer.isActive !== false,
        lastLoginAt: customer.lastLoginAt,
        createdAt: customer.createdAt,
      },
    };
  }

  /**
   * Register a new customer
   */
  async register(res, { fullName, email, phone, password, preferences }) {
    if (!fullName || !fullName.trim()) {
      const err = new Error('Full name is required');
      err.statusCode = 400;
      throw err;
    }
    if (!email || !email.trim()) {
      const err = new Error('Email is required');
      err.statusCode = 400;
      throw err;
    }
    if (!phone || !phone.trim()) {
      const err = new Error('Phone number is required');
      err.statusCode = 400;
      throw err;
    }
    if (!password || password.length < 6) {
      const err = new Error('Password is required and must be at least 6 characters long');
      err.statusCode = 400;
      throw err;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    // Check duplicate email
    const existingEmail = await Customer.findOne({ email: cleanEmail });
    if (existingEmail) {
      const err = new Error('An account with this email already exists');
      err.statusCode = 409;
      throw err;
    }

    // Check duplicate phone
    const existingPhone = await Customer.findOne({ phone: cleanPhone });
    if (existingPhone) {
      const err = new Error('An account with this phone number already exists');
      err.statusCode = 409;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const customer = await Customer.create({
      fullName: fullName.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password: hashedPassword,
      preferences: preferences || undefined,
    });

    // Link previous guest bookings with this customer
    try {
      await Booking.updateMany(
        {
          customerId: null,
          $or: [{ passengerEmail: cleanEmail }, { passengerPhone: cleanPhone }],
        },
        { $set: { customerId: customer._id } }
      );
    } catch {
      // Non-fatal if linking fails
    }

    return await this.setAuthCookiesAndSave(res, customer);
  }

  /**
   * Customer Login (Supports Email, Phone, or Identifier)
   */
  async login(res, { email, phone, identifier, password }) {
    const rawIdentifier = identifier || email || phone;
    if (!rawIdentifier || !password) {
      const err = new Error('Email or phone number and password are required');
      err.statusCode = 400;
      throw err;
    }

    const cleanIdentifier = rawIdentifier.trim();
    const isEmail = cleanIdentifier.includes('@');
    const query = isEmail
      ? { email: cleanIdentifier.toLowerCase() }
      : { phone: cleanIdentifier };

    const customer = await Customer.findOne(query).select('+password');

    if (!customer) {
      const err = new Error('Invalid email/phone or password');
      err.statusCode = 401;
      throw err;
    }

    if (!customer.isActive) {
      const err = new Error('Your account has been deactivated. Please contact support.');
      err.statusCode = 403;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      const err = new Error('Invalid email/phone or password');
      err.statusCode = 401;
      throw err;
    }

    return await this.setAuthCookiesAndSave(res, customer);
  }

  /**
   * Refresh token endpoint with Refresh Token Rotation
   */
  async refreshToken(req, res, token) {
    const refreshToken =
      token ||
      req.cookies?.customerRefreshToken ||
      req.cookies?.refreshToken ||
      req.body?.refreshToken;

    if (!refreshToken) {
      const err = new Error('Refresh token is required');
      err.statusCode = 401;
      throw err;
    }

    let refreshDecoded;
    try {
      refreshDecoded = decodeToken(refreshToken);
    } catch (tokenErr) {
      this.clearCookies(res);
      const err = new Error('Refresh token is invalid or expired. Please log in again.');
      err.statusCode = 401;
      throw err;
    }

    const customerId =
      refreshDecoded?.customerId ||
      refreshDecoded?.userId ||
      refreshDecoded?._id ||
      refreshDecoded?.id;

    if (!customerId) {
      this.clearCookies(res);
      const err = new Error('Invalid refresh token payload. Please log in again.');
      err.statusCode = 401;
      throw err;
    }

    const customer = await Customer.findById(customerId).select('+isActive').exec();

    if (!customer || !customer.isActive) {
      this.clearCookies(res);
      const err = new Error('Customer account is inactive or not found');
      err.statusCode = 401;
      throw err;
    }

    const newAccessToken = generateAccessToken(customer);
    const newRefreshToken = generateRefreshToken(customer);

    const accessMs = parseDurationToMs(
      process.env.ACCESS_TOKEN_VALIDITY,
      (parseInt(process.env.ACCESS_COOKIES_VALIDITY, 10) || 30) * 60 * 1000
    );
    const refreshMs = parseDurationToMs(
      process.env.REFRESH_TOKEN_VALIDITY,
      (parseInt(process.env.REFRESH_COOKIES_VALIDITY, 10) || 7) * 24 * 60 * 60 * 1000
    );

    res.cookie('accessToken', newAccessToken, getCookieOptions(accessMs));
    res.cookie('refreshToken', newRefreshToken, getCookieOptions(refreshMs));
    res.cookie('customerAccessToken', newAccessToken, getCookieOptions(accessMs));
    res.cookie('customerRefreshToken', newRefreshToken, getCookieOptions(refreshMs));

    return {
      token: newAccessToken,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      customer: {
        id: customer._id,
        _id: customer._id,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        role: customer.role || 'passenger',
        avatar: customer.avatar || '',
        preferences: customer.preferences || {},
        isVerified: customer.isVerified !== false,
        isActive: customer.isActive !== false,
        lastLoginAt: customer.lastLoginAt,
      },
    };
  }

  /**
   * Helper to clear all auth cookies
   */
  clearCookies(res) {
    res.clearCookie('accessToken', getCookieOptions(0));
    res.clearCookie('refreshToken', getCookieOptions(0));
    res.clearCookie('customerAccessToken', getCookieOptions(0));
    res.clearCookie('customerRefreshToken', getCookieOptions(0));
  }

  /**
   * Customer Logout
   */
  async logout(res) {
    this.clearCookies(res);
    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Retrieve Customer Profile
   */
  async getProfile(customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      const err = new Error('Customer not found');
      err.statusCode = 404;
      throw err;
    }
    return {
      id: customer._id,
      _id: customer._id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      role: customer.role,
      avatar: customer.avatar,
      preferences: customer.preferences,
      isVerified: customer.isVerified,
      isActive: customer.isActive,
      lastLoginAt: customer.lastLoginAt,
      createdAt: customer.createdAt,
    };
  }

  /**
   * Update Customer Profile & Preferences
   */
  async updateProfile(customerId, updateData) {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      const err = new Error('Customer not found');
      err.statusCode = 404;
      throw err;
    }

    const { fullName, phone, avatar, preferences } = updateData;

    if (fullName && fullName.trim()) {
      customer.fullName = fullName.trim();
    }

    if (phone && phone.trim() && phone.trim() !== customer.phone) {
      const existingPhone = await Customer.findOne({
        phone: phone.trim(),
        _id: { $ne: customerId },
      });
      if (existingPhone) {
        const err = new Error('Phone number is already in use by another account');
        err.statusCode = 409;
        throw err;
      }
      customer.phone = phone.trim();
    }

    if (avatar !== undefined) {
      customer.avatar = avatar;
    }

    if (preferences && typeof preferences === 'object') {
      customer.preferences = {
        ...customer.preferences.toObject(),
        ...preferences,
      };
    }

    await customer.save();

    return {
      id: customer._id,
      _id: customer._id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      role: customer.role,
      avatar: customer.avatar,
      preferences: customer.preferences,
      isVerified: customer.isVerified,
      isActive: customer.isActive,
      lastLoginAt: customer.lastLoginAt,
      updatedAt: customer.updatedAt,
    };
  }

  /**
   * Get Customer Bookings (Paginated & Filtered)
   */
  async getCustomerBookings(customer, query = {}) {
    const { status = 'all', page = 1, limit = 10 } = query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Filter by customer ownership
    const baseFilter = {
      $or: [
        { customerId: customer._id || customer.id },
        { passengerEmail: customer.email },
        { passengerPhone: customer.phone },
      ],
    };

    const now = new Date();
    if (status === 'upcoming') {
      baseFilter.pickupTime = { $gte: now };
      baseFilter.status = { $nin: ['cancelled', 'completed'] };
    } else if (status === 'past') {
      baseFilter.$or = [
        { pickupTime: { $lt: now } },
        { status: 'completed' },
      ];
    } else if (status === 'cancelled') {
      baseFilter.status = 'cancelled';
    }

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(baseFilter),
      Booking.find(baseFilter)
        .sort({ pickupTime: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    const formattedBookings = bookings.map((b) => ({
      id: b._id,
      _id: b._id,
      bookingNumber: b.bookingNumber,
      vehicleType: b.vehicleType,
      pickup: b.pickup,
      dropoff: b.dropoff,
      pickupTime: b.pickupTime,
      passengers: b.passengers,
      luggage: b.luggage,
      flightNumber: b.flightNumber || '',
      fare: b.fare,
      status: b.status,
      paymentStatus: b.paymentStatus,
      driverInfo: b.driverInfo || {
        driverName: '',
        driverPhone: '',
        vehicleMakeModel: '',
        licensePlate: '',
      },
      modificationRequest: b.modificationRequest,
      cancellationReason: b.cancellationReason || '',
      createdAt: b.createdAt,
    }));

    return {
      total,
      page: pageNum,
      limit: limitNum,
      bookings: formattedBookings,
    };
  }

  /**
   * Live Tracking Details for Customer Booking
   */
  async trackBooking(bookingNumber, customer) {
    const booking = await Booking.findOne({
      bookingNumber: bookingNumber.trim().toUpperCase(),
      $or: [
        { customerId: customer._id || customer.id },
        { passengerEmail: customer.email },
        { passengerPhone: customer.phone },
      ],
    }).lean();

    if (!booking) {
      const err = new Error('Booking not found or not authorized');
      err.statusCode = 404;
      throw err;
    }

    return {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      driver: booking.driverInfo || {
        driverName: '',
        driverPhone: '',
        vehicleMakeModel: '',
        licensePlate: '',
        etaMinutes: null,
      },
      trip: {
        pickup: booking.pickup,
        dropoff: booking.dropoff,
        pickupTime: booking.pickupTime,
        flightNumber: booking.flightNumber || '',
      },
      modificationRequest: booking.modificationRequest,
    };
  }

  /**
   * Customer Booking Cancellation
   */
  async cancelBooking(bookingNumber, customer, reason) {
    const booking = await Booking.findOne({
      bookingNumber: bookingNumber.trim().toUpperCase(),
      $or: [
        { customerId: customer._id || customer.id },
        { passengerEmail: customer.email },
        { passengerPhone: customer.phone },
      ],
    });

    if (!booking) {
      const err = new Error('Booking not found or not authorized');
      err.statusCode = 404;
      throw err;
    }

    if (booking.status === 'completed') {
      const err = new Error('Completed bookings cannot be cancelled');
      err.statusCode = 400;
      throw err;
    }

    if (booking.status === 'cancelled') {
      const err = new Error('Booking is already cancelled');
      err.statusCode = 400;
      throw err;
    }

    booking.status = 'cancelled';
    booking.cancellationReason = reason || 'Cancelled by passenger';
    await booking.save();

    return {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      refundStatus: booking.paymentStatus === 'paid' ? 'eligible_for_refund' : 'no_payment_made',
    };
  }

  /**
   * Customer Modification Request
   */
  async modifyBooking(bookingNumber, customer, { newPickupTime, note }) {
    const booking = await Booking.findOne({
      bookingNumber: bookingNumber.trim().toUpperCase(),
      $or: [
        { customerId: customer._id || customer.id },
        { passengerEmail: customer.email },
        { passengerPhone: customer.phone },
      ],
    });

    if (!booking) {
      const err = new Error('Booking not found or not authorized');
      err.statusCode = 404;
      throw err;
    }

    if (['completed', 'cancelled'].includes(booking.status)) {
      const err = new Error(`Cannot modify a ${booking.status} booking`);
      err.statusCode = 400;
      throw err;
    }

    booking.modificationRequest = {
      requestedAt: new Date(),
      newPickupTime: newPickupTime ? new Date(newPickupTime) : null,
      note: note || '',
      status: 'pending_approval',
    };

    await booking.save();

    return {
      bookingNumber: booking.bookingNumber,
      modificationStatus: 'pending_approval',
      modificationRequest: booking.modificationRequest,
    };
  }

  /**
   * Invoice generation data
   */
  async getInvoice(bookingNumber, customer) {
    const booking = await Booking.findOne({
      bookingNumber: bookingNumber.trim().toUpperCase(),
      $or: [
        { customerId: customer._id || customer.id },
        { passengerEmail: customer.email },
        { passengerPhone: customer.phone },
      ],
    }).lean();

    if (!booking) {
      const err = new Error('Booking not found or not authorized');
      err.statusCode = 404;
      throw err;
    }

    const totalAmount =
      typeof booking.fare === 'number'
        ? booking.fare
        : booking.fare?.total || booking.fare?.amount || 0;
    const currency = booking.fare?.currency || 'AUD';

    // GST calculation: 10% included in Australia
    const gst = Math.round((totalAmount / 11) * 100) / 100;
    const baseFare = Math.round((totalAmount - gst) * 100) / 100;

    return {
      invoiceNumber: `INV-${new Date(booking.createdAt).getFullYear()}-${booking.bookingNumber}`,
      date: new Date(booking.createdAt).toISOString().split('T')[0],
      bookingNumber: booking.bookingNumber,
      passenger: {
        fullName: booking.passengerName,
        email: booking.passengerEmail,
        phone: booking.passengerPhone,
      },
      service: {
        category: `${booking.vehicleType} Service`,
        pickup: typeof booking.pickup === 'object' ? booking.pickup?.address || JSON.stringify(booking.pickup) : booking.pickup,
        dropoff: typeof booking.dropoff === 'object' ? booking.dropoff?.address || JSON.stringify(booking.dropoff) : booking.dropoff,
        date: new Date(booking.pickupTime).toLocaleDateString('en-AU'),
        time: new Date(booking.pickupTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      },
      breakdown: {
        baseFare,
        gst,
        total: totalAmount,
        currency,
      },
      payment: {
        method: booking.paymentDetails?.paymentMethod || 'Card',
        status: booking.paymentStatus.toUpperCase(),
        transactionId: booking.paymentDetails?.paymentIntentId || '',
        paidAt: booking.paymentDetails?.paidAt || null,
      },
    };
  }
}

export const customerService = new CustomerService();

