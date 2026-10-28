import { Router } from 'express';
import healthRoutes from './health.routes.js';
import bookingRoutes from './booking.routes.js';
import routeRoutes from './route.routes.js';
import paymentRoutes from './payment.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/bookings', bookingRoutes);
router.use('/routes', routeRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);

export default router;

