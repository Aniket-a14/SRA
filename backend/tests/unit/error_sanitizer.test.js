import { describe, it, expect } from '@jest/globals';
import { sanitizeError } from '../../src/utils/errorSanitizer.js';
import { ErrorCodes } from '../../src/utils/errorCodes.js';
import { buildExhaustedQuotaError } from '../../src/utils/quotaErrors.js';

// Raw shapes actually observed from provider SDKs / our own code — see errorSanitizer.js
// and the leak points it replaces (analysisService.js, analysisController.js).
const GEMINI_OVERLOAD = new Error(
    '[GoogleGenerativeAI Error]: [503 Service Unavailable] The model is overloaded. Please try again later.'
);
const GEMINI_QUOTA_JSON = new Error(
    '[GoogleGenerativeAI Error]: [429 Too Many Requests] Quota exceeded for metric: generate_content_free_tier_requests, ' +
    'limit: 20. [{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]'
);
// Provider SDK errors carry `.status` (see OpenAIAdapter.js/ClaudeAdapter.js), never the
// `.statusCode` our own deliberately-thrown errors use — sanitizeError's pass-through rule
// keys on `.statusCode` specifically so a raw SDK error is never mistaken for a safe one.
const OPENAI_INSUFFICIENT_QUOTA = Object.assign(
    new Error('You exceeded your current quota, please check your plan and billing details.'),
    { code: 'insufficient_quota', status: 429 }
);
const CLAUDE_AUTH = Object.assign(
    new Error('{"type":"authentication_error","message":"invalid x-api-key sk-ant-api03-xxxx"}'),
    { status: 401 }
);
const PLAIN_ERROR = new Error('boom');
const APP_400 = Object.assign(new Error('No GEMINI API key configured. Add your own key in Settings.'), { statusCode: 400 });
const QUOTA_EXHAUSTED = buildExhaustedQuotaError(new Error('limit: 20, PerDay'), 'gemini-3.5-flash');

const FORBIDDEN_SUBSTRINGS = ['@type', 'google.rpc', 'sk-ant-api03', 'GenerateRequestsPerDay', 'x-api-key'];

describe('sanitizeError', () => {
    it.each([
        ['Gemini overload/503', GEMINI_OVERLOAD, { providerHint: 'Gemini' }, 503],
        ['Gemini quota JSON blob', GEMINI_QUOTA_JSON, { providerHint: 'Gemini' }, 429],
        ['OpenAI insufficient_quota', OPENAI_INSUFFICIENT_QUOTA, { providerHint: 'OpenAI' }, 429],
        ['Claude auth error', CLAUDE_AUTH, { providerHint: 'Claude' }, 401],
        ['plain unclassified error', PLAIN_ERROR, {}, 500]
    ])('never leaks raw SDK/internal text for: %s', (_label, error, context, expectedStatus) => {
        const result = sanitizeError(error, context);

        for (const substring of FORBIDDEN_SUBSTRINGS) {
            expect(result.message).not.toContain(substring);
        }
        expect(result.message).not.toBe(error.message);
        expect(result.statusCode).toBe(expectedStatus);
        expect(Object.values(ErrorCodes)).toContain(result.code);
    });

    it('names the provider in the message when a hint is given', () => {
        const result = sanitizeError(GEMINI_OVERLOAD, { providerHint: 'Gemini' });
        expect(result.message).toContain('Gemini');
    });

    it('passes an already-safe quota-exhausted message through unchanged', () => {
        const result = sanitizeError(QUOTA_EXHAUSTED);
        expect(result.message).toBe(QUOTA_EXHAUSTED.message);
        expect(result.code).toBe(ErrorCodes.AI_QUOTA_EXCEEDED);
        expect(result.statusCode).toBe(429);
    });

    it('passes our own deliberately-thrown client-actionable (<500) messages through unchanged', () => {
        const result = sanitizeError(APP_400);
        expect(result.message).toBe(APP_400.message);
        expect(result.statusCode).toBe(400);
    });

    it('never leaks a stack trace', () => {
        const result = sanitizeError(GEMINI_OVERLOAD);
        expect(result.message).not.toContain('at ');
        expect(result.message).not.toContain('.js:');
    });
});
