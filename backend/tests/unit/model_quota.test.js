import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockPrisma = {
    modelQuotaState: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn()
    }
};

jest.unstable_mockModule('../../src/config/prisma.js', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const {
    pacificDateString, nextPacificMidnight, recordUsage, recordExhausted, listQuotaStates, isModelExhausted,
    condenseProviderError
} = await import('../../src/services/providers/modelQuotaService.js');

beforeEach(() => jest.clearAllMocks());

describe('the usage day', () => {
    it('is a Pacific day, because that is when Gemini refills RPD', () => {
        // 07:00 UTC on the 27th is still 00:00 Pacific on the 27th (PDT, UTC-7) — the moment
        // the allowance resets. A UTC-based day would have rolled the counter seven hours
        // early and shown a fresh allowance the provider had not granted.
        expect(pacificDateString(new Date('2026-07-27T06:59:00Z'))).toBe('2026-07-26');
        expect(pacificDateString(new Date('2026-07-27T07:01:00Z'))).toBe('2026-07-27');
    });

    it('projects the next reset to the next midnight Pacific', () => {
        const reset = nextPacificMidnight(new Date('2026-07-26T20:00:00Z')); // 13:00 PDT
        expect(reset.toISOString()).toBe('2026-07-27T07:00:00.000Z');
    });
});

describe('recordUsage', () => {
    it('records provider headers as authoritative', async () => {
        mockPrisma.modelQuotaState.findUnique.mockResolvedValue(null);
        await recordUsage({
            userId: 'u1', provider: 'OPENAI', modelName: 'gpt-x',
            rateLimit: { requestLimit: 500, requestsRemaining: 499, tokensRemaining: 10000, resetsAt: new Date() }
        });

        const { create } = mockPrisma.modelQuotaState.upsert.mock.calls[0][0];
        expect(create.source).toBe('PROVIDER');
        expect(create.requestsRemaining).toBe(499);
    });

    it('falls back to counting when the provider reports nothing (Gemini)', async () => {
        mockPrisma.modelQuotaState.findUnique.mockResolvedValue(null);
        await recordUsage({ userId: 'u1', provider: 'GEMINI', modelName: 'gemini-x', rateLimit: null });

        const { create } = mockPrisma.modelQuotaState.upsert.mock.calls[0][0];
        expect(create.source).toBe('COUNTED');
        expect(create.requestsUsed).toBe(1);
    });

    it('restarts the counter when the Pacific day rolls over', async () => {
        mockPrisma.modelQuotaState.findUnique.mockResolvedValue({
            usageDate: '1999-01-01', requestsUsed: 19, source: 'COUNTED'
        });
        await recordUsage({ userId: 'u1', provider: 'GEMINI', modelName: 'gemini-x' });

        const { update } = mockPrisma.modelQuotaState.upsert.mock.calls[0][0];
        expect(update.requestsUsed).toBe(1);
    });

    it('increments within the same day', async () => {
        mockPrisma.modelQuotaState.findUnique.mockResolvedValue({
            usageDate: pacificDateString(), requestsUsed: 3, source: 'COUNTED'
        });
        await recordUsage({ userId: 'u1', provider: 'GEMINI', modelName: 'gemini-x' });

        const { update } = mockPrisma.modelQuotaState.upsert.mock.calls[0][0];
        expect(update.requestsUsed).toEqual({ increment: 1 });
    });

    it('clears a recorded exhaustion, since a call that succeeded proves it is over', async () => {
        mockPrisma.modelQuotaState.findUnique.mockResolvedValue({
            usageDate: pacificDateString(), requestsUsed: 1, source: 'COUNTED'
        });
        await recordUsage({ userId: 'u1', provider: 'GEMINI', modelName: 'gemini-x' });

        const { update } = mockPrisma.modelQuotaState.upsert.mock.calls[0][0];
        expect(update.exhaustedAt).toBeNull();
    });

    it('never lets a bookkeeping failure break the run it is observing', async () => {
        mockPrisma.modelQuotaState.findUnique.mockRejectedValue(new Error('db down'));
        await expect(recordUsage({ userId: 'u1', provider: 'GEMINI', modelName: 'm' })).resolves.toBeUndefined();
    });
});

describe('recordExhausted', () => {
    it('uses midnight Pacific for a daily cap, not the short retryDelay Gemini also sends', async () => {
        await recordExhausted({
            userId: 'u1', provider: 'GEMINI', modelName: 'gemini-x',
            limit: 20, retryAfterMs: 54000, perDay: true, message: 'quota exceeded'
        });

        const { create } = mockPrisma.modelQuotaState.upsert.mock.calls[0][0];
        // Far beyond the 54s the provider suggested for its per-minute bucket.
        expect(create.resetsAt.getTime() - Date.now()).toBeGreaterThan(60 * 60 * 1000);
        expect(create.requestLimit).toBe(20);
        expect(create.requestsRemaining).toBe(0);
    });

    it('honours retry-after for a per-minute limit', async () => {
        await recordExhausted({
            userId: 'u1', provider: 'OPENAI', modelName: 'gpt-x',
            retryAfterMs: 30000, perDay: false
        });
        const { create } = mockPrisma.modelQuotaState.upsert.mock.calls[0][0];
        expect(create.resetsAt.getTime() - Date.now()).toBeLessThan(60 * 1000);
    });
});

describe('listQuotaStates', () => {
    it('clears an exhaustion whose reset has passed', async () => {
        mockPrisma.modelQuotaState.findMany.mockResolvedValue([{
            provider: 'GEMINI', modelName: 'g', source: 'COUNTED',
            requestLimit: 20, requestsRemaining: 0, tokensRemaining: null,
            requestsUsed: 20, usageDate: pacificDateString(),
            exhaustedAt: new Date(Date.now() - 90000000), resetsAt: new Date(Date.now() - 1000),
            lastErrorText: 'spent'
        }]);

        const [row] = await listQuotaStates('u1');
        expect(row.isExhausted).toBe(false);
        expect(row.lastErrorText).toBeNull();
    });

    it('derives remaining for COUNTED rows and marks stale days as unused', async () => {
        mockPrisma.modelQuotaState.findMany.mockResolvedValue([{
            provider: 'GEMINI', modelName: 'g', source: 'COUNTED',
            requestLimit: 20, requestsRemaining: null, tokensRemaining: null,
            requestsUsed: 18, usageDate: '1999-01-01',
            exhaustedAt: null, resetsAt: null, lastErrorText: null
        }]);

        const [row] = await listQuotaStates('u1');
        expect(row.requestsUsed).toBe(0);
        expect(row.requestsRemaining).toBe(20);
    });

    it('reports zero remaining when exhausted, even though our own count says otherwise', async () => {
        // Caught live: the provider 429'd after a single call through this platform, because
        // the same key had been spent elsewhere. Deriving remaining from our own tally then
        // reported "19 of 20 left" on a model that could not serve a single request.
        mockPrisma.modelQuotaState.findMany.mockResolvedValue([{
            provider: 'GEMINI', modelName: 'gemini-3.5-flash', source: 'COUNTED',
            requestLimit: 20, requestsRemaining: 0, tokensRemaining: null,
            requestsUsed: 1, usageDate: pacificDateString(),
            exhaustedAt: new Date(), resetsAt: new Date(Date.now() + 3600000),
            lastErrorText: 'quota exceeded'
        }]);

        const [row] = await listQuotaStates('u1');
        expect(row.isExhausted).toBe(true);
        expect(row.requestsRemaining).toBe(0);
    });

    it('reports the provider figure verbatim for PROVIDER rows', async () => {
        mockPrisma.modelQuotaState.findMany.mockResolvedValue([{
            provider: 'CLAUDE', modelName: 'c', source: 'PROVIDER',
            requestLimit: 1000, requestsRemaining: 998, tokensRemaining: 50000,
            requestsUsed: 2, usageDate: pacificDateString(),
            exhaustedAt: null, resetsAt: null, lastErrorText: null
        }]);

        const [row] = await listQuotaStates('u1');
        expect(row.requestsRemaining).toBe(998);
        expect(row.tokensRemaining).toBe(50000);
    });
});

describe('isModelExhausted', () => {
    it('does not block a run when the bookkeeping table is unavailable', async () => {
        mockPrisma.modelQuotaState.findUnique.mockRejectedValue(new Error('db down'));
        await expect(isModelExhausted('u1', 'GEMINI', 'm')).resolves.toBe(false);
    });
});

describe('condenseProviderError', () => {
    it('strips the google.rpc detail array that makes the message unreadable', () => {
        // Captured live. Everything from `[{"@type"` on is machine payload; rendering it in
        // the UI produced a wall of JSON where a one-line reason belonged.
        const raw = '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent: '
            + '[429 Too Many Requests] You exceeded your current quota, please check your plan and billing details. '
            + 'For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. '
            + '* Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, model: gemini-3.5-flash '
            + 'Please retry in 39s. [{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaValue":"20"}]}]';

        const clean = condenseProviderError(raw);
        expect(clean).not.toContain('@type');
        expect(clean).not.toContain('generativelanguage.googleapis.com/v1beta');
        // The parts a person can act on survive.
        expect(clean).toContain('exceeded your current quota');
        expect(clean).toContain('limit: 20');
        expect(clean.length).toBeLessThanOrEqual(300);
    });

    it('leaves an already-short message alone, and handles nothing', () => {
        expect(condenseProviderError('Rate limit reached.')).toBe('Rate limit reached.');
        expect(condenseProviderError(null)).toBeNull();
    });
});
