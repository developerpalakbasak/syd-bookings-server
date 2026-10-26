import { routeService } from '../services/route.service.js';

// GET /api/routes - Retrieves route fares with optional filters and pagination
export const getAllRoutes = async (req, res, next) => {
  try {
    const { unique, format, isActive, search } = req.query;

    if (unique === 'true' || format === 'names') {
      const activeBool =
        isActive !== undefined && isActive !== '' ? isActive === 'true' : undefined;
      const places = await routeService.getAllUniquePlaces({
        isActive: activeBool,
        search,
      });

      return res.status(200).json({
        success: true,
        count: places.length,
        places,
      });
    }

    const data = await routeService.findAll(req.query);
    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/routes/all - Retrieves deduplicated place names or details
export const getAllPlaces = async (req, res, next) => {
  try {
    const { isActive, search, q, raw, details } = req.query;
    const activeBool =
      isActive !== undefined && isActive !== '' ? isActive === 'true' : undefined;
    const searchTerm = q || search;
    const withDetails = details === 'true';

    if (withDetails) {
      const places = await routeService.getAllUniquePlacesWithDetails({
        isActive: activeBool,
        search: searchTerm,
      });

      if (raw === 'true') {
        return res.status(200).json(places);
      }

      return res.status(200).json({
        success: true,
        count: places.length,
        places,
      });
    }

    const places = await routeService.getAllUniquePlaces({
      isActive: activeBool,
      search: searchTerm,
    });

    if (raw === 'true') {
      return res.status(200).json(places);
    }

    res.status(200).json({
      success: true,
      count: places.length,
      places,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/routes/search?q=... - Autocomplete search for places
export const searchPlaces = async (req, res, next) => {
  try {
    const { q, search, isActive, details } = req.query;
    const searchTerm = q || search;
    const activeBool =
      isActive !== undefined && isActive !== '' ? isActive === 'true' : undefined;
    const withDetails = details !== 'false';

    if (withDetails) {
      const places = await routeService.getAllUniquePlacesWithDetails({
        isActive: activeBool,
        search: searchTerm,
      });

      return res.status(200).json({
        success: true,
        count: places.length,
        places,
      });
    }

    const places = await routeService.getAllUniquePlaces({
      isActive: activeBool,
      search: searchTerm,
    });

    res.status(200).json({
      success: true,
      count: places.length,
      places,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/routes/destinations?from=... - Connected destinations for an origin
export const getConnectedDestinations = async (req, res, next) => {
  try {
    const { from, pickup, firstPlace, origin, isActive } = req.query;
    const originPlace = from || pickup || firstPlace || origin;
    const activeBool =
      isActive !== undefined && isActive !== '' ? isActive === 'true' : true;

    const places = await routeService.getConnectedPlaces(originPlace, activeBool);

    res.status(200).json({
      success: true,
      origin: originPlace,
      count: places.length,
      places,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/routes/lookup?firstPlace=...&lastPlace=... - Route fare lookup
export const lookupRoute = async (req, res, next) => {
  try {
    const { firstPlace, lastPlace, from, to, pickup, destination } = req.query;
    const origin = firstPlace || from || pickup;
    const dest = lastPlace || to || destination;

    const route = await routeService.findByRoute(origin, dest);

    res.status(200).json({
      success: true,
      route,
      place: route,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/routes/route/:firstPlace/:lastPlace - Path parameter lookup alternative
export const lookupByPath = async (req, res, next) => {
  try {
    const { firstPlace, lastPlace } = req.params;
    const route = await routeService.findByRoute(firstPlace, lastPlace);

    res.status(200).json({
      success: true,
      route,
      place: route,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/routes/seed - Seeds predefined default route fares
export const seedRoutes = async (req, res, next) => {
  try {
    const result = await routeService.seedDefaultPlaces();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// GET /api/routes/:id - Retrieves a single route fare by ID
export const getRouteById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const route = await routeService.findById(id);

    res.status(200).json({
      success: true,
      route,
      place: route,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/routes - Creates a new route fare
export const createRoute = async (req, res, next) => {
  try {
    const route = await routeService.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Route fare created successfully',
      route,
      place: route,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/routes/:id or PUT /api/routes/:id - Updates an existing route fare
export const updateRoute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const route = await routeService.update(id, req.body);

    res.status(200).json({
      success: true,
      message: 'Route fare updated successfully',
      route,
      place: route,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/routes/:id - Deletes a route fare
export const deleteRoute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const route = await routeService.delete(id);

    res.status(200).json({
      success: true,
      message: `Route with ID '${id}' deleted successfully`,
      route,
    });
  } catch (error) {
    next(error);
  }
};
