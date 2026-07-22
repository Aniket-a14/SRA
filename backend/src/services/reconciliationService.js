import prisma from '../config/prisma.js';
import logger from '../config/logger.js';

// BaseAgent's per-call timeout is 6 minutes, retried up to 3x with backoff, and a full
// pipeline run chains several such calls (ProductOwner -> Architect -> sectional
// Developer calls -> up to 2 reflection passes). 30 minutes is comfortably above any
// legitimate worst-case run — an IN_PROGRESS row older than that means the worker
// crashed or the process was killed mid-job, not that it's still working.
export const STALE_IN_PROGRESS_THRESHOLD_MS = 30 * 60 * 1000;

// A DRAFT row is only ever deleted by performAnalysis's success path when it's
// successfully converted into a real analysis (analysisService.js). One that's still
// DRAFT after 24h was abandoned by the user (or its conversion attempt failed before
// reaching that cleanup step) and is safe to prune.
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Force-transitions IN_PROGRESS rows stuck past the worker's realistic worst-case runtime to FAILED. */
export const reconcileStaleInProgress = async () => {
    const staleBefore = new Date(Date.now() - STALE_IN_PROGRESS_THRESHOLD_MS);

    const { count } = await prisma.analysis.updateMany({
        where: { status: 'IN_PROGRESS', updatedAt: { lt: staleBefore } },
        data: { status: 'FAILED', resultQuality: 'NONE' }
    });

    if (count > 0) {
        logger.warn({ msg: '[Reconciliation] Force-failed stale IN_PROGRESS analyses', count, staleBefore });
    }
    return count;
};

/** Deletes DRAFT rows that were never promoted to PENDING within the TTL window. */
export const pruneOrphanedDrafts = async () => {
    const staleBefore = new Date(Date.now() - DRAFT_TTL_MS);

    const { count } = await prisma.analysis.deleteMany({
        where: { status: 'DRAFT', createdAt: { lt: staleBefore } }
    });

    if (count > 0) {
        logger.info({ msg: '[Reconciliation] Pruned orphaned draft analyses', count, staleBefore });
    }
    return count;
};

export const runReconciliation = async () => {
    const [failedCount, prunedCount] = await Promise.all([
        reconcileStaleInProgress(),
        pruneOrphanedDrafts()
    ]);

    return { failedCount, prunedCount };
};
