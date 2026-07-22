import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockUpdateMany = jest.fn();
const mockDeleteMany = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        analysis: {
            updateMany: mockUpdateMany,
            deleteMany: mockDeleteMany
        }
    }
}));

const {
    reconcileStaleInProgress,
    pruneOrphanedDrafts,
    runReconciliation,
    STALE_IN_PROGRESS_THRESHOLD_MS,
    DRAFT_TTL_MS
} = await import('../../src/services/reconciliationService.js');

describe('reconciliationService', () => {
    beforeEach(() => {
        mockUpdateMany.mockReset();
        mockDeleteMany.mockReset();
    });

    describe('reconcileStaleInProgress', () => {
        it('force-fails IN_PROGRESS rows older than the stale threshold', async () => {
            mockUpdateMany.mockResolvedValue({ count: 2 });

            const count = await reconcileStaleInProgress();

            expect(count).toBe(2);
            const call = mockUpdateMany.mock.calls[0][0];
            expect(call.where.status).toBe('IN_PROGRESS');
            expect(call.where.updatedAt.lt).toBeInstanceOf(Date);
            // Threshold should be roughly "now - 30min", not some arbitrary cutoff
            const deltaMs = Date.now() - call.where.updatedAt.lt.getTime();
            expect(deltaMs).toBeGreaterThanOrEqual(STALE_IN_PROGRESS_THRESHOLD_MS - 1000);
            expect(deltaMs).toBeLessThan(STALE_IN_PROGRESS_THRESHOLD_MS + 5000);
            expect(call.data).toEqual({ status: 'FAILED', resultQuality: 'NONE' });
        });

        it('is a no-op when nothing is stale', async () => {
            mockUpdateMany.mockResolvedValue({ count: 0 });
            expect(await reconcileStaleInProgress()).toBe(0);
        });
    });

    describe('pruneOrphanedDrafts', () => {
        it('deletes DRAFT rows older than the 24h TTL', async () => {
            mockDeleteMany.mockResolvedValue({ count: 3 });

            const count = await pruneOrphanedDrafts();

            expect(count).toBe(3);
            const call = mockDeleteMany.mock.calls[0][0];
            expect(call.where.status).toBe('DRAFT');
            const deltaMs = Date.now() - call.where.createdAt.lt.getTime();
            expect(deltaMs).toBeGreaterThanOrEqual(DRAFT_TTL_MS - 1000);
            expect(deltaMs).toBeLessThan(DRAFT_TTL_MS + 5000);
        });
    });

    describe('runReconciliation', () => {
        it('runs both sweeps and reports a combined summary', async () => {
            mockUpdateMany.mockResolvedValue({ count: 1 });
            mockDeleteMany.mockResolvedValue({ count: 4 });

            const summary = await runReconciliation();

            expect(summary).toEqual({ failedCount: 1, prunedCount: 4 });
            expect(mockUpdateMany).toHaveBeenCalledTimes(1);
            expect(mockDeleteMany).toHaveBeenCalledTimes(1);
        });
    });
});
