import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * Erasure was not merely unimplemented — it was structurally impossible. `User → Analysis`
 * and `KnowledgeChunk → Analysis` are both ON DELETE RESTRICT, so `prisma.user.delete()`
 * fails outright for anyone who has ever finalized an analysis: the exact users with the
 * most data to erase. The ordering below is the fix, so it is what these tests pin.
 */

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserUpdateMany = jest.fn();
const mockUserFindMany = jest.fn();
const mockUserDelete = jest.fn();
const mockSessionDeleteMany = jest.fn();
const mockAnalysisFindMany = jest.fn();
const mockAnalysisDeleteMany = jest.fn();
const mockProjectDeleteMany = jest.fn();
const mockChunkDeleteMany = jest.fn();

// Records the order operations were issued in, which is the property under test.
const callOrder = [];
const track = (name, fn) => (...args) => { callOrder.push(name); return fn(...args); };

const tx = {
    analysis: {
        findMany: track('analysis.findMany', mockAnalysisFindMany),
        deleteMany: track('analysis.deleteMany', mockAnalysisDeleteMany)
    },
    knowledgeChunk: { deleteMany: track('chunk.deleteMany', mockChunkDeleteMany) },
    project: { deleteMany: track('project.deleteMany', mockProjectDeleteMany) },
    user: { delete: track('user.delete', mockUserDelete) }
};

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        user: {
            findUnique: mockUserFindUnique,
            update: mockUserUpdate,
            updateMany: mockUserUpdateMany,
            findMany: mockUserFindMany,
            delete: mockUserDelete
        },
        session: { deleteMany: mockSessionDeleteMany },
        // requestAccountDeletion passes an array of promises; hardDeleteUser passes a callback.
        $transaction: jest.fn((arg) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg)))
    }
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    REDACTED_PATHS: []
}));

const USER_ID = 'user-1';

beforeEach(() => {
    jest.clearAllMocks();
    callOrder.length = 0;
    mockAnalysisFindMany.mockResolvedValue([]);
    mockChunkDeleteMany.mockResolvedValue({ count: 0 });
    mockAnalysisDeleteMany.mockResolvedValue({ count: 0 });
    mockProjectDeleteMany.mockResolvedValue({ count: 0 });
});

describe('requestAccountDeletion', () => {
    it('ends every session at once, so the account is unusable before the data is gone', async () => {
        const { requestAccountDeletion } = await import('../../src/services/auth/accountDeletionService.js');
        mockUserFindUnique.mockResolvedValue({ id: USER_ID, deletedAt: null });

        const result = await requestAccountDeletion(USER_ID);

        expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
        expect(mockUserUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: USER_ID }, data: { deletedAt: expect.any(Date) } })
        );
        expect(result.graceDays).toBe(30);
    });

    it('refuses a second request rather than silently restarting the clock', async () => {
        const { requestAccountDeletion } = await import('../../src/services/auth/accountDeletionService.js');
        mockUserFindUnique.mockResolvedValue({ id: USER_ID, deletedAt: new Date() });

        await expect(requestAccountDeletion(USER_ID)).rejects.toMatchObject({ statusCode: 409 });
    });
});

describe('hardDeleteUser respects the FK ordering that made deletion impossible', () => {
    it('deletes knowledge chunks before the analyses they reference', async () => {
        const { hardDeleteUser } = await import('../../src/services/auth/accountDeletionService.js');
        mockAnalysisFindMany.mockResolvedValue([{ id: 'an-1' }]);
        mockChunkDeleteMany.mockResolvedValue({ count: 3 });
        mockAnalysisDeleteMany.mockResolvedValue({ count: 1 });

        await hardDeleteUser(USER_ID);

        // KnowledgeChunk.sourceAnalysisId is RESTRICT: the reverse order is a FK violation,
        // which is precisely how account deletion failed before.
        expect(callOrder.indexOf('chunk.deleteMany')).toBeLessThan(callOrder.indexOf('analysis.deleteMany'));
        // Analysis.userId is RESTRICT too, so the user row goes last of all.
        expect(callOrder.indexOf('analysis.deleteMany')).toBeLessThan(callOrder.indexOf('user.delete'));
    });

    it('scopes the chunk delete to the departing user\'s own analyses', async () => {
        const { hardDeleteUser } = await import('../../src/services/auth/accountDeletionService.js');
        mockAnalysisFindMany.mockResolvedValue([{ id: 'an-1' }, { id: 'an-2' }]);

        await hardDeleteUser(USER_ID);

        expect(mockChunkDeleteMany).toHaveBeenCalledWith({
            where: { sourceAnalysisId: { in: ['an-1', 'an-2'] } }
        });
    });

    it('skips the chunk delete entirely when there are no analyses', async () => {
        const { hardDeleteUser } = await import('../../src/services/auth/accountDeletionService.js');

        await hardDeleteUser(USER_ID);

        expect(mockChunkDeleteMany).not.toHaveBeenCalled();
        expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: USER_ID } });
    });
});

describe('purgeExpiredDeletions', () => {
    it('only purges accounts past the grace window', async () => {
        const { purgeExpiredDeletions, DELETION_GRACE_DAYS } = await import('../../src/services/auth/accountDeletionService.js');
        mockUserFindMany.mockResolvedValue([]);

        await purgeExpiredDeletions();

        const where = mockUserFindMany.mock.calls[0][0].where;
        expect(where.deletedAt.not).toBeNull();

        const cutoff = where.deletedAt.lte;
        const expected = Date.now() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;
        expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(5000);
    });

    it('carries on after one account fails, and reports the shortfall honestly', async () => {
        const { purgeExpiredDeletions } = await import('../../src/services/auth/accountDeletionService.js');
        mockUserFindMany.mockResolvedValue([{ id: 'bad' }, { id: 'good' }]);

        // First purge throws; the second must still run. A sweep that aborts on the first
        // failure silently stops erasing everyone behind it in the queue.
        mockAnalysisFindMany
            .mockRejectedValueOnce(new Error('FK violation'))
            .mockResolvedValue([]);

        const result = await purgeExpiredDeletions();

        expect(result).toEqual({ due: 2, purged: 1 });
    });
});
