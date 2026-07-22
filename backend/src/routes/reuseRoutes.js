import express from 'express';
import { suggestReuse } from '../controllers/reuseController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { aiLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

router.post('/suggest', aiLimiter, authenticate, suggestReuse);

export default router;
