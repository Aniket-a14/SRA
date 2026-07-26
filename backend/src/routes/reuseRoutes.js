import express from 'express';
import { suggestReuse } from '../controllers/reuseController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { aiLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validationMiddleware.js';
import { reuseSuggestSchema } from '../utils/validationSchemas.js';

const router = express.Router();

// authenticate before the body schema: an unauthenticated caller should be turned away by
// the credential check, not told which fields their payload got wrong.
router.post('/suggest', aiLimiter, authenticate, validate(reuseSuggestSchema), suggestReuse);

export default router;
