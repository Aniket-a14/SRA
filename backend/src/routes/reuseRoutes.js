import express from 'express';
import { suggestReuse } from '../controllers/reuseController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/suggest', authenticate, suggestReuse);

export default router;
