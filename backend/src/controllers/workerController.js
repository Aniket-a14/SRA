import { performAnalysis } from '../services/analysisService.js';
import { log } from '../middleware/logger.js';


import prisma from '../config/prisma.js';

export const processJob = async (req, res, next) => {
    try {
        // QStash payload is in req.body
        const { userId, text, projectId, settings, parentId, rootId, analysisId } = req.body;

        log.info({ msg: "Worker received job", projectId, userId, analysisId });

        if (!userId || !text) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Set Status to IN_PROGRESS
        if (analysisId) {
            await prisma.analysis.update({
                where: { id: analysisId },
                data: { status: 'IN_PROGRESS' }
            });
        }

        // Execute Logic
        const result = await performAnalysis(userId, text, projectId, parentId, rootId, settings, analysisId);

        log.info({ msg: "Worker finished job", projectId });

        return res.status(200).json({ success: true, result });
    } catch (error) {
        log.error({ msg: "Worker failed", error: error.message });

        // BUG-007 FIX: Ensure analysis status is set to FAILED on any worker error.
        // This prevents records from being permanently stuck at IN_PROGRESS.
        const { analysisId } = req.body;
        if (analysisId) {
            try {
                await prisma.analysis.update({
                    where: { id: analysisId },
                    data: {
                        status: 'FAILED',
                        metadata: {
                            failureReason: error.message,
                            userFriendlyError: error.message.includes('429') || error.message.includes('Quota')
                                ? 'AI service rate limit reached. Please try again in a few minutes.'
                                : `Analysis failed: ${error.message}`
                        }
                    }
                });
            } catch (updateErr) {
                log.error({ msg: "Worker failed to update analysis status to FAILED", error: updateErr.message });
            }
        }

        next(error);
    }
};
