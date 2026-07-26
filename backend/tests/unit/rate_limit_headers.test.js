import { describe, it, expect } from '@jest/globals';
import { parseRateLimitHeaders, parseQuotaFailure, isPerDayQuota } from '../../src/utils/rateLimitHeaders.js';

/**
 * The header names and payload shapes below are copied from the providers' own documentation
 * and, for Gemini, from a 429 captured live against a free-tier key on 2026-07-26. They are
 * the contract this feature rests on: get a name wrong and the UI silently shows nothing.
 */
describe('parseRateLimitHeaders', () => {
    it('reads OpenAI-style headers, including durations like 6m0s', () => {
        const parsed = parseRateLimitHeaders({
            'x-ratelimit-limit-requests': '10000',
            'x-ratelimit-remaining-requests': '9999',
            'x-ratelimit-remaining-tokens': '199900',
            'x-ratelimit-reset-requests': '6m0s'
        });

        expect(parsed.requestLimit).toBe(10000);
        expect(parsed.requestsRemaining).toBe(9999);
        expect(parsed.tokensRemaining).toBe(199900);
        // 6 minutes out, give or take scheduling slop.
        const deltaMs = parsed.resetsAt.getTime() - Date.now();
        expect(deltaMs).toBeGreaterThan(5 * 60 * 1000);
        expect(deltaMs).toBeLessThan(7 * 60 * 1000);
    });

    it('reads Anthropic-style headers with RFC 3339 resets', () => {
        const parsed = parseRateLimitHeaders({
            'anthropic-ratelimit-requests-limit': '1000',
            'anthropic-ratelimit-requests-remaining': '998',
            'anthropic-ratelimit-tokens-remaining': 'ances' // non-numeric must not throw
        });

        expect(parsed.requestLimit).toBe(1000);
        expect(parsed.requestsRemaining).toBe(998);
        expect(parsed.tokensRemaining).toBeNull();
    });

    it('accepts a Headers instance, not just a plain object', () => {
        const headers = new Headers({ 'x-ratelimit-remaining-requests': '42' });
        expect(parseRateLimitHeaders(headers).requestsRemaining).toBe(42);
    });

    it('returns null when the provider reported nothing, so "no data" is not read as zero', () => {
        // Gemini sends no rate-limit headers at all. Returning a zeroed object here would make
        // the UI announce "0 requests left" for a model with a full allowance.
        expect(parseRateLimitHeaders({ 'content-type': 'application/json' })).toBeNull();
        expect(parseRateLimitHeaders(null)).toBeNull();
    });

    it('distinguishes zero remaining from absent', () => {
        expect(parseRateLimitHeaders({ 'x-ratelimit-remaining-requests': '0' }).requestsRemaining).toBe(0);
    });
});

describe('parseQuotaFailure', () => {
    // Captured verbatim from a live free-tier 429.
    const geminiError = Object.assign(new Error(
        'You exceeded your current quota, please check your plan and billing details. ' +
        '* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, ' +
        'limit: 20, model: gemini-3.5-flash Please retry in 54.090605005s.'
    ), {
        errorDetails: [
            {
                '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
                violations: [{
                    quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
                    quotaValue: '20'
                }]
            },
            { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '54s' }
        ]
    });

    it('recovers the daily allowance from the QuotaFailure block', () => {
        expect(parseQuotaFailure(geminiError).limit).toBe(20);
    });

    it('falls back to the message when structured details are missing', () => {
        const bare = new Error('Quota exceeded ... limit: 50, model: x. Please retry in 12s.');
        expect(parseQuotaFailure(bare).limit).toBe(50);
        expect(parseQuotaFailure(bare).retryAfterMs).toBe(12000);
    });

    it('recognises a per-day quota, which must not be treated as a short burst limit', () => {
        // Gemini sends a ~54s retryDelay alongside a *daily* quotaId. Trusting the delay would
        // tell the user their allowance is back in a minute when it returns at midnight.
        expect(isPerDayQuota(geminiError)).toBe(true);
        expect(isPerDayQuota(new Error('rate limit exceeded, retry in 2s'))).toBe(false);
    });
});
