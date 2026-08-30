import prisma from '../config/prisma.js';
import logger from '../config/logger.js';
import { purgeExpiredDeletions } from './auth/accountDeletionService.js';

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

/** Force-transitions PENDING/IN_PROGRESS rows stuck past the worker's realistic worst-case runtime to FAILED. */
export const reconcileStaleInProgress = async () => {
    const staleBefore = new Date(Date.now() - STALE_IN_PROGRESS_THRESHOLD_MS);

    const { count } = await prisma.analysis.updateMany({
        where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
            updatedAt: { lt: staleBefore }
        },
        data: {
            status: 'FAILED',
            resultQuality: 'NONE'
        }
    });

    if (count > 0) {
        logger.warn({ msg: '[Reconciliation] Force-failed stale active analyses', count, staleBefore });
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

// How long audit records are kept. Long enough to investigate an incident nobody noticed
// at the time, short enough that the trail does not itself become an unbounded store of
// personal data — an audit log retained forever is its own GDPR problem, since it holds IP
// addresses and user agents.
export const AUDIT_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Drops audit records past the retention window. */
export const pruneAuditLog = async () => {
    const cutoff = new Date(Date.now() - AUDIT_LOG_RETENTION_MS);

    const { count } = await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } }
    });

    if (count > 0) {
        logger.info({ msg: '[Reconciliation] Pruned expired audit records', count, cutoff });
    }
    return count;
};

export const runReconciliation = async () => {
    // Sequential rather than parallel for the deletion purge: it runs multi-statement
    // transactions across most tables in the schema, and racing it against the other sweeps
    // buys nothing on a job that runs every 15 minutes.
    const [failedCount, prunedCount] = await Promise.all([
        reconcileStaleInProgress(),
        pruneOrphanedDrafts()
    ]);

    const auditPruned = await pruneAuditLog();
    const { due: deletionsDue, purged: accountsPurged } = await purgeExpiredDeletions();

    return { failedCount, prunedCount, auditPruned, deletionsDue, accountsPurged };
};
