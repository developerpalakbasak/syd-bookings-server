import express from 'express';
import {
  submitApplication,
  listApplications,
  getApplicationDetails,
  reviewApplication,
} from '../controllers/corporateAccount.controller.js';
import { authenticateAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public route: Company submits corporate account application
router.post('/apply', submitApplication);

// Protected routes: Admin reviews & manages applications
router.get('/applications', authenticateAdmin, listApplications);
router.get('/applications/:id', authenticateAdmin, getApplicationDetails);
router.patch('/applications/:id/status', authenticateAdmin, reviewApplication);

export default router;
