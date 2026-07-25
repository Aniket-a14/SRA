import { describe, it, expect } from '@jest/globals';
import { isExhaustedQuota, buildExhaustedQuotaError } from '../../src/utils/quotaErrors.js';

// The message below is copied verbatim from a production Vercel log (2026-07-25), where a
// free-tier Gemini key hit its 20-requests/day cap and the pipeline retried it three times
// 2s and 4s apart against a limit that resets daily.
const REAL_GEMINI_DAILY_429 = `[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent: [429 Too Many Requests] You exceeded your current quota, please check your plan and billing details.
* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.5-flash
Please retry in 38.042387455s. [{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaMetric":"generativelanguage.googleapis.com/generate_content_free_tier_requests","quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier","quotaDimensions":{"model":"gemini-3.5-flash","location":"global"},"quotaValue":"20"}]}]`;

// A per-minute limit — same 429 status, but this one genuinely clears on its own and
// must stay retryable. Telling the two apart is the entire point of this module.
const GEMINI_PER_MINUTE_429 = `[GoogleGenerativeAI Error]: [429 Too Many Requests] Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_requests, limit: 15
Please retry in 4.1s. [{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier","quotaValue":"15"}]}]`;

describe('quotaErrors', () => {
    describe('isExhaustedQuota', () => {
        it('detects the real free-tier daily cap from a production 429', () => {
            expect(isExhaustedQuota(new Error(REAL_GEMINI_DAILY_429))).toBe(true);
        });

        it('leaves a per-minute rate limit retryable', () => {
            // Regression guard: over-matching here would turn every transient 429 into a
            // hard pipeline abort, which is strictly worse than the original bug.
            expect(isExhaustedQuota(new Error(GEMINI_PER_MINUTE_429))).toBe(false);
        });

        it('detects an OpenAI-compatible spent balance', () => {
            const err = new Error('429 You exceeded your current quota');
            err.code = 'insufficient_quota';
            expect(isExhaustedQuota(err)).toBe(true);
        });

        it('reads the quota descriptor from structured fields, not just the message', () => {
            const err = new Error('429 Too Many Requests');
            err.details = [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }];
            expect(isExhaustedQuota(err)).toBe(true);
        });

        it('ignores unrelated errors and null', () => {
            expect(isExhaustedQuota(new Error('AI Request Timeout'))).toBe(false);
            expect(isExhaustedQuota(new Error('[500] Internal error'))).toBe(false);
            expect(isExhaustedQuota(null)).toBe(false);
        });
    });

    describe('buildExhaustedQuotaError', () => {
        it('names the model and the actual limit, since the cap is per-model-per-day', () => {
            const built = buildExhaustedQuotaError(new Error(REAL_GEMINI_DAILY_429), 'gemini-3.5-flash');

            expect(built.message).toMatch(/gemini-3\.5-flash/);
            expect(built.message).toMatch(/20 requests\/day/);
            expect(built.statusCode).toBe(429);
            expect(built.quotaExhausted).toBe(true);
        });

        it('says retrying cannot help, so the caller does not schedule one', () => {
            const built = buildExhaustedQuotaError(new Error(REAL_GEMINI_DAILY_429), 'gemini-3.5-flash');
            expect(built.message).toMatch(/cannot succeed/i);
        });

        it('degrades gracefully when the limit is not parseable', () => {
            const built = buildExhaustedQuotaError(new Error('429 quota exceeded PerDay'), undefined);
            expect(built.message).toMatch(/daily allowance/);
            expect(built.statusCode).toBe(429);
        });
    });
});
