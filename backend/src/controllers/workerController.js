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

        // Security + Idempotency: Atomically verify ownership and transition PENDING → IN_PROGRESS.
        // If count === 0, either the record doesn't exist, userId doesn't match, or it's already past PENDING (QStash retry).
        if (analysisId) {
            const { count } = await prisma.analysis.updateMany({
                where: { id: analysisId, userId, status: 'PENDING' },
                data: { status: 'IN_PROGRESS' }
            });

            if (count === 0) {
                // Check if it's a duplicate delivery (already processing/completed) vs a real error
                const existing = await prisma.analysis.findUnique({
                    where: { id: analysisId },
                    select: { status: true, userId: true }
                });

                if (!existing) {
                    return res.status(404).json({ error: "Analysis record not found" });
                }
                if (existing.userId !== userId) {
                    log.warn({ msg: "Worker payload userId mismatch", payloadUserId: userId, recordUserId: existing.userId, analysisId });
                    return res.status(403).json({ error: "userId mismatch with analysis record" });
                }
                // Already IN_PROGRESS or COMPLETED — idempotent skip for QStash retries
                log.info({ msg: "Duplicate delivery skipped", analysisId, currentStatus: existing.status });
                return res.status(200).json({ success: true, skipped: true, reason: `Already ${existing.status}` });
            }
        }

        // Execute Logic
        const result = await performAnalysis(userId, text, projectId, parentId, rootId, settings, analysisId);

        log.info({ msg: "Worker finished job", projectId });

        return res.status(200).json({ success: true, result });
    } catch (error) {
        log.error({ msg: "Worker failed", error: error.message });
        next(error);
    }
};
