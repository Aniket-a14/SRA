import { describe, it, expect, afterEach } from '@jest/globals';
import { BaseAgent } from '../../src/agents/BaseAgent.js';

// Production log, 2026-07-25: a free-tier daily cap was retried 3x at 2s and 4s intervals
// against a quota that resets daily. Every attempt was guaranteed to fail, and the wasted
// ~29s came out of a serverless function budget the pipeline already overruns.
const DAILY_429 = `[GoogleGenerativeAI Error]: [429 Too Many Requests] You exceeded your current quota.
* Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, model: gemini-3.5-flash
Please retry in 38.04s. [{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier","quotaValue":"20"}]`;

const PER_MINUTE_429 = `[GoogleGenerativeAI Error]: [429 Too Many Requests] Quota exceeded.
Please retry in 4.1s. [{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier","quotaValue":"15"}]`;

function agentWithFailure(message, { failures = Infinity } = {}) {
    const agent = new BaseAgent('Test Agent', { provider: 'gemini', modelName: 'gemini-3.5-flash' });
    const state = { calls: 0 };

    agent.getAdapter = () => ({
        generateContent: async () => {
            state.calls++;
            if (state.calls > failures) return 'recovered';
            throw new Error(message);
        },
        classifyError: () => ({ isRateLimit: true, isServerError: false, isAuthError: false })
    });

    return { agent, state };
}

describe('BaseAgent.callLLM — quota handling', () => {
    const originalMockAi = process.env.MOCK_AI;

    afterEach(() => {
        process.env.MOCK_AI = originalMockAi;
    });

    it('stops after a single attempt when the daily quota is exhausted', async () => {
        process.env.MOCK_AI = 'false';
        const { agent, state } = agentWithFailure(DAILY_429);

        await expect(agent.callLLM('prompt', 0.2, false, null, 3)).rejects.toThrow(/Daily AI quota exhausted/);

        // The whole point: one call, not the three the old backoff would have made.
        expect(state.calls).toBe(1);
    });

    it('surfaces the model and limit so the user knows what to change', async () => {
        process.env.MOCK_AI = 'false';
        const { agent } = agentWithFailure(DAILY_429);

        const error = await agent.callLLM('prompt', 0.2, false, null, 3).catch((e) => e);

        expect(error.quotaExhausted).toBe(true);
        expect(error.statusCode).toBe(429);
        expect(error.message).toMatch(/gemini-3\.5-flash/);
        expect(error.message).toMatch(/20 requests\/day/);
    });

    it('still retries an ordinary per-minute rate limit', async () => {
        process.env.MOCK_AI = 'false';
        // Fails once, then succeeds — proves the fail-fast path did not swallow the
        // transient case that backoff exists to handle.
        const { agent, state } = agentWithFailure(PER_MINUTE_429, { failures: 1 });

        const result = await agent.callLLM('prompt', 0.2, false, null, 3);

        expect(result).toBe('recovered');
        expect(state.calls).toBe(2);
    }, 20000);
});
