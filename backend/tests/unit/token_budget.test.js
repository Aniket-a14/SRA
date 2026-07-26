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
        // whatever the ceiling — the prompts are tuned around that proportion. The
        // comparison is non-strict because the viability floor legitimately collapses the
        // smaller budgets onto each other on a small model (see the next test).
        for (const ceiling of [8192, 20000, 65536]) {
            const l = resolveOutputTokenLimits(ceiling);
            expect(l.srsRequirements).toBeGreaterThanOrEqual(l.srsFeatures);
            expect(l.srsFeatures).toBeGreaterThanOrEqual(l.architectSection);
            expect(l.architectSection).toBeGreaterThanOrEqual(l.smallJson);
        }

        // On a large model, where nothing is floored, the ordering is still strict.
        const large = resolveOutputTokenLimits(65536);
        expect(large.srsRequirements).toBeGreaterThan(large.srsFeatures);
        expect(large.srsFeatures).toBeGreaterThan(large.architectSection);
        expect(large.architectSection).toBeGreaterThan(large.smallJson);
    });

    it('keeps every budget large enough for a reasoning model to finish', () => {
        // The bug this guards: a reasoning model bills its private thinking against
        // maxOutputTokens. Measured on gemini-3.5-flash, the Layer-2 validation prompt spent
        // 1,490 tokens thinking and needed 625 more for its JSON — so the old 2,048
        // smallJson budget hit MAX_TOKENS and returned unparseable JSON on every single run.
        // That failure pinned drafts in their pre-validation state, so the whole flow stalled.
        const THINKING_OVERHEAD_OBSERVED = 1490;

        for (const limits of [OUTPUT_TOKEN_LIMITS, resolveOutputTokenLimits(65536), resolveOutputTokenLimits(20000)]) {
            Object.entries(limits).forEach(([name, budget]) => {
                expect({ name, budget }).toMatchObject({ budget: expect.any(Number) });
                expect(budget).toBeGreaterThan(THINKING_OVERHEAD_OBSERVED * 2);
            });
        }
    });

    it('lets the model ceiling override the floor, so the request is never rejected', () => {
        // A budget above what the model accepts is an API error; a small model simply has
        // less room to think in. The ceiling has to win.
        const limits = resolveOutputTokenLimits(2048);
        Object.values(limits).forEach((v) => expect(v).toBeLessThanOrEqual(2048));
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
