import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the provider SDKs so this suite verifies modelDiscovery's own filtering,
// labelling, and error-classification logic — not real network calls.
const mockOpenAIList = jest.fn();
jest.unstable_mockModule('openai', () => ({
    default: class MockOpenAI {
        constructor(opts) { this.opts = opts; this.models = { list: mockOpenAIList }; }
    }
}));

const mockAnthropicList = jest.fn();
jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
    default: class MockAnthropic {
        constructor(opts) { this.opts = opts; this.models = { list: mockAnthropicList }; }
    }
}));

const { discoverModels, formatModelLabel, ModelDiscoveryError } = await import('../../src/services/providers/modelDiscovery.js');

describe('modelDiscovery', () => {
    beforeEach(() => {
        mockOpenAIList.mockReset();
        mockAnthropicList.mockReset();
    });

    describe('formatModelLabel', () => {
        it('humanizes raw provider model ids (fallback when the API gives no display name)', () => {
            expect(formatModelLabel('gpt-5.6')).toBe('GPT 5.6');
            expect(formatModelLabel('claude-opus-4-8')).toBe('Claude Opus 4 8');
            expect(formatModelLabel('gemini-2.5-flash')).toBe('Gemini 2.5 Flash');
            expect(formatModelLabel('models/gemini-2.5-pro')).toBe('Gemini 2.5 Pro');
            expect(formatModelLabel('grok-4.5')).toBe('Grok 4.5');
        });
    });

    describe('discoverModels — OpenAI', () => {
        it('keeps only generation models and drops embeddings/audio/image', async () => {
            mockOpenAIList.mockResolvedValue({
                data: [
                    { id: 'gpt-5.6' },
                    { id: 'gpt-4o-mini' },
                    { id: 'o3' },
                    { id: 'text-embedding-3-large' },
                    { id: 'whisper-1' },
                    { id: 'dall-e-3' },
                    { id: 'omni-moderation-latest' }
                ]
            });

            const { models } = await discoverModels('OPENAI', 'sk-valid');
            const ids = models.map(m => m.id);

            expect(ids).toContain('gpt-5.6');
            expect(ids).toContain('o3');
            expect(ids).not.toContain('text-embedding-3-large');
            expect(ids).not.toContain('whisper-1');
            expect(ids).not.toContain('dall-e-3');
            expect(ids).not.toContain('omni-moderation-latest');
            expect(models[0]).toHaveProperty('label');
        });

        it('maps a 401 to an auth-kind ModelDiscoveryError (reject the save)', async () => {
            const err = new Error('Incorrect API key provided');
            err.status = 401;
            mockOpenAIList.mockRejectedValue(err);

            const thrown = await discoverModels('OPENAI', 'sk-bad').catch(e => e);
            expect(thrown).toBeInstanceOf(ModelDiscoveryError);
            expect(thrown.kind).toBe('auth');
            expect(thrown.statusCode).toBe(400);
        });

        it('maps a 500 to an unavailable-kind error (key may still be valid)', async () => {
            const err = new Error('server error');
            err.status = 500;
            mockOpenAIList.mockRejectedValue(err);

            const thrown = await discoverModels('OPENAI', 'sk-valid').catch(e => e);
            expect(thrown).toBeInstanceOf(ModelDiscoveryError);
            expect(thrown.kind).toBe('unavailable');
            expect(thrown.statusCode).toBe(502);
        });

        it('rejects an empty key before making any network call', async () => {
            const thrown = await discoverModels('OPENAI', '   ').catch(e => e);
            expect(thrown).toBeInstanceOf(ModelDiscoveryError);
            expect(thrown.kind).toBe('auth');
            expect(mockOpenAIList).not.toHaveBeenCalled();
        });

        it('treats a verified key with zero generation models as unavailable', async () => {
            mockOpenAIList.mockResolvedValue({ data: [{ id: 'text-embedding-3-large' }] });
            const thrown = await discoverModels('OPENAI', 'sk-valid').catch(e => e);
            expect(thrown).toBeInstanceOf(ModelDiscoveryError);
        });
    });

    describe('discoverModels — Claude', () => {
        it('returns claude models with their display names', async () => {
            mockAnthropicList.mockResolvedValue({
                data: [
                    { id: 'claude-opus-4-8', display_name: 'Claude Opus 4.8' },
                    { id: 'claude-sonnet-5', display_name: 'Claude Sonnet 5' }
                ]
            });

            const { models } = await discoverModels('CLAUDE', 'sk-ant-valid');
            expect(models).toEqual([
                { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
                { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' }
            ]);
        });
    });

    describe('discoverModels — Gemini (REST)', () => {
        const realFetch = global.fetch;
        afterEach(() => { global.fetch = realFetch; });

        it('keeps only generateContent models and strips the models/ prefix', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    models: [
                        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] },
                        { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
                        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] }
                    ]
                })
            });

            const { models } = await discoverModels('GEMINI', 'AIza-valid');
            const ids = models.map(m => m.id);
            expect(ids).toContain('gemini-2.5-flash');
            expect(ids).toContain('gemini-2.5-pro');
            expect(ids).not.toContain('text-embedding-004');
        });

        it('maps a 403 from the REST endpoint to an auth error', async () => {
            global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
            const thrown = await discoverModels('GEMINI', 'AIza-bad').catch(e => e);
            expect(thrown).toBeInstanceOf(ModelDiscoveryError);
            expect(thrown.kind).toBe('auth');
        });

        // ListModels advertises plenty of models that advertise generateContent but cannot
        // produce structured SRS text (speech, image, music, robotics, computer-use,
        // deep-research) — and Gemma, which does not reliably honour system instructions
        // or JSON response types on this endpoint.
        it('drops non-text-generation model families', async () => {
            const listed = [
                'gemini-3.5-flash', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-image',
                'nano-banana-pro-preview', 'lyria-3-pro-preview', 'gemini-robotics-er-1.6-preview',
                'gemini-2.5-computer-use-preview-10-2025', 'deep-research-pro-preview-12-2025',
                'antigravity-preview-05-2026', 'gemma-4-31b-it', 'gemini-embedding-2'
            ];
            global.fetch = jest.fn().mockImplementation((url) =>
                String(url).includes(':generateContent')
                    ? Promise.resolve({ ok: true, json: async () => ({}) })
                    : Promise.resolve({
                        ok: true,
                        json: async () => ({
                            models: listed.map(id => ({
                                name: `models/${id}`,
                                supportedGenerationMethods: id.includes('embedding') ? ['embedContent'] : ['generateContent']
                            }))
                        })
                    })
            );

            const { models } = await discoverModels('GEMINI', 'AIza-valid');
            expect(models.map(m => m.id)).toEqual(['gemini-3.5-flash']);
        });

        // The list endpoint shows models the key's tier cannot call: on a free-tier key
        // every *-pro returns 429 and retired ids return 404, yet all are listed.
        it('drops models the key cannot actually call', async () => {
            global.fetch = jest.fn().mockImplementation((url) => {
                const u = String(url);
                if (u.includes(':generateContent')) {
                    const callable = u.includes('gemini-3.5-flash');
                    return Promise.resolve({ ok: callable, status: callable ? 200 : 429, json: async () => ({}) });
                }
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        models: [
                            { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] },
                            { name: 'models/gemini-3.1-pro-preview', supportedGenerationMethods: ['generateContent'] }
                        ]
                    })
                });
            });

            const { models } = await discoverModels('GEMINI', 'AIza-freetier');
            expect(models.map(m => m.id)).toEqual(['gemini-3.5-flash']);
        });

        it('falls back to the capability-filtered list when every probe fails', async () => {
            // A wholly throttled key must not produce an empty picker.
            global.fetch = jest.fn().mockImplementation((url) =>
                String(url).includes(':generateContent')
                    ? Promise.resolve({ ok: false, status: 429, json: async () => ({}) })
                    : Promise.resolve({
                        ok: true,
                        json: async () => ({
                            models: [{ name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] }]
                        })
                    })
            );

            const { models } = await discoverModels('GEMINI', 'AIza-throttled');
            expect(models.map(m => m.id)).toEqual(['gemini-3.5-flash']);
        });
    });
});
