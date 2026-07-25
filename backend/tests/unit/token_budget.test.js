import { describe, it, expect } from '@jest/globals';
import {
    OUTPUT_TOKEN_LIMITS,
    resolveOutputTokenLimits,
    clampOutputTokens
} from '../../src/utils/llmGenerationConfig.js';

describe('resolveOutputTokenLimits', () => {
    it('falls back to the static budgets when the model ceiling is unknown', () => {
        // Older stored keys have no captured limits; behaviour must be unchanged for them.
        expect(resolveOutputTokenLimits(undefined)).toEqual(OUTPUT_TOKEN_LIMITS);
        expect(resolveOutputTokenLimits(null)).toEqual(OUTPUT_TOKEN_LIMITS);
    });

    it('ignores implausible ceilings rather than starving every call', () => {
        // A bogus 10-token "limit" would otherwise collapse every budget to the floor.
        expect(resolveOutputTokenLimits(10)).toEqual(OUTPUT_TOKEN_LIMITS);
        expect(resolveOutputTokenLimits('nonsense')).toEqual(OUTPUT_TOKEN_LIMITS);
    });

    it('scales budgets down so a small model is never asked for more than it allows', () => {
        // The production truncation came from asking a model for 20000 output tokens.
        const limits = resolveOutputTokenLimits(8192);

        expect(limits.srsRequirements).toBeLessThanOrEqual(8192);
        expect(limits.srsFeatures).toBeLessThanOrEqual(8192);
        Object.values(limits).forEach((v) => expect(v).toBeLessThanOrEqual(8192));
    });

    it('scales budgets up so a large model does not truncate at the old fixed cap', () => {
        const limits = resolveOutputTokenLimits(65536);

        expect(limits.srsRequirements).toBeGreaterThan(OUTPUT_TOKEN_LIMITS.srsRequirements);
        expect(limits.srsFeatures).toBeGreaterThan(OUTPUT_TOKEN_LIMITS.srsFeatures);
    });

    it('preserves the relative shape of the budgets across model sizes', () => {
        // A requirements pass must stay the largest and a small JSON pass the smallest,
        // whatever the ceiling — the prompts are tuned around that proportion.
        for (const ceiling of [8192, 20000, 65536]) {
            const l = resolveOutputTokenLimits(ceiling);
            expect(l.srsRequirements).toBeGreaterThan(l.srsFeatures);
            expect(l.srsFeatures).toBeGreaterThan(l.architectSection);
            expect(l.architectSection).toBeGreaterThan(l.smallJson);
        }
    });

    it('never returns a budget below a usable floor', () => {
        const limits = resolveOutputTokenLimits(1024);
        Object.values(limits).forEach((v) => expect(v).toBeGreaterThanOrEqual(512));
    });
});

describe('clampOutputTokens', () => {
    it('caps a request that exceeds the model ceiling', () => {
        expect(clampOutputTokens(20000, 8192)).toBe(8192);
    });

    it('leaves a request within the ceiling untouched', () => {
        expect(clampOutputTokens(4096, 65536)).toBe(4096);
    });

    it('passes the request through when no ceiling is known', () => {
        expect(clampOutputTokens(20000, undefined)).toBe(20000);
    });
});
