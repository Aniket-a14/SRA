import { performAnalysis, getUserAnalyses, getAnalysisById, getAnalysisHistory } from '../services/analysisService.js';
import { processChat } from '../services/chatService.js';
import { generateCodeFromAnalysis } from '../services/codeGenService.js';
import { addAnalysisJob, getJobStatus } from '../services/queueService.js';
import { compareAnalyses } from '../services/diffService.js';
import { lintRequirements } from '../services/qualityService.js';
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
        const job = await addAnalysisJob(req.user.userId, text, req.body.projectId, req.body.settings);

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
        const updates = req.body; // Can contain any field of resultJson

        // 1. Fetch existing analysis
        const currentAnalysis = await getAnalysisById(req.user.userId, id);
        if (!currentAnalysis) {
            const error = new Error('Analysis not found');
            error.statusCode = 404;
            throw error;
        }

        // 2. Merge updates
        const newResultJson = {
            ...currentAnalysis.resultJson,
            ...updates
        };

        // 3. Re-run Quality Check (Linting)
        const qualityAudit = lintRequirements({ ...newResultJson });
        newResultJson.qualityAudit = qualityAudit;

        // 4. Run Diff (Previous vs New)
        // We compare the 'currentAnalysis' (which is now 'vOld') against 'newResultJson' (which is 'vNew')
        // We construct a mock object for v2 to match compareAnalyses signature
        const diff = compareAnalyses(currentAnalysis, { inputText: currentAnalysis.inputText, resultJson: newResultJson });
        newResultJson.diff = diff;

        // 5. Create NEW Analysis Version (Atomic Transaction)
        const newAnalysis = await prisma.$transaction(async (tx) => {
            // Find root properties
            const rootId = currentAnalysis.rootId || currentAnalysis.id;

            // Find max version for this root
            const maxVersionAgg = await tx.analysis.findFirst({
                where: { rootId },
                orderBy: { version: 'desc' },
                select: { version: true }
            });
            const nextVersion = (maxVersionAgg?.version || 0) + 1;

            // Create
            return await tx.analysis.create({
                data: {
                    userId: req.user.userId,
                    inputText: currentAnalysis.inputText, // Input text doesn't change, we are refining reqs
                    resultJson: newResultJson,
                    version: nextVersion, // Auto-increment version
                    title: currentAnalysis.title || `Version ${nextVersion}`,
                    rootId: rootId,
                    parentId: currentAnalysis.id, // Parent is the one we edited
                    projectId: currentAnalysis.projectId,
                    metadata: {
                        trigger: 'edit',
                        source: 'user',
                        promptSettings: currentAnalysis.metadata?.promptSettings || {} // Inherit settings
                    }
                }
            });
        });

        res.json({
            ...newAnalysis.resultJson,
            id: newAnalysis.id,
            title: newAnalysis.title,
            version: newAnalysis.version,
            createdAt: newAnalysis.createdAt,
            generatedCode: newAnalysis.generatedCode,
            rootId: newAnalysis.rootId,
            parentId: newAnalysis.parentId
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
