import { performAnalysis, getUserAnalyses, getAnalysisById } from '../services/analysisService.js';

export const analyze = async (req, res, next) => {
    try {
        const { text } = req.body;
        if (!text) {
            const error = new Error('Text input is required');
            error.statusCode = 400;
            throw error;
        }

        const result = await performAnalysis(req.user.userId, text);
        res.status(201).json({
            analysisId: result.id,
            result: result.resultJson
        });
    } catch (error) {
        next(error);
    }
};

export const getHistory = async (req, res, next) => {
    try {
        const history = await getUserAnalyses(req.user.userId);
        res.json(history);
    } catch (error) {
        next(error);
    }
};

export const getAnalysis = async (req, res, next) => {
    try {
        const { id } = req.params;
        const analysis = await getAnalysisById(req.user.userId, id);
        if (!analysis) {
            const error = new Error('Analysis not found');
            error.statusCode = 404;
            throw error;
        }
        res.json(analysis);
    } catch (error) {
        next(error);
    }
};
