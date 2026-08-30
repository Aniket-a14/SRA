import express from 'express';
import { authenticate, requireScope } from '../middleware/authMiddleware.js';
import { globalSearch } from '../controllers/searchController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requireScope('read'), globalSearch);

export default router;
