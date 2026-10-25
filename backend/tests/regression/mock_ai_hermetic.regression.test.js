import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { drainBlockedRequests } from '../setup/blockNetwork.js';

/**
 * MOCK_AI must never reach a provider.
 *
 * BaseAgent.countTokens had no MOCK_AI guard. performAnalysis calls it on every run, the
 * Gemini adapter falls back to the platform client when no key is passed, and the "mocked"
 * suite sent a real countTokens request to generativelanguage.googleapis.com with whatever
 * key backend/.env held. countTokens swallows the error and returns 0, so nothing failed.
 */
describe('MOCK_AI is hermetic', () => {
    const saved = {};
    beforeEach(() => {
        for (const k of ['MOCK_AI', 'GEMINI_API_KEY', 'GEMINI_MODEL_NAME']) saved[k] = process.env[k];
        // The leak's exact conditions: a key and a model are configured, as in a dev .env.
        process.env.MOCK_AI = 'true';
        process.env.GEMINI_API_KEY = 'test-key-not-real';
        process.env.GEMINI_MODEL_NAME = 'gemini-test-model';
    });
    afterEach(() => {
        for (const [k, v] of Object.entries(saved)) {
            if (v === undefined) delete process.env[k]; else process.env[k] = v;
        }
    });

    it('countTokens returns a local estimate without building a provider adapter', async () => {
        const { BaseAgent } = await import('../../src/agents/BaseAgent.js');
        const agent = new BaseAgent('Test Agent', { provider: 'GEMINI' });
        const getAdapter = jest.spyOn(agent, 'getAdapter');

        await expect(agent.countTokens('x'.repeat(400))).resolves.toBe(100);
        await expect(agent.countTokens('')).resolves.toBe(0);
        await expect(agent.countTokens(undefined)).resolves.toBe(0);
        expect(getAdapter).not.toHaveBeenCalled();
    });

    it('holds for every provider, not only Gemini', async () => {
        const { BaseAgent } = await import('../../src/agents/BaseAgent.js');
        for (const provider of ['GEMINI', 'OPENAI', 'CLAUDE', 'GROK']) {
            const agent = new BaseAgent('Test Agent', { provider, apiKey: 'k' });
            const getAdapter = jest.spyOn(agent, 'getAdapter');
            await agent.countTokens('abcd');
            expect(getAdapter).not.toHaveBeenCalled();
        }
    });
});

describe('network guard (tests/setup/blockNetwork.js)', () => {
    it('blocks and records requests to external hosts', async () => {
        await expect(fetch('https://generativelanguage.googleapis.com/v1beta/models'))
            .rejects.toThrow(/Network access is blocked in unit tests/);
        expect(drainBlockedRequests()).toEqual(['https://generativelanguage.googleapis.com/v1beta/models']);
    });

    it('records a blocked request even when the caller swallows the error', async () => {
        await fetch(new URL('https://api.openai.com/v1/models')).catch(() => {});
        expect(drainBlockedRequests()).toEqual(['https://api.openai.com/v1/models']);
    });

    it('does not block localhost', async () => {
        // Nothing listens on port 9 (discard); the point is the error is a connection
        // error from real fetch, not the guard's.
        const err = await fetch('http://127.0.0.1:9/').catch((e) => e);
        expect(String(err?.message)).not.toMatch(/blocked in unit tests/);
        expect(drainBlockedRequests()).toEqual([]);
    });
});
