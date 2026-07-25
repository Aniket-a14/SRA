import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getDefaultModel, getUtilityModel, getEmbeddingModel, getEmbeddingDimensions } from '../../src/config/models.js';
import { BaseAgent } from '../../src/agents/BaseAgent.js';

const MODEL_VARS = [
    'GEMINI_MODEL_NAME',
    'GEMINI_UTILITY_MODEL_NAME',
    'GEMINI_EMBEDDING_MODEL',
    'GEMINI_EMBEDDING_DIMENSIONS',
    'OPENAI_MODEL_NAME',
    'CLAUDE_MODEL_NAME',
    'GROK_MODEL_NAME'
];

describe('model configuration', () => {
    const original = {};

    beforeEach(() => {
        for (const key of MODEL_VARS) {
            original[key] = process.env[key];
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const key of MODEL_VARS) {
            if (original[key] === undefined) delete process.env[key];
            else process.env[key] = original[key];
        }
    });

    it('reads each provider default from its own environment variable', () => {
        process.env.GEMINI_MODEL_NAME = 'env-gemini';
        process.env.OPENAI_MODEL_NAME = 'env-openai';
        process.env.CLAUDE_MODEL_NAME = 'env-claude';
        process.env.GROK_MODEL_NAME = 'env-grok';

        expect(getDefaultModel('GEMINI')).toBe('env-gemini');
        expect(getDefaultModel('OPENAI')).toBe('env-openai');
        expect(getDefaultModel('CLAUDE')).toBe('env-claude');
        expect(getDefaultModel('GROK')).toBe('env-grok');
    });

    it('fails with an actionable message naming the missing variable', () => {
        expect(() => getDefaultModel('OPENAI')).toThrow(/OPENAI_MODEL_NAME is not set/);
        expect(() => getEmbeddingModel()).toThrow(/GEMINI_EMBEDDING_MODEL is not set/);
    });

    it('treats a blank variable as unset rather than sending an empty model id', () => {
        process.env.GEMINI_MODEL_NAME = '   ';
        expect(() => getDefaultModel('GEMINI')).toThrow(/GEMINI_MODEL_NAME is not set/);
    });

    it('falls back to the main Gemini model when no utility model is configured', () => {
        process.env.GEMINI_MODEL_NAME = 'env-gemini';
        expect(getUtilityModel()).toBe('env-gemini');

        process.env.GEMINI_UTILITY_MODEL_NAME = 'env-gemini-lite';
        expect(getUtilityModel()).toBe('env-gemini-lite');
    });

    it('rejects a non-numeric embedding width instead of passing it to the provider', () => {
        process.env.GEMINI_EMBEDDING_MODEL = 'env-embed';
        process.env.GEMINI_EMBEDDING_DIMENSIONS = 'wide';
        expect(() => getEmbeddingDimensions()).toThrow(/positive integer/);

        process.env.GEMINI_EMBEDDING_DIMENSIONS = '768';
        expect(getEmbeddingDimensions()).toBe(768);
    });

    it('lets an agent be constructed with no model env configured (resolution is lazy)', () => {
        // Several services build agents at module scope — importing them must not depend on
        // model configuration being present, only actually calling a provider does.
        expect(() => new BaseAgent('Lazy Agent')).not.toThrow();

        const agent = new BaseAgent('Lazy Agent');
        expect(() => agent.modelName).toThrow(/GEMINI_MODEL_NAME is not set/);

        process.env.GEMINI_MODEL_NAME = 'env-gemini';
        expect(agent.modelName).toBe('env-gemini');
    });

    it('prefers an explicitly passed model over the environment default', () => {
        process.env.GEMINI_MODEL_NAME = 'env-gemini';
        expect(new BaseAgent('Pinned', { modelName: 'explicit-model' }).modelName).toBe('explicit-model');
    });
});
