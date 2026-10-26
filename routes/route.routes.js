import { Router } from 'express';
import {
  getAllRoutes,
  getAllPlaces,
  searchPlaces,
  getConnectedDestinations,
  lookupRoute,
  lookupByPath,
  seedRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
} from '../controllers/route.controller.js';

const router = Router();

// Place utilities and lookups (defined before /:id)
router.get('/all', getAllPlaces);
router.get('/names', getAllPlaces);
router.get('/unique', getAllPlaces);
router.get('/all-places', getAllPlaces);
router.get('/search', searchPlaces);
router.get('/destinations', getConnectedDestinations);
router.get('/lookup', lookupRoute);
router.get('/route/:firstPlace/:lastPlace', lookupByPath);
router.post('/seed', seedRoutes);

// Main CRUD routes
router.get('/', getAllRoutes);
router.post('/', createRoute);
router.get('/:id', getRouteById);
router.patch('/:id', updateRoute);
router.put('/:id', updateRoute);
router.delete('/:id', deleteRoute);

export default router;
