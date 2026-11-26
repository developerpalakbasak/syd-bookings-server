import { Vehicle } from '../models/vehicle.model.js';

const DEFAULT_VEHICLES = [
  {
    slug: 'executive',
    name: 'Executive Sedan',
    models: 'Premium Executive Class Sedans',
    description: 'Quiet, composed comfort for business and airport transfers.',
    maxPassengers: 4,
    maxCheckin: 2,
    maxCarryon: 2,
    trailerAvailable: false,
    multiplier: 1.0,
    baseFareAUD: 158.7,
    image: '/images/fleet/executive-sedan.jpg',
    included: [
      'Fixed price — all tolls, taxes & airport fees included',
      'Free waiting time & real-time flight tracking',
      'Free cancellation up to 4 hours before pick-up',
      'Professional accredited chauffeur & meet-and-greet',
    ],
    sortOrder: 1,
    isActive: true,
  },
  {
    slug: 'premium',
    name: 'Premium Sedan',
    models: 'Flagship Luxury First-Class Sedans',
    description: 'Our finest European sedans, with space to stretch out and unwind.',
    maxPassengers: 4,
    maxCheckin: 2,
    maxCarryon: 2,
    trailerAvailable: false,
    multiplier: 1.325,
    baseFareAUD: 210.3,
    image: '/images/fleet/premium-sedan.jpg',
    included: [
      'Flagship first-class European luxury sedan',
      'Fixed price — all tolls, taxes & airport fees included',
      'Free waiting time & real-time flight tracking',
      'Free cancellation up to 4 hours before pick-up',
    ],
    sortOrder: 2,
    isActive: true,
  },
  {
    slug: 'suv',
    name: 'Premium SUV',
    models: 'Prestige Luxury All-Wheel Drive SUVs',
    description: 'A commanding ride with room for extra luggage.',
    maxPassengers: 4,
    maxCheckin: 3,
    maxCarryon: 3,
    trailerAvailable: false,
    multiplier: 1.21,
    baseFareAUD: 192.02,
    image: '/images/fleet/premium-suv.jpg',
    included: [
      'Spacious luxury SUV with extra luggage capacity',
      'Fixed price — all tolls, taxes & airport fees included',
      'Free waiting time & real-time flight tracking',
      'Free cancellation up to 4 hours before pick-up',
    ],
    sortOrder: 3,
    isActive: true,
  },
  {
    slug: 'van',
    name: 'People Mover',
    models: 'Luxury Executive People Movers',
    description: 'Travel together in comfort, with space for luggage and larger items.',
    maxPassengers: 7,
    maxCheckin: 6,
    maxCarryon: 6,
    trailerAvailable: true,
    multiplier: 1.525,
    baseFareAUD: 241.95,
    image: '/images/fleet/people-mover.jpg',
    included: [
      'Spacious executive van for up to 7 passengers',
      'Luggage trailer available on request',
      'Fixed price — all tolls, taxes & airport fees included',
      'Free cancellation up to 4 hours before pick-up',
    ],
    sortOrder: 4,
    isActive: true,
  },
  {
    slug: 'minibus',
    name: 'Luxury Minibus',
    models: 'Luxury Minibuses (Up to 14 Seats)',
    description:
      'Arrive together, relaxed and on time, with one chauffeur and one exceptional vehicle.',
    maxPassengers: 14,
    maxCheckin: 10,
    maxCarryon: 10,
    trailerAvailable: true,
    multiplier: 1.604,
    baseFareAUD: 254.6,
    image: '/images/fleet/minibus.jpg',
    included: [
      'Deluxe group transport for up to 14 passengers',
      'Enclosed luggage trailer available',
      'Fixed price — all tolls, taxes & airport fees included',
      'Free cancellation up to 4 hours before pick-up',
    ],
    sortOrder: 5,
    isActive: true,
  },
];

async function ensureSeeded() {
  const count = await Vehicle.countDocuments();
  if (count === 0) {
    await Vehicle.insertMany(DEFAULT_VEHICLES);
  }
}

export const getAllVehicles = async (req, res, next) => {
  try {
    await ensureSeeded();
    const { isActive, search } = req.query;
    const filter = {};

    if (isActive !== undefined && isActive !== '' && isActive !== 'all') {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { models: regex }, { description: regex }, { slug: regex }];
    }

    const vehicles = await Vehicle.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();

    // Normalize id field for frontend compatibility
    const formatted = vehicles.map((v) => ({
      ...v,
      id: v.slug || String(v._id),
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      vehicles: formatted,
    });
  } catch (error) {
    next(error);
  }
};

export const getVehicleById = async (req, res, next) => {
  try {
    await ensureSeeded();
    const { id } = req.params;
    const vehicle =
      (await Vehicle.findById(id).catch(() => null)) ||
      (await Vehicle.findOne({ slug: id }));

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.status(200).json({
      success: true,
      vehicle: { ...vehicle.toObject(), id: vehicle.slug || String(vehicle._id) },
    });
  } catch (error) {
    next(error);
  }
};

export const createVehicle = async (req, res, next) => {
  try {
    await ensureSeeded();
    const payload = { ...req.body };

    if (!payload.name || !payload.name.trim()) {
      return res.status(400).json({ success: false, message: 'Vehicle name is required' });
    }

    if (!payload.slug || !payload.slug.trim()) {
      payload.slug = payload.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Ensure unique slug
    const existing = await Vehicle.findOne({ slug: payload.slug });
    if (existing) {
      payload.slug = `${payload.slug}-${Date.now().toString().slice(-4)}`;
    }

    if (typeof payload.included === 'string') {
      payload.included = payload.included
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (payload.sortOrder === undefined || payload.sortOrder === '') {
      const count = await Vehicle.countDocuments();
      payload.sortOrder = count + 1;
    }

    const created = await Vehicle.create(payload);

    res.status(201).json({
      success: true,
      message: 'Vehicle type created successfully',
      vehicle: { ...created.toObject(), id: created.slug || String(created._id) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body };
    delete payload._id;

    if (typeof payload.included === 'string') {
      payload.included = payload.included
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const updated =
      (await Vehicle.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).catch(
        () => null
      )) ||
      (await Vehicle.findOneAndUpdate({ slug: id }, payload, { new: true, runValidators: true }));

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Vehicle updated successfully',
      vehicle: { ...updated.toObject(), id: updated.slug || String(updated._id) },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted =
      (await Vehicle.findByIdAndDelete(id).catch(() => null)) ||
      (await Vehicle.findOneAndDelete({ slug: id }));

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Vehicle deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
