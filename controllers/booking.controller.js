import { bookingService } from '../services/booking.service.js';

// POST /api/bookings - Creates an internal booking.
export const createBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully',
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        pickup: booking.pickup,
        dropoff: booking.dropoff,
        pickupTime: booking.pickupTime,
        passengers: booking.passengers,
        luggage: booking.luggage,
        vehicleType: booking.vehicleType,
        passengerName: booking.passengerName,
        passengerPhone: booking.passengerPhone,
        passengerPhon: booking.passengerPhone,
        passengerEmail: booking.passengerEmail,
        status: booking.status,
        fare: booking.fare,
        paymentStatus: booking.paymentStatus,
        paymentDetails: booking.paymentDetails,
        notes: booking.notes,
        cancellationReason: booking.cancellationReason,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings - Lists paginated bookings filtered by phone, status, vehicleType, or reference.
export const getAllBookings = async (req, res, next) => {
  try {
    const { phone, status, vehicleType, bookingNumber, limit, skip } = req.query;

    const data = await bookingService.findAll({
      phone,
      status,
      vehicleType,
      bookingNumber,
      limit: limit ? parseInt(limit, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });

    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/bookings/:refOrId - Looks up booking by human-readable reference (SYD-XXXXXX) or MongoDB ObjectId.
export const getBookingByIdOrRef = async (req, res, next) => {
  try {
    const { refOrId } = req.params;
    const booking = await bookingService.findByReferenceOrId(refOrId);

    res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH / PUT /api/bookings/:refOrId - Updates a booking's details (admin edit)
export const updateBooking = async (req, res, next) => {
  try {
    const { refOrId } = req.params;
    const booking = await bookingService.update(refOrId, req.body);

    res.status(200).json({
      success: true,
      message: 'Booking updated successfully',
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/bookings/:refOrId/status - Updates booking lifecycle status, payment status, or internal notes.
export const updateBookingStatus = async (req, res, next) => {
  try {
    const { refOrId } = req.params;
    const booking = await bookingService.updateStatus(refOrId, req.body);

    res.status(200).json({
      success: true,
      message: 'Booking status updated successfully',
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/bookings/:refOrId/cancel - Cancels a booking and records an optional cancellation reason.
export const cancelBooking = async (req, res, next) => {
  try {
    const { refOrId } = req.params;
    const { reason } = req.body;
    const booking = await bookingService.cancel(refOrId, reason);

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/bookings/:refOrId - Permanently deletes a booking.
export const deleteBooking = async (req, res, next) => {
  try {
    const { refOrId } = req.params;
    const booking = await bookingService.delete(refOrId);

    res.status(200).json({
      success: true,
      message: 'Booking deleted successfully',
      booking,
    });
  } catch (error) {
    next(error);
  }
};

