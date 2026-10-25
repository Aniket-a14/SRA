import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * ClaudeAdapter sent `thinking: { type: 'disabled' }` and the pipeline's temperature to every
 * model. Current models reject both with a 400 (Opus 5.5 / Fable / Mythos cannot disable
 * thinking; Sonnet 5.5 uses `between_tools`; API version 2026-10-21 removes temperature on
 * every model), so Claude BYOK failed on every current model. The request body is captured
 * from a mocked SDK so these assert what would actually go over the wire.
 */
const mockCreate = jest.fn();
const mockStream = jest.fn();
const mockCountTokens = jest.fn();
let constructedWith = null;
jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
    default: class MockAnthropic {
        constructor(opts) {
            constructedWith = opts;
            this.messages = { create: mockCreate, stream: mockStream, countTokens: mockCountTokens };
        }
    }
}));

const { parseClaudeModel, thinkingOffFields, claudeRequestFields, assertNotRefused } =
    await import('../../src/services/providers/claudeModelRules.js');
const { ClaudeAdapter } = await import('../../src/services/providers/ClaudeAdapter.js');

const okMessage = (text = '{"ok":true}', extra = {}) => ({
    withResponse: async () => ({
        data: { stop_reason: 'end_turn', content: [{ type: 'text', text }], ...extra },
        response: { headers: new Headers() }
    })
});

describe('parseClaudeModel', () => {
    it.each([
        ['claude-opus-5-5', { family: 'opus', major: 5, minor: 5 }],
        ['claude-sonnet-5-5', { family: 'sonnet', major: 5, minor: 5 }],
        ['claude-haiku-5-5', { family: 'haiku', major: 5, minor: 5 }],
        ['claude-opus-5', { family: 'opus', major: 5, minor: 0 }],
        ['claude-fable-5-1', { family: 'fable', major: 5, minor: 1 }],
        ['claude-mythos-5-1', { family: 'mythos', major: 5, minor: 1 }],
        ['claude-opus-4-8', { family: 'opus', major: 4, minor: 8 }],
        ['claude-sonnet-4-5-20250929', { family: 'sonnet', major: 4, minor: 5 }],
        ['claude-3-7-sonnet-20250219', { family: 'sonnet', major: 3, minor: 7 }],
        ['claude-3-haiku-20240307', { family: 'haiku', major: 3, minor: 0 }],
        ['claude-opus-4-5@20251101', { family: 'opus', major: 4, minor: 5 }]
    ])('%s', (id, expected) => {
        expect(parseClaudeModel(id)).toEqual(expected);
    });

    it.each(['', null, undefined, 'gpt-5.6', 'claude-next'])('returns null for %p', (id) => {
        expect(parseClaudeModel(id)).toBeNull();
    });
});

describe('thinkingOffFields follows each model\'s documented rules', () => {
    it.each([
        // thinking cannot be disabled: adaptive at the lowest effort instead
        ['claude-opus-5-5', { output_config: { effort: 'low' } }],
        ['claude-fable-5-1', { output_config: { effort: 'low' } }],
        ['claude-fable-5', { output_config: { effort: 'low' } }],
        ['claude-mythos-5-1', { output_config: { effort: 'low' } }],
        // disabling is accepted but documented as unreliable (leaked thinking tags)
        ['claude-opus-5', { output_config: { effort: 'low' } }],
        // Sonnet 5.5's own thinking-off mode
        ['claude-sonnet-5-5', { thinking: { type: 'between_tools' } }],
        // disabled is accepted and behaves
        ['claude-sonnet-5', { thinking: { type: 'disabled' } }],
        ['claude-haiku-5-5', { thinking: { type: 'disabled' } }],
        ['claude-opus-4-8', { thinking: { type: 'disabled' } }],
        ['claude-sonnet-4-6', { thinking: { type: 'disabled' } }],
        ['claude-haiku-4-5', { thinking: { type: 'disabled' } }],
        // unknown: send nothing, the model default is always accepted
        ['some-future-model', {}]
    ])('%s', (id, expected) => {
        expect(thinkingOffFields(id)).toEqual(expected);
    });

    it('never pairs between_tools with any other thinking or effort field', () => {
        expect(claudeRequestFields('claude-sonnet-5-5')).toEqual({ thinking: { type: 'between_tools' } });
    });
});

describe('ClaudeAdapter request body', () => {
    beforeEach(() => {
        mockCreate.mockReset();
        mockStream.mockReset();
        constructedWith = null;
    });

    it('refuses to build without a key (the SDK would fall back to environment credentials)', () => {
        expect(() => new ClaudeAdapter(undefined)).toThrow(/API key is required/);
        expect(() => new ClaudeAdapter('')).toThrow(/API key is required/);
        expect(constructedWith).toBeNull();
    });

    it.each(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-sonnet-4-6', 'claude-haiku-4-5'])(
        'never sends a sampling parameter (%s)', async (modelName) => {
            mockCreate.mockReturnValue(okMessage());
            await new ClaudeAdapter('sk-ant-x').generateContent({
                prompt: 'p', systemInstruction: 's', temperature: 0.2, maxOutputTokens: 1000, jsonMode: true, modelName
            });
            const body = mockCreate.mock.calls[0][0];
            expect(body).not.toHaveProperty('temperature');
            expect(body).not.toHaveProperty('top_p');
            expect(body).not.toHaveProperty('top_k');
            expect(body).toMatchObject({ model: modelName, max_tokens: 1000, system: 's' });
        }
    );

    it('does not send thinking:disabled to Opus 5.5', async () => {
        mockCreate.mockReturnValue(okMessage());
        await new ClaudeAdapter('sk-ant-x').generateContent({ prompt: 'p', modelName: 'claude-opus-5-5', jsonMode: true });
        const body = mockCreate.mock.calls[0][0];
        expect(body.thinking).toBeUndefined();
        expect(body.output_config).toEqual({ effort: 'low' });
    });

    it('applies the same shape to the streaming path', async () => {
        const events = [{ type: 'content_block_delta', delta: { type: 'text_delta', text: '{}' } }];
        mockStream.mockReturnValue({
            async *[Symbol.asyncIterator]() { yield* events; },
            response: { headers: new Headers() },
            finalMessage: async () => ({ stop_reason: 'end_turn', content: [] })
        });
        const chunks = [];
        for await (const c of new ClaudeAdapter('sk-ant-x').generateContentStream({
            prompt: 'p', temperature: 0.7, modelName: 'claude-sonnet-5-5', jsonMode: true
        })) chunks.push(c);
        const body = mockStream.mock.calls[0][0];
        expect(chunks).toEqual(['{}']);
        expect(body).not.toHaveProperty('temperature');
        expect(body.thinking).toEqual({ type: 'between_tools' });
    });

    it('surfaces a refusal as a clear error instead of an empty JSON reply', async () => {
        mockCreate.mockReturnValue(okMessage('', { stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [] }));
        const err = await new ClaudeAdapter('sk-ant-x')
            .generateContent({ prompt: 'p', modelName: 'claude-opus-5-5', jsonMode: true }).catch(e => e);
        expect(err.refusal).toBe(true);
        expect(err.refusalCategory).toBe('cyber');
        expect(err.message).toMatch(/declined/);
    });

    it('assertNotRefused is a no-op for every other stop reason', () => {
        for (const stop_reason of ['end_turn', 'max_tokens', 'stop_sequence', 'pause_turn', undefined]) {
            expect(() => assertNotRefused({ stop_reason }, 'm')).not.toThrow();
        }
    });
});
