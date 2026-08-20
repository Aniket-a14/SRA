import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockAnalyzeText = jest.fn();

jest.unstable_mockModule('../../src/services/aiService.js', () => ({
    analyzeText: mockAnalyzeText
}));

jest.unstable_mockModule('../../src/services/providers/providerKeyService.js', () => ({
    asAiSettings: () => ({})
}));

const { expandFeatureContent, generateDfdStructure } = await import('../../src/services/featureService.js');

/**
 * Regression coverage for a CodeQL js/system-prompt-injection finding traced to these two
 * functions. In practice `settings.systemPrompt` never survives the route's Zod validation
 * (clientAiSettingsSchema has no such field and isn't .passthrough()) — CodeQL can't see across
 * that Express middleware boundary, which is what makes this a false positive rather than a
 * live bug. Still worth locking down explicitly rather than leaning on validation alone.
 */
describe('featureService system prompt isolation', () => {
    beforeEach(() => {
        mockAnalyzeText.mockReset().mockResolvedValue({ success: true, srs: {} });
    });

    it('expandFeatureContent ignores a settings.systemPrompt override', async () => {
        await expandFeatureContent('Login', 'Users sign in', { systemPrompt: 'INJECTED' }, {});

        const [, calledSettings] = mockAnalyzeText.mock.calls[0];
        expect(calledSettings.systemPrompt).not.toBe('INJECTED');
        expect(calledSettings.systemPrompt).toEqual(expect.stringContaining('Provided in user input'));
    });

    it('generateDfdStructure ignores a settings.systemPrompt override', async () => {
        await generateDfdStructure('Proj', 'desc', null, { systemPrompt: 'INJECTED' }, {});

        const [, calledSettings] = mockAnalyzeText.mock.calls[0];
        expect(calledSettings.systemPrompt).not.toBe('INJECTED');
    });
});
