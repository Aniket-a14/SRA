import express from 'express';
import { analyze, getHistory, getAnalysis, chat, getChatHistory, updateAnalysis, generateCode, checkJobStatus, getHistoryForRoot, performComparison, regenerate, finalizeAnalysis, validateAnalysis, expandFeature } from '../controllers/analysisController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

// Analysis Routes
router.post('/', analyze);
router.get('/job/:id', checkJobStatus);
router.get('/', getHistory);
router.get('/history/:rootId', getHistoryForRoot);
router.get('/diff/:id1/:id2', performComparison);
router.get('/:id', getAnalysis);
router.post('/:id/finalize', finalizeAnalysis);
router.put('/:id', updateAnalysis);
router.post('/:id/code', generateCode);
router.post('/:id/regenerate', regenerate);
router.post('/:id/validate', validateAnalysis); // Layer 2 Check
router.post('/:id/chat', chat);
router.get('/:id/chat', getChatHistory);
router.post('/expand-feature', expandFeature);

export default router;
