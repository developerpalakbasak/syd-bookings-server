import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Booking } from '../models/booking.model.js';

class BookingService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'quotes_secret_fallback_key';
  }

  // Verifies quoteToken if provided
  verifyQuoteToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch {
      return null;
    }
  }

  // Generates a random uppercase 6-character alphanumeric reference code formatted as SYD-XXXXXX.
  generateBookingNumber() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `SYD-${code}`;
  }

  // Validates request data, generates reference code, and creates internal booking.
  async create(dto) {
    // 0. If quoteToken is provided, extract verified details
    const quotePayload = dto.quoteToken ? this.verifyQuoteToken(dto.quoteToken) : null;

    // 1. Resolve Pickup and Dropoff
    const pickup = dto.pickup ?? dto.from ?? quotePayload?.pickup;
    if (!pickup) {
      const err = new Error('Pickup location is required');
      err.statusCode = 400;
      throw err;
    }

    if (!dto.passengerName || !dto.passengerName.trim()) {
      const err = new Error('Passenger name is required');
      err.statusCode = 400;
      throw err;
    }

    const passengerPhone = (dto.passengerPhone || dto.passengerPhon || '').trim();
    if (!passengerPhone) {
      const err = new Error('Passenger phone is required');
      err.statusCode = 400;
      throw err;
    }

    const passengerEmail = (dto.passengerEmail || '').trim().toLowerCase();
    if (!passengerEmail) {
      const err = new Error('Passenger email is required');
      err.statusCode = 400;
      throw err;
    }

    const dropoff = dto.dropoff ?? dto.destination ?? dto.to ?? quotePayload?.destination ?? '';

    // 2. Resolve Timing & Passengers
    let pickupTime = dto.pickupTime ?? dto.pickupAt ?? dto.when ?? quotePayload?.pickupAt;
    if (!pickupTime || dto.isNow) {
      pickupTime = new Date();
    } else {
      pickupTime = new Date(pickupTime);
    }

    const passengers = Number(dto.passengers ?? dto.pax ?? quotePayload?.passengers ?? 1);
    const luggage = Number(dto.luggage ?? dto.bags ?? quotePayload?.luggage ?? 0);
    const vehicleType = (dto.vehicleType ?? quotePayload?.vehicleType ?? 'Standard').trim();

    // 3. Generate unique Booking Reference
    let bookingNumber = this.generateBookingNumber();
    let exists = await Booking.exists({ bookingNumber });
    while (exists) {
      bookingNumber = this.generateBookingNumber();
      exists = await Booking.exists({ bookingNumber });
    }

    // 4. Construct and Save Internal Booking
    const newBooking = new Booking({
      bookingNumber,
      pickup,
      dropoff,
      pickupTime,
      passengers,
      luggage,
      vehicleType,
      passengerName: dto.passengerName.trim(),
      passengerPhone,
      passengerEmail: (dto.passengerEmail || '').trim(),
      status: dto.status || 'pending',
      fare: dto.fare ?? quotePayload?.price ?? { currency: 'AUD', total: 0 },
      paymentStatus: dto.paymentStatus || 'pending',
      notes: dto.notes ? String(dto.notes).trim() : '',
      cancellationReason: dto.cancellationReason ? String(dto.cancellationReason).trim() : '',
    });

    return await newBooking.save();
  }

  // Retrieves paginated list of bookings with optional filtering by phone, status, or vehicleType.
  async findAll(query = {}) {
    const filter = {};

    if (query.status) filter.status = query.status;
    if (query.vehicleType) filter.vehicleType = query.vehicleType;
    if (query.phone) {
      const phoneRegex = new RegExp(query.phone, 'i');
      filter.passengerPhone = phoneRegex;
    }
    if (query.bookingNumber) {
      filter.bookingNumber = query.bookingNumber.toUpperCase();
    }

    const limit = query.limit ? Math.min(Number(query.limit), 100) : 50;
    const skip = query.skip ? Number(query.skip) : 0;

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
    ]);

    return { total, bookings };
  }

  // Finds booking by MongoDB ObjectId or reference number.
  async findByReferenceOrId(refOrId) {
    if (!refOrId) {
      const err = new Error('Booking reference or ID is required');
      err.statusCode = 400;
      throw err;
    }

    let booking = null;
    if (mongoose.isValidObjectId(refOrId)) {
      booking = await Booking.findById(refOrId).exec();
    }

    if (!booking) {
      booking = await Booking.findOne({ bookingNumber: refOrId.toUpperCase() }).exec();
    }

    if (!booking) {
      const err = new Error(`Booking with reference '${refOrId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    return booking;
  }

  // Updates booking details (full or partial edit)
  async update(refOrId, dto) {
    const booking = await this.findByReferenceOrId(refOrId);

    const editableFields = [
      'pickup',
      'dropoff',
      'pickupTime',
      'passengers',
      'luggage',
      'vehicleType',
      'passengerName',
      'passengerPhone',
      'passengerEmail',
      'status',
      'fare',
      'paymentStatus',
      'paymentDetails',
      'notes',
      'cancellationReason',
    ];

    for (const field of editableFields) {
      if (dto[field] !== undefined) {
        booking[field] = dto[field];
      }
    }

    if (dto.passengerPhon !== undefined && dto.passengerPhone === undefined) {
      booking.passengerPhone = dto.passengerPhon;
    }
    if (dto.pax !== undefined && dto.passengers === undefined) {
      booking.passengers = Number(dto.pax);
    }
    if (dto.bags !== undefined && dto.luggage === undefined) {
      booking.luggage = Number(dto.bags);
    }

    return await booking.save();
  }

  // Updates booking lifecycle status, payment status, cancellation reasons, or notes.
  async updateStatus(refOrId, dto) {
    const booking = await this.findByReferenceOrId(refOrId);

    if (dto.status) booking.status = dto.status;
    if (dto.paymentStatus) booking.paymentStatus = dto.paymentStatus;
    if (dto.cancellationReason) booking.cancellationReason = dto.cancellationReason;
    if (dto.notes !== undefined) booking.notes = dto.notes;

    return await booking.save();
  }

  // Cancels a booking by reference or ID and stores optional cancellation reason.
  async cancel(refOrId, reason) {
    const booking = await this.findByReferenceOrId(refOrId);
    booking.status = 'cancelled';
    if (reason) booking.cancellationReason = reason;

    return await booking.save();
  }

  // Permanently deletes a booking by reference code or MongoDB ObjectId.
  async delete(refOrId) {
    const booking = await this.findByReferenceOrId(refOrId);
    await Booking.findByIdAndDelete(booking._id).exec();
    return booking;
  }
}

export const bookingService = new BookingService();
