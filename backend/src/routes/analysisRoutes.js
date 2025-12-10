import express from 'express';
import { analyze, getHistory, getAnalysis } from '../controllers/analysisController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

router.post('/', analyze);
router.get('/', getHistory);
router.get('/:id', getAnalysis);

export default router;
