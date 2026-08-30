import express from 'express';
import { analyze, getHistory, getAnalysis, chat, chatStream, getChatHistory, updateAnalysis, checkJobStatus, getHistoryForRoot, performComparison, regenerate, finalizeAnalysis, validateAnalysis, expandFeature, repairDiagram, generateDFD, autoFixValidationIssue, deleteAnalysis, resumeAnalysis } from '../controllers/analysisController.js';
import { streamAnalysisProgress } from '../controllers/streamController.js';
import { authenticate, requireScope } from '../middleware/authMiddleware.js';

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
    deleteAnalysisSchema, resumeAnalysisSchema } from '../utils/validationSchemas.js';

const router = express.Router();

router.use(authenticate);

// Analysis Routes
router.post('/', requireScope('write'), validate(analyzeSchema), analyze);
router.get('/job/:id', requireScope('read'), validate(idParamSchema), checkJobStatus);
router.get('/', requireScope('read'), getHistory);
router.get('/history/:rootId', requireScope('read'), validate(rootIdParamSchema), getHistoryForRoot);
router.get('/diff/:id1/:id2', requireScope('read'), validate(diffParamSchema), performComparison);
router.get('/:id/stream', requireScope('read'), validate(idParamSchema), streamAnalysisProgress);
router.get('/:id', requireScope('read'), validate(getAnalysisSchema), getAnalysis);
router.put('/:id', requireScope('write'), validate(updateAnalysisSchema), updateAnalysis);
router.delete('/:id', requireScope('admin'), validate(deleteAnalysisSchema), deleteAnalysis);
router.post('/:id/regenerate', requireScope('write'), validate(regenerateSchema), regenerate);
router.post('/:id/resume', requireScope('write'), validate(resumeAnalysisSchema), resumeAnalysis);
router.post('/:id/validate', requireScope('write'), validate(idParamSchema), validateAnalysis);
router.post('/:id/finalize', requireScope('write'), validate(idParamSchema), finalizeAnalysis);
router.post('/:id/auto-fix', requireScope('write'), validate(autoFixSchema), autoFixValidationIssue);
router.post('/:id/chat', requireScope('write'), validate(chatSchema), chat);
router.post('/:id/chat/stream', requireScope('write'), validate(chatSchema), chatStream);
router.get('/:id/chat', requireScope('read'), validate(idParamSchema), getChatHistory);
router.post('/expand-feature', requireScope('write'), validate(expandFeatureSchema), expandFeature);
router.post('/repair-diagram', requireScope('write'), validate(repairDiagramSchema), repairDiagram);
router.post('/generate-dfd', requireScope('write'), validate(generateDFDSchema), generateDFD);


export default router;
