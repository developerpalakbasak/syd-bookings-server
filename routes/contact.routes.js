import { Router } from 'express';
import { submitContact } from '../controllers/contact.controller.js';

const router = Router();

// Public route: submit enquiry from contact form
router.post('/', submitContact);

export default router;
