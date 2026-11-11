import { Router } from 'express';
import { calculateFare } from '../controllers/fare.controller.js';

const router = Router();

// GET /api/fare/calculate?fromLat=&fromLng=&toLat=&toLng=&vehicle=chauffeur&pickupTime=&toName=
router.get('/calculate', calculateFare);

export default router;

