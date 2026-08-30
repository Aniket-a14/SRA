import { performAnalysis } from '../services/analysisService.js';
import { runReconciliation } from '../services/reconciliationService.js';
import { enqueueContinuation } from '../services/queueService.js';
import { createStageBudget } from '../services/pipelineBudget.js';
import { log } from '../middleware/logger.js';


import prisma from '../config/prisma.js';

export const processJob = async (req, res, next) => {
    try {
        // QStash payload is in req.body
        const { userId, text, projectId, settings, parentId, rootId, analysisId, continuation } = req.body;

        log.info({ msg: "Worker received job", projectId, userId, analysisId, continuation: !!continuation });

        if (!userId || !text) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Security + Idempotency: Atomically verify ownership and transition PENDING → IN_PROGRESS.
        // If count === 0, either the record doesn't exist, userId doesn't match, or it's already past PENDING (QStash retry).
        //
        // A continuation is the pipeline handing itself to a new invocation after running
        // out of function time, so the row is legitimately already IN_PROGRESS. It must be
        // matched on IN_PROGRESS instead — the PENDING-only guard would otherwise classify
        // the run's own continuation as a duplicate delivery and silently abandon it.
        if (analysisId) {
            const { count } = continuation
                ? await prisma.analysis.updateMany({
                    where: { id: analysisId, userId, status: 'IN_PROGRESS' },
                    data: { status: 'IN_PROGRESS' }
                })
                : await prisma.analysis.updateMany({
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

        // Execute Logic. The budget makes the pipeline yield at a stage boundary rather
        // than be killed mid-stage by the platform's function timeout.
        const budget = createStageBudget();

        try {
            const result = await performAnalysis(userId, text, projectId, parentId, rootId, settings, analysisId, { budget });
            log.info({ msg: "Worker finished job", projectId });
            return res.status(200).json({ success: true, result });
        } catch (error) {
            if (!error?.paused) throw error;

            // Out of time with work left. The checkpoint is already durable, so hand the
            // rest to a new invocation and report success — QStash must not treat this as
            // a failed delivery and retry the whole payload on its own terms.
            await enqueueContinuation({ analysisId, userId, text, projectId, settings, parentId, rootId }, error.stage);

            log.info({ msg: "Worker yielded to continuation", analysisId, stage: error.stage });
            return res.status(200).json({ success: true, continued: true, stage: error.stage });
        }
    } catch (error) {
        log.error({ msg: "Worker failed", error: error.message });
        next(error);
    }
};

export const reconcileJobs = async (req, res, next) => {
    try {
        const summary = await runReconciliation();
        log.info({ msg: "Reconciliation sweep complete", ...summary });
        return res.status(200).json({ success: true, ...summary });
    } catch (error) {
        log.error({ msg: "Reconciliation sweep failed", error: error.message });
        next(error);
    }
};

export const handleDeadLetterJob = async (req, res) => {
    try {
        const { analysisId, userId } = req.body || {};
        log.error({ msg: "[QStash DLQ] Job retries permanently exhausted", analysisId, userId, payload: req.body });

        if (analysisId) {
            await prisma.analysis.updateMany({
                where: { id: analysisId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
                data: {
                    status: 'FAILED',
                    metadata: {
                        failureReason: 'Background analysis job exceeded maximum retry attempts. Please retry your request.',
                        dlqTimestamp: new Date().toISOString()
                    }
                }
            });
        }

        return res.status(200).json({ success: true, dlqRecorded: true });
    } catch (err) {
        log.error({ msg: "[QStash DLQ] Error processing dead letter webhook", error: err.message });
        return res.status(200).json({ success: false, error: err.message });
    }
};
