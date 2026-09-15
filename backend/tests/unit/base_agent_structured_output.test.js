import { describe, it, expect, afterEach } from '@jest/globals';
import { SchemaType } from '@google/generative-ai';
import { BaseAgent } from '../../src/agents/BaseAgent.js';

/**
 * Gemini's `responseSchema` only constrains Gemini itself — OpenAI/Claude/Grok output was
 * previously only run through jsonRepair.js's syntactic (not shape) repair. This covers the
 * validation BaseAgent.callLLM now does against that same schema for every provider, and the
 * one-shot correction retry before it gives up.
 */

const TEST_SCHEMA = {
    type: SchemaType.OBJECT,
    properties: {
        title: { type: SchemaType.STRING },
        count: { type: SchemaType.NUMBER },
        tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    },
    required: ['title', 'count'],
};

function agentReturning(responses) {
    const agent = new BaseAgent('Test Agent', { provider: 'gemini', modelName: 'gemini-x', userId: 'u1' });
    const state = { calls: 0, prompts: [] };
    agent.getAdapter = () => ({
        generateContent: async (request) => {
            state.prompts.push(request.prompt);
            const response = responses[Math.min(state.calls, responses.length - 1)];
            state.calls++;
            return typeof response === 'function' ? response() : response;
        },
        classifyError: () => ({ isRateLimit: false, isServerError: false, isAuthError: false }),
    });
    return { agent, state };
}

describe('BaseAgent.callLLM — structured output validation', () => {
    const originalMockAi = process.env.MOCK_AI;

    afterEach(() => {
        process.env.MOCK_AI = originalMockAi;
    });

    it('returns validated data on the first response when it matches the schema', async () => {
        process.env.MOCK_AI = 'false';
        const { agent, state } = agentReturning([JSON.stringify({ title: 'Report', count: 3, tags: ['a', 'b'] })]);

        const result = await agent.callLLM('prompt', 0.2, true, TEST_SCHEMA, 3, 10);

        expect(result).toEqual({ title: 'Report', count: 3, tags: ['a', 'b'] });
        expect(state.calls).toBe(1);
    });

    it('retries once with a correction when a required field is missing, then succeeds', async () => {
        process.env.MOCK_AI = 'false';
        const { agent, state } = agentReturning([
            JSON.stringify({ title: 'Report' }), // missing required `count`
            JSON.stringify({ title: 'Report', count: 3 }),
        ]);

        const result = await agent.callLLM('original prompt', 0.2, true, TEST_SCHEMA, 3, 10);

        expect(result).toEqual({ title: 'Report', count: 3 });
        expect(state.calls).toBe(2);
        // The retry's prompt carries the original instruction plus what was wrong.
        expect(state.prompts[1]).toContain('original prompt');
        expect(state.prompts[1]).toContain('count');
        expect(state.prompts[1]).toContain('OUTPUT CORRECTION REQUIRED');
    });

    it('throws a structured, statusCode-bearing error when still invalid after the correction retry', async () => {
        process.env.MOCK_AI = 'false';
        const { agent, state } = agentReturning([
            JSON.stringify({ title: 'Report' }),
            JSON.stringify({ title: 'Report' }), // still missing `count`
        ]);

        const error = await agent.callLLM('prompt', 0.2, true, TEST_SCHEMA, 3, 10).catch((e) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error.statusCode).toBe(502);
        expect(error.code).toBe('AI_STRUCTURED_OUTPUT_INVALID');
        expect(error.message).toContain('count');
        // Exactly the correction retry — no network-level retries, no fallback attempts.
        expect(state.calls).toBe(2);
    });

    it('does not attempt a corrective retry against the network-error retry budget', async () => {
        process.env.MOCK_AI = 'false';
        // Both responses are invalid; the run must not consume the `retries` argument's
        // budget (which is for transient network failures) doing so.
        const { agent, state } = agentReturning([
            JSON.stringify({ notTitle: true }),
            JSON.stringify({ notTitle: true }),
        ]);

        await expect(agent.callLLM('prompt', 0.2, true, TEST_SCHEMA, /* retries */ 1, 10)).rejects.toMatchObject({
            code: 'AI_STRUCTURED_OUTPUT_INVALID',
        });
        expect(state.calls).toBe(2); // original + one correction retry, not gated by retries=1
    });

    it('skips validation entirely when no responseSchema is given (e.g. chat replies)', async () => {
        process.env.MOCK_AI = 'false';
        const { agent, state } = agentReturning([JSON.stringify({ anything: 'goes', no: ['schema', 'here'] })]);

        const result = await agent.callLLM('prompt', 0.2, true, null, 3, 10);

        expect(result).toEqual({ anything: 'goes', no: ['schema', 'here'] });
        expect(state.calls).toBe(1);
    });

    it('tolerates extra fields a provider adds beyond the schema (passthrough, not strict)', async () => {
        process.env.MOCK_AI = 'false';
        const { agent } = agentReturning([
            JSON.stringify({ title: 'Report', count: 1, extraFieldNoOneAskedFor: 'ok' }),
        ]);

        const result = await agent.callLLM('prompt', 0.2, true, TEST_SCHEMA, 3, 10);

        expect(result.extraFieldNoOneAskedFor).toBe('ok');
    });
});
