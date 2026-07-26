import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The reuse corpus is one user's own library, not a shared one.
 *
 * All three retrieval paths searched `KnowledgeChunk`/`Analysis` across every account.
 * `retrieveContext` is the one that mattered most: it runs on every analysis, returns the
 * requirement text plus `source_title` (the owning project's *name*), and feeds both into
 * the Architect and Developer prompts — so one customer's finalized specification could be
 * reproduced, attributed, into a document generated for another. No attacker involved; it
 * was the feature working as written.
 *
 * These assert on the SQL actually handed to Prisma, because the filter is the fix. A test
 * that only checked returned rows would pass against a query with no WHERE clause at all,
 * since the mock decides what comes back.
 */

const mockQueryRaw = jest.fn().mockResolvedValue([]);

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: { $queryRaw: mockQueryRaw }
}));

jest.unstable_mockModule('../../src/services/knowledge/embeddingService.js', () => ({
    embedText: jest.fn().mockResolvedValue(new Array(768).fill(0.1))
}));

jest.unstable_mockModule('../../src/services/knowledge/graphService.js', () => ({
    traverseGraph: jest.fn().mockResolvedValue('')
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    REDACTED_PATHS: []
}));

const USER_ID = 'user-owner';

/**
 * Prisma tagged-template calls arrive as (stringsArray, ...values). The user id must appear
 * as a bound *value*, which also confirms it is parameterised rather than interpolated.
 */
const lastQuery = () => {
    const call = mockQueryRaw.mock.calls.at(-1);
    return { sql: call[0].join('?'), values: call.slice(1) };
};

beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRaw.mockResolvedValue([]);
    // MOCK_AI short-circuits retrieveContext before it reaches SQL.
    delete process.env.MOCK_AI;
});

describe('retrieveContext', () => {
    it('constrains the search to the requesting user, as a bound parameter', async () => {
        const { retrieveContext } = await import('../../src/services/knowledge/ragService.js');

        await retrieveContext('payment gateway', { userId: USER_ID, projectId: null, limit: 5 });

        const { sql, values } = lastQuery();
        expect(sql).toMatch(/a\."userId"\s*=/);
        expect(values).toContain(USER_ID);
    });

    it('throws rather than searching every account when no user is given', async () => {
        const { retrieveContext } = await import('../../src/services/knowledge/ragService.js');

        await expect(retrieveContext('payment gateway', {})).rejects.toThrow(/userId/);
        expect(mockQueryRaw).not.toHaveBeenCalled();
    });

    it('rejects the old positional signature instead of silently mis-scoping', async () => {
        const { retrieveContext } = await import('../../src/services/knowledge/ragService.js');

        // Was `retrieveContext(query, projectId, limit)`. A call site left un-migrated
        // passes a projectId string where the options object belongs — it must fail, not
        // quietly run unscoped.
        await expect(retrieveContext('query', 'some-project-id')).rejects.toThrow(/userId/);
        expect(mockQueryRaw).not.toHaveBeenCalled();
    });
});

describe('searchGoldStandardFragments', () => {
    it('joins through Analysis to constrain suggestions to the caller', async () => {
        const { searchGoldStandardFragments } = await import('../../src/services/knowledge/ragService.js');

        await searchGoldStandardFragments('login flow', null, USER_ID);

        const { sql, values } = lastQuery();
        expect(sql).toMatch(/JOIN "Analysis"/);
        expect(sql).toMatch(/a\."userId"\s*=/);
        expect(values).toContain(USER_ID);
    });

    it('throws without a caller', async () => {
        const { searchGoldStandardFragments } = await import('../../src/services/knowledge/ragService.js');

        await expect(searchGoldStandardFragments('login flow', null)).rejects.toThrow(/userId/);
        expect(mockQueryRaw).not.toHaveBeenCalled();
    });
});

describe('findReuseCandidate', () => {
    it('only ever matches the caller\'s own finalized analyses', async () => {
        const { findReuseCandidate } = await import('../../src/services/knowledge/reuseService.js');

        await findReuseCandidate('a booking system', USER_ID);

        const { sql, values } = lastQuery();
        expect(sql).toMatch(/"userId"\s*=/);
        expect(values).toContain(USER_ID);
    });

    it('throws without a caller', async () => {
        const { findReuseCandidate } = await import('../../src/services/knowledge/reuseService.js');

        await expect(findReuseCandidate('a booking system')).rejects.toThrow(/userId/);
    });
});
