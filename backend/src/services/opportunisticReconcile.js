import { getRedisClient } from '../config/redis.js';
import logger from '../config/logger.js';
import { runReconciliation } from './reconciliationService.js';

// Serverless has no long-lived process, so in production the sweep runs only if a QStash schedule
// calls /api/worker/reconcile. Riding on a request the user made anyway removes that dependency.
export const RECONCILE_LOCK_KEY = 'reconcile:opportunistic';

// One sweep per window across every replica, well under the 30-minute staleness threshold.
export const RECONCILE_INTERVAL_S = 15 * 60;

/**
 * Runs the reconciliation sweep at most once per RECONCILE_INTERVAL_S, cluster-wide.
 * Returns true only if this caller held the lock and completed a sweep.
 */
export const maybeReconcile = async () => {
    const redis = getRedisClient();
    // Without Redis there is no throttle, and an unthrottled sweep on a request path is worse than none.
    if (!redis) return false;

    let acquired;
    try {
        acquired = await redis.set(RECONCILE_LOCK_KEY, Date.now().toString(), 'EX', RECONCILE_INTERVAL_S, 'NX');
    } catch (err) {
        logger.warn({ msg: '[Reconciliation] Could not take the opportunistic lock', error: err.message });
        return false;
    }
    if (acquired !== 'OK') return false;

    try {
        const result = await runReconciliation();
        logger.info({ msg: '[Reconciliation] Opportunistic sweep complete', ...result });
        return true;
    } catch (err) {
        logger.error({ msg: '[Reconciliation] Opportunistic sweep failed', error: err.message });
        return false;
    }
};

/** Detached form: the caller's response must never wait on, or fail because of, the sweep. */
export const triggerReconcileInBackground = () => {
    maybeReconcile().catch((err) => {
        logger.error({ msg: '[Reconciliation] Background sweep rejected', error: err.message });
    });
};
