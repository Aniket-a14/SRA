import { jest } from '@jest/globals';

// In production nothing runs the reconciliation sweep unless a QStash schedule exists, so a run
// whose worker crashed stays IN_PROGRESS forever. These assert on the lock arguments rather than
// on a return value: an unthrottled sweep on a request path is the failure mode to prevent.

const redisSet = jest.fn();
let redisAvailable = true;

jest.unstable_mockModule('../../src/config/redis.js', () => ({
    getRedisClient: () => (redisAvailable ? { set: redisSet } : null)
}));

const runReconciliation = jest.fn();
jest.unstable_mockModule('../../src/services/reconciliationService.js', () => ({ runReconciliation }));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const { maybeReconcile, triggerReconcileInBackground, RECONCILE_LOCK_KEY, RECONCILE_INTERVAL_S } =
    await import('../../src/services/opportunisticReconcile.js');

describe('opportunistic reconciliation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        redisAvailable = true;
        redisSet.mockResolvedValue('OK');
        runReconciliation.mockResolvedValue({ failedCount: 1, prunedCount: 0, auditPruned: 0, deletionsDue: 0, accountsPurged: 0 });
    });

    it('sweeps once it takes the lock, so a stuck run is rescued without a schedule', async () => {
        await expect(maybeReconcile()).resolves.toBe(true);

        expect(redisSet).toHaveBeenCalledWith(
            RECONCILE_LOCK_KEY, expect.any(String), 'EX', RECONCILE_INTERVAL_S, 'NX'
        );
        expect(runReconciliation).toHaveBeenCalledTimes(1);
    });

    it('does nothing while another replica holds the lock', async () => {
        redisSet.mockResolvedValue(null);

        await expect(maybeReconcile()).resolves.toBe(false);
        expect(runReconciliation).not.toHaveBeenCalled();
    });

    it('stays throttled below the staleness threshold, so it cannot run per request', () => {
        // 15 minutes, comfortably under reconciliationService's 30-minute IN_PROGRESS threshold:
        // long enough not to sweep on every request, short enough to catch a run as it goes stale.
        expect(RECONCILE_INTERVAL_S).toBeLessThan(30 * 60);
        expect(RECONCILE_INTERVAL_S).toBeGreaterThanOrEqual(5 * 60);
    });

    it('declines to sweep at all when Redis is unavailable', async () => {
        // Without Redis there is no throttle, and an unthrottled sweep on a request path is worse
        // than none at all.
        redisAvailable = false;

        await expect(maybeReconcile()).resolves.toBe(false);
        expect(runReconciliation).not.toHaveBeenCalled();
    });

    it('never rejects into the caller when the sweep fails', async () => {
        runReconciliation.mockRejectedValue(new Error('database unreachable'));

        expect(() => triggerReconcileInBackground()).not.toThrow();
        await expect(maybeReconcile()).resolves.toBe(false);
    });

    it('never rejects into the caller when Redis itself errors', async () => {
        redisSet.mockRejectedValue(new Error('connection reset'));

        await expect(maybeReconcile()).resolves.toBe(false);
        expect(runReconciliation).not.toHaveBeenCalled();
    });
});
