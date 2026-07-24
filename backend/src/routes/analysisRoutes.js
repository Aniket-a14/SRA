import express from 'express';
import { analyze, getHistory, getAnalysis, chat, chatStream, getChatHistory, updateAnalysis, checkJobStatus, getHistoryForRoot, performComparison, regenerate, finalizeAnalysis, validateAnalysis, expandFeature, repairDiagram, generateDFD, autoFixValidationIssue, deleteAnalysis, resumeAnalysis } from '../controllers/analysisController.js';
import { streamAnalysisProgress } from '../controllers/streamController.js';
import { authenticate } from '../middleware/authMiddleware.js';

import { validate } from '../middleware/validationMiddleware.js';
import {
    analyzeSchema,
    idParamSchema,
    getAnalysisSchema,
    rootIdParamSchema,
    diffParamSchema,
    updateAnalysisSchema,
    chatSchema,
    regenerateSchema,
    autoFixSchema,
    expandFeatureSchema,
    repairDiagramSchema,
    generateDFDSchema,
    deleteAnalysisSchema
} from '../utils/validationSchemas.js';

const router = express.Router();

router.use(authenticate);

// Analysis Routes
router.post('/', validate(analyzeSchema), analyze);
router.get('/job/:id', validate(idParamSchema), checkJobStatus);
router.get('/', getHistory);
router.get('/history/:rootId', validate(rootIdParamSchema), getHistoryForRoot);
router.get('/diff/:id1/:id2', validate(diffParamSchema), performComparison);
router.get('/:id/stream', validate(idParamSchema), streamAnalysisProgress);
router.get('/:id', validate(getAnalysisSchema), getAnalysis);
router.put('/:id', validate(updateAnalysisSchema), updateAnalysis);
router.delete('/:id', validate(deleteAnalysisSchema), deleteAnalysis);
router.post('/:id/regenerate', validate(regenerateSchema), regenerate);
router.post('/:id/resume', validate(idParamSchema), resumeAnalysis);
router.post('/:id/validate', validate(idParamSchema), validateAnalysis);
router.post('/:id/finalize', validate(idParamSchema), finalizeAnalysis);
router.post('/:id/auto-fix', validate(autoFixSchema), autoFixValidationIssue);
router.post('/:id/chat', validate(chatSchema), chat);
router.post('/:id/chat/stream', validate(chatSchema), chatStream);
router.get('/:id/chat', validate(idParamSchema), getChatHistory);
router.post('/expand-feature', validate(expandFeatureSchema), expandFeature);
router.post('/repair-diagram', validate(repairDiagramSchema), repairDiagram);
router.post('/generate-dfd', validate(generateDFDSchema), generateDFD);


export default router;
