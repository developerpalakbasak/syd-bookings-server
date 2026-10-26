import mongoose from 'mongoose';
import { Route } from '../models/route.model.js';

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class RouteService {
  // Returns unique deduplicated place names
  async getAllUniquePlaces(options = {}) {
    const filter = {};
    if (options.isActive !== undefined) {
      filter.isActive = options.isActive;
    }

    const [firstPlaces, lastPlaces] = await Promise.all([
      Route.distinct('firstPlace', filter).exec(),
      Route.distinct('lastPlace', filter).exec(),
    ]);

    const uniqueMap = new Map();
    for (const place of [...(firstPlaces || []), ...(lastPlaces || [])]) {
      if (typeof place === 'string') {
        const trimmed = place.trim();
        if (trimmed.length > 0) {
          const lowerKey = trimmed.toLowerCase();
          if (!uniqueMap.has(lowerKey)) {
            uniqueMap.set(lowerKey, trimmed);
          }
        }
      }
    }

    let places = Array.from(uniqueMap.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    if (options.search) {
      const searchLower = options.search.trim().toLowerCase();
      places = places.filter((p) => p.toLowerCase().includes(searchLower));
    }

    return places;
  }

  // Returns unique places with location details (address, coordinates, codes)
  async getAllUniquePlacesWithDetails(options = {}) {
    const filter = {};
    if (options.isActive !== undefined) {
      filter.isActive = options.isActive;
    }

    const routes = await Route.find(filter)
      .select('firstPlace lastPlace firstPlaceDetails lastPlaceDetails')
      .lean()
      .exec();

    const uniqueMap = new Map();

    const addOrMerge = (name, details) => {
      if (!name || typeof name !== 'string') return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const lowerKey = trimmed.toLowerCase();

      if (!uniqueMap.has(lowerKey)) {
        uniqueMap.set(lowerKey, {
          name: trimmed,
          address: details?.address || '',
          lat: details?.lat,
          lng: details?.lng,
          code: details?.code || '',
        });
      } else if (details) {
        const existing = uniqueMap.get(lowerKey);
        if (!existing.address && details.address) existing.address = details.address;
        if (existing.lat === undefined && details.lat !== undefined) existing.lat = details.lat;
        if (existing.lng === undefined && details.lng !== undefined) existing.lng = details.lng;
        if (!existing.code && details.code) existing.code = details.code;
      }
    };

    for (const route of routes) {
      addOrMerge(route.firstPlace, route.firstPlaceDetails);
      addOrMerge(route.lastPlace, route.lastPlaceDetails);
    }

    let places = Array.from(uniqueMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

    if (options.search) {
      const searchLower = options.search.trim().toLowerCase();
      places = places.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.code && p.code.toLowerCase().includes(searchLower)) ||
          (p.address && p.address.toLowerCase().includes(searchLower))
      );
    }

    return places;
  }

  // Retrieves connected destination places given an origin place
  async getConnectedPlaces(origin, isActive = true) {
    if (!origin || !origin.trim()) {
      return this.getAllUniquePlacesWithDetails({ isActive });
    }

    const cleanOrigin = origin.trim();
    const escaped = escapeRegex(cleanOrigin);

    const filter = {
      $or: [
        { firstPlace: new RegExp(`^${escaped}$`, 'i') },
        { lastPlace: new RegExp(`^${escaped}$`, 'i') },
        { firstPlace: new RegExp(escaped, 'i') },
        { lastPlace: new RegExp(escaped, 'i') },
      ],
    };

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    const connectedRoutes = await Route.find(filter)
      .select('firstPlace lastPlace firstPlaceDetails lastPlaceDetails vehicleAndFares currency')
      .lean()
      .exec();

    const destinationsMap = new Map();

    for (const route of connectedRoutes) {
      const isFirst =
        route.firstPlace &&
        route.firstPlace.toLowerCase().includes(cleanOrigin.toLowerCase());
      const isLast =
        route.lastPlace &&
        route.lastPlace.toLowerCase().includes(cleanOrigin.toLowerCase());

      if (isFirst && route.lastPlace) {
        const destName = route.lastPlace.trim();
        const lower = destName.toLowerCase();
        if (lower !== cleanOrigin.toLowerCase() && !destinationsMap.has(lower)) {
          destinationsMap.set(lower, {
            name: destName,
            address: route.lastPlaceDetails?.address || '',
            lat: route.lastPlaceDetails?.lat,
            lng: route.lastPlaceDetails?.lng,
            code: route.lastPlaceDetails?.code || '',
          });
        }
      }

      if (isLast && route.firstPlace) {
        const destName = route.firstPlace.trim();
        const lower = destName.toLowerCase();
        if (lower !== cleanOrigin.toLowerCase() && !destinationsMap.has(lower)) {
          destinationsMap.set(lower, {
            name: destName,
            address: route.firstPlaceDetails?.address || '',
            lat: route.firstPlaceDetails?.lat,
            lng: route.firstPlaceDetails?.lng,
            code: route.firstPlaceDetails?.code || '',
          });
        }
      }
    }

    return Array.from(destinationsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }

  // Lists routes with filtering and pagination
  async findAll(query = {}) {
    const filter = {};

    if (query.isActive !== undefined && query.isActive !== '') {
      filter.isActive = query.isActive === 'true';
    }

    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$or = [
        { firstPlace: searchRegex },
        { lastPlace: searchRegex },
        { notes: searchRegex },
      ];
    } else {
      if (query.firstPlace) {
        filter.firstPlace = new RegExp(escapeRegex(query.firstPlace.trim()), 'i');
      }
      if (query.lastPlace) {
        filter.lastPlace = new RegExp(escapeRegex(query.lastPlace.trim()), 'i');
      }
    }

    const limit = query.limit ? Math.max(1, parseInt(query.limit, 10)) : 50;
    const skip = query.skip ? Math.max(0, parseInt(query.skip, 10)) : 0;

    const [routes, total] = await Promise.all([
      Route.find(filter)
        .sort({ firstPlace: 1, lastPlace: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Route.countDocuments(filter).exec(),
    ]);

    return {
      routes,
      places: routes,
      total,
      limit,
      skip,
    };
  }

  // Looks up route fare by firstPlace and lastPlace (exact & fuzzy, forward & reverse)
  async findByRoute(firstPlace, lastPlace) {
    if (!firstPlace || !lastPlace) {
      const err = new Error(
        'Both pickup and destination locations are required (e.g. ?firstPlace=...&lastPlace=... or ?from=...&to=...)'
      );
      err.statusCode = 400;
      throw err;
    }

    const originClean = firstPlace.trim();
    const destClean = lastPlace.trim();
    const originEscaped = escapeRegex(originClean);
    const destEscaped = escapeRegex(destClean);

    // 1. Forward exact
    let route = await Route.findOne({
      firstPlace: new RegExp(`^${originEscaped}$`, 'i'),
      lastPlace: new RegExp(`^${destEscaped}$`, 'i'),
      isActive: true,
    }).exec();

    // 2. Reverse exact
    if (!route) {
      route = await Route.findOne({
        firstPlace: new RegExp(`^${destEscaped}$`, 'i'),
        lastPlace: new RegExp(`^${originEscaped}$`, 'i'),
        isActive: true,
      }).exec();
    }

    // 3. Forward substring
    if (!route) {
      route = await Route.findOne({
        firstPlace: new RegExp(originEscaped, 'i'),
        lastPlace: new RegExp(destEscaped, 'i'),
        isActive: true,
      }).exec();
    }

    // 4. Reverse substring
    if (!route) {
      route = await Route.findOne({
        firstPlace: new RegExp(destEscaped, 'i'),
        lastPlace: new RegExp(originEscaped, 'i'),
        isActive: true,
      }).exec();
    }

    if (!route) {
      const totalCount = await Route.countDocuments().exec();
      if (totalCount === 0) {
        const err = new Error(
          'No routes found in the database. Please seed default routes first via POST /api/routes/seed or create a route via POST /api/routes'
        );
        err.statusCode = 404;
        throw err;
      }

      const err = new Error(
        `Fare route between '${firstPlace}' and '${lastPlace}' not found. Please check location names or use GET /api/routes to view available routes.`
      );
      err.statusCode = 404;
      throw err;
    }

    return route;
  }

  // Finds a single route by ID
  async findById(id) {
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error(`Invalid route ID format: ${id}`);
      err.statusCode = 400;
      throw err;
    }

    const route = await Route.findById(id).exec();
    if (!route) {
      const err = new Error(`Route with ID '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    return route;
  }

  // Creates a new route
  async create(dto) {
    if (!dto.firstPlace || !dto.firstPlace.trim()) {
      const err = new Error('firstPlace is required');
      err.statusCode = 400;
      throw err;
    }
    if (!dto.lastPlace || !dto.lastPlace.trim()) {
      const err = new Error('lastPlace is required');
      err.statusCode = 400;
      throw err;
    }

    const firstPlaceClean = dto.firstPlace.trim();
    const lastPlaceClean = dto.lastPlace.trim();

    const existing = await Route.findOne({
      firstPlace: new RegExp(`^${escapeRegex(firstPlaceClean)}$`, 'i'),
      lastPlace: new RegExp(`^${escapeRegex(lastPlaceClean)}$`, 'i'),
    }).exec();

    if (existing) {
      const err = new Error(
        `Route between '${firstPlaceClean}' and '${lastPlaceClean}' already exists`
      );
      err.statusCode = 409;
      throw err;
    }

    let vehicleAndFares = dto.vehicleAndFares || dto.vehicleFares || {};
    if (Object.keys(vehicleAndFares).length === 0) {
      const fallbackFare = dto.fair ?? dto.fare;
      if (fallbackFare !== undefined && !isNaN(Number(fallbackFare))) {
        vehicleAndFares = { taxi: Number(fallbackFare) };
      }
    }

    if (Object.keys(vehicleAndFares).length === 0) {
      const err = new Error(
        'vehicleAndFares must contain at least 1 vehicle fare mapping (e.g. { taxi: 75 })'
      );
      err.statusCode = 400;
      throw err;
    }

    let increaseFarePerPersonMap = {};
    const rawPerPerson = dto.increaseFarePerPerson ?? dto.increaseFairPerPerson;
    if (typeof rawPerPerson === 'number') {
      for (const vKey of Object.keys(vehicleAndFares)) {
        increaseFarePerPersonMap[vKey] = Number(rawPerPerson);
      }
    } else if (rawPerPerson && typeof rawPerPerson === 'object') {
      increaseFarePerPersonMap = rawPerPerson;
    }

    const payload = {
      ...dto,
      firstPlace: firstPlaceClean,
      lastPlace: lastPlaceClean,
      vehicleAndFares,
      increaseFarePerPerson: increaseFarePerPersonMap,
      currency: (dto.currency ?? 'AUD').trim().toUpperCase(),
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    };

    const newRoute = new Route(payload);
    return await newRoute.save();
  }

  // Updates an existing route by ID
  async update(id, dto) {
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error(`Invalid route ID format: ${id}`);
      err.statusCode = 400;
      throw err;
    }

    const updateData = { ...dto };

    if (dto.firstPlace) updateData.firstPlace = dto.firstPlace.trim();
    if (dto.lastPlace) updateData.lastPlace = dto.lastPlace.trim();

    if (dto.vehicleAndFares || dto.vehicleFares) {
      updateData.vehicleAndFares = dto.vehicleAndFares || dto.vehicleFares;
    }

    const rawPerPerson = dto.increaseFarePerPerson ?? dto.increaseFairPerPerson;
    if (typeof rawPerPerson === 'number') {
      const vFares = updateData.vehicleAndFares || {};
      const map = {};
      for (const k of Object.keys(vFares)) {
        map[k] = Number(rawPerPerson);
      }
      updateData.increaseFarePerPerson = map;
    } else if (rawPerPerson && typeof rawPerPerson === 'object') {
      updateData.increaseFarePerPerson = rawPerPerson;
    }

    if (dto.currency) {
      updateData.currency = dto.currency.trim().toUpperCase();
    }

    const updated = await Route.findByIdAndUpdate(id, updateData, {
      returnDocument: 'after',
    }).exec();

    if (!updated) {
      const err = new Error(`Route with ID '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    return updated;
  }

  // Deletes a route by ID
  async delete(id) {
    if (!mongoose.isValidObjectId(id)) {
      const err = new Error(`Invalid route ID format: ${id}`);
      err.statusCode = 400;
      throw err;
    }

    const deleted = await Route.findByIdAndDelete(id).exec();
    if (!deleted) {
      const err = new Error(`Route with ID '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    return deleted;
  }

  // Seeds default Sydney transfer routes
  async seedDefaultPlaces() {
    const defaultRoutes = [
      {
        firstPlace: 'Sydney Airport (SYD)',
        lastPlace: 'Sydney CBD',
        increaseFarePerPerson: { taxi: 10, executive: 10, luxury: 15, suv: 12, mpv: 12, van: 15 },
        currency: 'AUD',
        distanceKm: 14,
        durationMin: 25,
        vehicleAndFares: {
          taxi: 65,
          executive: 85,
          luxury: 110,
          suv: 95,
          mpv: 105,
          van: 125,
        },
        firstPlaceDetails: { address: 'Mascot NSW 2020', lat: -33.9399, lng: 151.1753, code: 'SYD' },
        lastPlaceDetails: { address: 'Sydney NSW 2000', lat: -33.8688, lng: 151.2093, code: 'CBD' },
        isActive: true,
        notes: 'Popular airport to downtown transfer route',
      },
      {
        firstPlace: 'Sydney Airport (SYD)',
        lastPlace: 'Bondi Beach',
        increaseFarePerPerson: { taxi: 10, executive: 10, luxury: 15, suv: 12, mpv: 12, van: 15 },
        currency: 'AUD',
        distanceKm: 16,
        durationMin: 30,
        vehicleAndFares: {
          taxi: 75,
          executive: 95,
          luxury: 125,
          suv: 105,
          mpv: 115,
          van: 135,
        },
        firstPlaceDetails: { address: 'Mascot NSW 2020', lat: -33.9399, lng: 151.1753, code: 'SYD' },
        lastPlaceDetails: { address: 'Bondi Beach NSW 2026', lat: -33.8915, lng: 151.2767 },
        isActive: true,
        notes: 'Eastern suburbs coastal route',
      },
      {
        firstPlace: 'Sydney Airport (SYD)',
        lastPlace: 'Parramatta',
        increaseFarePerPerson: { taxi: 15, executive: 15, luxury: 20, suv: 18, mpv: 18, van: 20 },
        currency: 'AUD',
        distanceKm: 28,
        durationMin: 40,
        vehicleAndFares: {
          taxi: 95,
          executive: 120,
          luxury: 155,
          suv: 135,
          mpv: 145,
          van: 170,
        },
        firstPlaceDetails: { address: 'Mascot NSW 2020', lat: -33.9399, lng: 151.1753, code: 'SYD' },
        lastPlaceDetails: { address: 'Parramatta NSW 2150', lat: -33.815, lng: 151.0011 },
        isActive: true,
        notes: 'Western Sydney business hub',
      },
      {
        firstPlace: 'Sydney Airport (SYD)',
        lastPlace: 'Manly',
        increaseFarePerPerson: { taxi: 15, executive: 15, luxury: 20, suv: 18, mpv: 18, van: 20 },
        currency: 'AUD',
        distanceKm: 27,
        durationMin: 45,
        vehicleAndFares: {
          taxi: 110,
          executive: 140,
          luxury: 175,
          suv: 150,
          mpv: 165,
          van: 190,
        },
        firstPlaceDetails: { address: 'Mascot NSW 2020', lat: -33.9399, lng: 151.1753, code: 'SYD' },
        lastPlaceDetails: { address: 'Manly NSW 2095', lat: -33.7971, lng: 151.2882 },
        isActive: true,
        notes: 'Northern Beaches transfer',
      },
      {
        firstPlace: 'Sydney Airport (SYD)',
        lastPlace: 'Chatswood',
        increaseFarePerPerson: { taxi: 12, executive: 12, luxury: 18, suv: 15, mpv: 15, van: 18 },
        currency: 'AUD',
        distanceKm: 22,
        durationMin: 35,
        vehicleAndFares: {
          taxi: 85,
          executive: 110,
          luxury: 145,
          suv: 120,
          mpv: 135,
          van: 155,
        },
        firstPlaceDetails: { address: 'Mascot NSW 2020', lat: -33.9399, lng: 151.1753, code: 'SYD' },
        lastPlaceDetails: { address: 'Chatswood NSW 2067', lat: -33.7961, lng: 151.178 },
        isActive: true,
        notes: 'North Shore commercial center',
      },
      {
        firstPlace: 'Sydney CBD',
        lastPlace: 'Bondi Beach',
        increaseFarePerPerson: { taxi: 8, executive: 8, luxury: 12, suv: 10, mpv: 10, van: 12 },
        currency: 'AUD',
        distanceKm: 8,
        durationMin: 20,
        vehicleAndFares: {
          taxi: 35,
          executive: 50,
          luxury: 70,
          suv: 60,
          mpv: 65,
          van: 85,
        },
        firstPlaceDetails: { address: 'Sydney NSW 2000', lat: -33.8688, lng: 151.2093 },
        lastPlaceDetails: { address: 'Bondi Beach NSW 2026', lat: -33.8915, lng: 151.2767 },
        isActive: true,
        notes: 'Inner city to beach transfer',
      },
      {
        firstPlace: 'Sydney CBD',
        lastPlace: 'Manly Beach',
        increaseFarePerPerson: { taxi: 10, executive: 10, luxury: 15, suv: 12, mpv: 12, van: 15 },
        currency: 'AUD',
        distanceKm: 15,
        durationMin: 30,
        vehicleAndFares: {
          taxi: 55,
          executive: 75,
          luxury: 100,
          suv: 85,
          mpv: 95,
          van: 115,
        },
        firstPlaceDetails: { address: 'Sydney NSW 2000', lat: -33.8688, lng: 151.2093 },
        lastPlaceDetails: { address: 'Manly NSW 2095', lat: -33.7971, lng: 151.2882 },
        isActive: true,
        notes: 'CBD to Northern Beaches',
      },
    ];

    const results = [];
    for (const route of defaultRoutes) {
      const updated = await Route.findOneAndUpdate(
        {
          firstPlace: route.firstPlace,
          lastPlace: route.lastPlace,
        },
        { $set: route },
        { upsert: true, returnDocument: 'after' }
      );
      results.push(updated);
    }

    return {
      success: true,
      message: `Successfully seeded ${results.length} default route fares`,
      count: results.length,
      routes: results,
      places: results,
    };
  }
}

export const routeService = new RouteService();
