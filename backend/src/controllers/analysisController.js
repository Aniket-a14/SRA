import { performAnalysis, getUserAnalyses, getAnalysisById, getAnalysisHistory } from '../services/analysisService.js';
import { processChat } from '../services/chatService.js';
import { generateCodeFromAnalysis } from '../services/codeGenService.js';
import { addAnalysisJob, getJobStatus } from '../services/queueService.js';
import { compareAnalyses } from '../services/diffService.js';
import prisma from '../config/prisma.js';

export const analyze = async (req, res, next) => {
    try {
        const { text } = req.body;
        if (!text || typeof text !== 'string') {
            const error = new Error('Text input is required and must be a string');
            error.statusCode = 400;
            throw error;
        }

        if (text.length > 20000) {
            const error = new Error('Text input exceeds maximum limit of 20,000 characters');
            error.statusCode = 400;
            throw error;
        }

        // OFFLOAD TO QUEUE
        const job = await addAnalysisJob(req.user.userId, text);

        res.status(202).json({
            message: "Analysis queued",
            jobId: job.id,
            status: "queued"
        });
    } catch (error) {
        next(error);
    }
};

export const checkJobStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const status = await getJobStatus(id);

        if (!status) {
            const error = new Error('Job not found');
            error.statusCode = 404;
            throw error;
        }

        res.json(status);
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

export const getHistoryForRoot = async (req, res, next) => {
    try {
        const { rootId } = req.params;
        const history = await getAnalysisHistory(req.user.userId, rootId);
        res.json(history);
    } catch (error) {
        next(error);
    }
};

export const performComparison = async (req, res, next) => {
    try {
        const { id1, id2 } = req.params;

        // Fetch both to ensure ownership
        const [v1, v2] = await Promise.all([
            getAnalysisById(req.user.userId, id1),
            getAnalysisById(req.user.userId, id2)
        ]);

        if (!v1 || !v2) {
            const error = new Error('One or both analyses not found or unauthorized');
            error.statusCode = 404;
            throw error;
        }

        const diff = compareAnalyses(v1, v2);
        res.json(diff);
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
        res.json({
            ...analysis.resultJson,
            id: analysis.id,
            title: analysis.title,
            version: analysis.version,
            createdAt: analysis.createdAt,
            generatedCode: analysis.generatedCode,
            rootId: analysis.rootId,
            parentId: analysis.parentId
        });
    } catch (error) {
        next(error);
    }
};

export const updateAnalysis = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { functionalRequirements, nonFunctionalRequirements, userStories, entities, apiContracts, acceptanceCriteria, flowchartDiagram, sequenceDiagram, cleanedRequirements } = req.body;

        // Fetch existing to ensure ownership
        const analysis = await getAnalysisById(req.user.userId, id);
        if (!analysis) {
            const error = new Error('Analysis not found');
            error.statusCode = 404;
            throw error;
        }

        // Merge updates into resultJson
        const updatedResultJson = {
            ...analysis.resultJson,
            ...(flowchartDiagram && { flowchartDiagram }),
            ...(sequenceDiagram && { sequenceDiagram }),
            // Allow other updates if needed, but primary goal is diagrams
        };

        const updatedAnalysis = await prisma.analysis.update({
            where: { id },
            data: { resultJson: updatedResultJson }
        });

        res.json({
            ...updatedAnalysis.resultJson,
            id: updatedAnalysis.id,
            title: updatedAnalysis.title,
            version: updatedAnalysis.version,
            createdAt: updatedAnalysis.createdAt,
            generatedCode: updatedAnalysis.generatedCode,
            rootId: updatedAnalysis.rootId,
            parentId: updatedAnalysis.parentId
        });
    } catch (error) {
        next(error);
    }
};

export const chat = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        if (!message) throw new Error("Message is required");

        const response = await processChat(req.user.userId, id, message);
        res.json(response);
    } catch (error) {
        next(error);
    }
};

export const getChatHistory = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Verify ownership
        const analysis = await prisma.analysis.findUnique({ where: { id } });
        if (!analysis || analysis.userId !== req.user.userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const rootId = analysis.rootId || analysis.id;

        // Find all analyses in this chain
        const chainAnalyses = await prisma.analysis.findMany({
            where: {
                OR: [
                    { id: rootId },
                    { rootId: rootId }
                ]
            },
            select: { id: true }
        });

        const chainIds = chainAnalyses.map(a => a.id);

        const messages = await prisma.chatMessage.findMany({
            where: { analysisId: { in: chainIds } },
            orderBy: { createdAt: 'asc' }
        });
        res.json(messages);
    } catch (error) {
        next(error);
    }
};

export const generateCode = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await generateCodeFromAnalysis(req.user.userId, id);
        res.json(result);
    } catch (error) {
        next(error);
    }
};
