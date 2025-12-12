import express from 'express';
import { analyze, getHistory, getAnalysis, chat, getChatHistory, updateAnalysis, generateCode, checkJobStatus } from '../controllers/analysisController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

// Analysis Routes
router.post('/', analyze);
router.get('/job/:id', checkJobStatus);
router.get('/', getHistory);
router.get('/:id', getAnalysis);
router.put('/:id', updateAnalysis);
router.post('/:id/code', generateCode);
router.post('/:id/chat', chat);
router.get('/:id/chat', getChatHistory);

export default router;
