import { describe, it, expect, jest, afterEach } from '@jest/globals';

const mockSelectNextFallbackModel = jest.fn();

jest.unstable_mockModule('../../src/services/providers/modelFallbackService.js', () => ({
    selectNextFallbackModel: mockSelectNextFallbackModel
}));

const { BaseAgent } = await import('../../src/agents/BaseAgent.js');

const SERVER_ERROR = new Error('[503 Service Unavailable] The model is overloaded. Please try again later.');
const AUTH_ERROR = new Error('[401 Unauthorized] Invalid API key');

function agentWithFailure(error, classification, { failures = Infinity, providerConfig = {} } = {}) {
    const agent = new BaseAgent('Test Agent', {
        provider: 'gemini',
        modelName: 'gemini-3.5-flash',
        apiKey: 'gemini-key',
        userId: 'u1',
        allowModelFallback: true,
        fallbackModels: [{ modelProvider: 'CLAUDE', modelName: 'claude-backup' }],
        ...providerConfig
    });
    const state = { calls: 0, adapters: [] };

    const makeAdapter = (label) => ({
        generateContent: async () => {
            state.calls++;
            state.adapters.push(label);
            if (state.calls > failures) return 'recovered';
            throw error;
        },
        classifyError: () => classification
    });

    // getAdapter is overridden rather than the private _adapter field, matching how
    // BaseAgent itself resolves the adapter fresh each retry loop iteration.
    agent.getAdapter = () => makeAdapter(`${agent.provider}:${agent.modelName}`);

    return { agent, state };
}

describe('BaseAgent.callLLM — provider fallback', () => {
    const originalMockAi = process.env.MOCK_AI;

    afterEach(() => {
        process.env.MOCK_AI = originalMockAi;
        mockSelectNextFallbackModel.mockReset();
    });

    it('falls back to the next approved provider on the first overload, without exhausting same-provider retries', async () => {
        process.env.MOCK_AI = 'false';
        mockSelectNextFallbackModel.mockResolvedValueOnce({
            provider: 'CLAUDE', modelName: 'claude-backup', apiKey: 'claude-key',
            inputTokenLimit: 2000, outputTokenLimit: 1000
        });
        const { agent, state } = agentWithFailure(
            SERVER_ERROR,
            { isRateLimit: false, isServerError: true, isAuthError: false },
            { failures: 1 } // the (single) call against the fallback provider succeeds
        );

        const result = await agent.callLLM('prompt', 0.2, false, null, 3);

        expect(result).toBe('recovered');
        // One failed call against Gemini, then straight to the fallback — not three
        // same-provider attempts first.
        expect(state.calls).toBe(2);
        expect(state.adapters).toEqual(['GEMINI:gemini-3.5-flash', 'CLAUDE:claude-backup']);
        expect(agent.provider).toBe('CLAUDE');
        expect(agent.modelName).toBe('claude-backup');
    });

    it('preserves today\'s same-provider retry behavior when no fallback is configured', async () => {
        process.env.MOCK_AI = 'false';
        const { agent, state } = agentWithFailure(
            SERVER_ERROR,
            { isRateLimit: false, isServerError: true, isAuthError: false },
            { failures: 1, providerConfig: { allowModelFallback: false } }
        );

        // Small initialDelay so the preserved same-provider backoff doesn't slow the test.
        const result = await agent.callLLM('prompt', 0.2, false, null, 3, 50);

        expect(result).toBe('recovered');
        expect(state.calls).toBe(2);
        expect(mockSelectNextFallbackModel).not.toHaveBeenCalled();
    });

    it('throws the final sanitizable error when fallback is configured but no candidate is available', async () => {
        process.env.MOCK_AI = 'false';
        mockSelectNextFallbackModel.mockResolvedValue(null);
        const { agent, state } = agentWithFailure(
            SERVER_ERROR,
            { isRateLimit: false, isServerError: true, isAuthError: false }
        );

        await expect(agent.callLLM('prompt', 0.2, false, null, 3, 50)).rejects.toThrow(/failed to generate content/);
        // No fallback candidate → falls through to the same-provider last-resort retry
        // budget (3 attempts) before finally throwing.
        expect(state.calls).toBe(4);
    });

    it('attempts a fallback for an auth error without any same-provider retry first', async () => {
        process.env.MOCK_AI = 'false';
        mockSelectNextFallbackModel.mockResolvedValueOnce({
            provider: 'CLAUDE', modelName: 'claude-backup', apiKey: 'claude-key',
            inputTokenLimit: 2000, outputTokenLimit: 1000
        });
        const { agent, state } = agentWithFailure(
            AUTH_ERROR,
            { isRateLimit: false, isServerError: false, isAuthError: true },
            { failures: 1 }
        );

        const result = await agent.callLLM('prompt', 0.2, false, null, 3);

        expect(result).toBe('recovered');
        // Exactly one failed call against the rejected key, then the fallback succeeds —
        // no wasted same-provider retries against a key that will never start working.
        expect(state.calls).toBe(2);
        expect(agent.provider).toBe('CLAUDE');
    });

    it('keeps using the fallback provider for the agent\'s next, separate call', async () => {
        process.env.MOCK_AI = 'false';
        mockSelectNextFallbackModel.mockResolvedValueOnce({
            provider: 'CLAUDE', modelName: 'claude-backup', apiKey: 'claude-key',
            inputTokenLimit: 2000, outputTokenLimit: 1000
        });
        const { agent } = agentWithFailure(
            SERVER_ERROR,
            { isRateLimit: false, isServerError: true, isAuthError: false },
            { failures: 1 }
        );

        await agent.callLLM('prompt', 0.2, false, null, 3);
        expect(agent.provider).toBe('CLAUDE');

        // A second, independent call should go straight to Claude — no rediscovery of
        // Gemini's failure — since the agent instance remembers the switch.
        agent.getAdapter = () => ({
            generateContent: async () => 'second-call-result',
            classifyError: () => ({ isRateLimit: false, isServerError: false, isAuthError: false })
        });
        const secondResult = await agent.callLLM('prompt2', 0.2, false, null, 3);
        expect(secondResult).toBe('second-call-result');
        expect(mockSelectNextFallbackModel).toHaveBeenCalledTimes(1);
    });
});
