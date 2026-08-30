import { jest } from '@jest/globals';

// The dashboard list is cached for an hour. Creation was the one mutation that never dropped
// that key, so a new run stayed invisible until the cache aged out. Asserting on the Redis
// DEL rather than on a return value, because the absent call *is* the bug.

const CACHE_KEY = (userId) => `user:analyses:v2:${userId}`;

const redisDel = jest.fn();
const analysisUpdate = jest.fn();

jest.unstable_mockModule('../../src/config/redis.js', () => ({
    getRedisClient: () => ({ del: redisDel })
}));

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        analysis: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: analysisUpdate
        },
        $transaction: jest.fn(async (fn) => fn({
            analysis: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn(async ({ data }) => data)
            }
        }))
    }
}));

jest.unstable_mockModule('../../src/services/versioning.js', () => ({
    createNextVersion: jest.fn(async (_tx, _rootId, build) => build(1))
}));

jest.unstable_mockModule('../../src/services/quotaService.js', () => ({
    assertWithinQuota: jest.fn()
}));

jest.unstable_mockModule('../../src/services/providers/providerKeyService.js', () => ({
    resolveProviderKey: jest.fn().mockResolvedValue({ provider: 'GEMINI', apiKey: 'k', modelName: 'm' })
}));

jest.unstable_mockModule('../../src/services/providers/modelQuotaService.js', () => ({
    isModelExhausted: jest.fn().mockResolvedValue(false)
}));

const publishJSON = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
jest.unstable_mockModule('@upstash/qstash', () => ({
    Client: class { constructor() { this.publishJSON = publishJSON; this.http = { baseUrl: 'https://qstash.upstash.io' }; } }
}));

// Read at module scope by queueService, so it has to exist before the import.
process.env.BACKEND_URL = 'https://backend.test';

const { addAnalysisJob } = await import('../../src/services/queueService.js');

describe('analyses list cache invalidation on create', () => {
    const USER = 'user-1';

    beforeEach(() => {
        jest.clearAllMocks();
        publishJSON.mockResolvedValue({ messageId: 'msg-1' });
        // Force the real dispatch path rather than the in-process mock queue.
        process.env.MOCK_QSTASH = 'false';
        process.env.NODE_ENV = 'production';
    });

    it('drops the cached list when a run is queued, so it appears while it runs', async () => {
        await addAnalysisJob(USER, 'build a file transfer portal', null, {});

        expect(redisDel).toHaveBeenCalledWith(CACHE_KEY(USER));
    });

    it('invalidates before dispatch, so a slow queue cannot delay the row appearing', async () => {
        let delCalledFirst = false;
        publishJSON.mockImplementation(async () => {
            delCalledFirst = redisDel.mock.calls.length > 0;
            return { messageId: 'msg-1' };
        });

        await addAnalysisJob(USER, 'build a file transfer portal', null, {});

        expect(delCalledFirst).toBe(true);
    });

    it('also drops the cache when dispatch fails and the row is marked FAILED', async () => {
        // The row flips to FAILED here; if the list stays cached the user sees no change at all.
        publishJSON.mockRejectedValue(new Error('QStash unreachable'));

        await expect(addAnalysisJob(USER, 'build a file transfer portal', null, {})).rejects.toThrow('QStash unreachable');

        expect(analysisUpdate).toHaveBeenCalled();
        expect(redisDel).toHaveBeenCalledWith(CACHE_KEY(USER));
    });
});
