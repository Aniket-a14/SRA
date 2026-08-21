import { ErrorCodes } from './errorCodes.js';

/**
 * Turns any error that might reach an HTTP response, SSE frame, or persisted
 * `Analysis.metadata` field into a message safe to show a user — informative
 * (names the provider when known) but never carrying raw SDK text, stack traces,
 * or structured provider error payloads (which can include doc links, internal
 * quota descriptors, or fragments of the request).
 *
 * Callers are still expected to log the raw `error` themselves; this function
 * only decides what crosses the trust boundary into user-visible text.
 *
 * @param {Error} error
 * @param {{ providerHint?: string }} [context] - human-readable provider name
 *   (e.g. "Gemini") to use in the message when the caller has one in scope.
 * @returns {{ message: string, code: string, statusCode: number, retryable: boolean }}
 */
export function sanitizeError(error, context = {}) {
    const providerHint = context.providerHint || 'The AI provider';

    if (!error) {
        return { message: 'An unexpected error occurred.', code: ErrorCodes.INTERNAL_ERROR, statusCode: 500, retryable: false };
    }

    // A daily/billing quota failure already carries a deliberately-crafted, safe
    // message (see quotaErrors.js) — never re-derive it.
    if (error.quotaExhausted === true) {
        return { message: error.message, code: ErrorCodes.AI_QUOTA_EXCEEDED, statusCode: 429, retryable: false };
    }

    // Anything our own code threw with a statusCode < 500 is a deliberate,
    // client-actionable message (missing key, bad input, not found) — never raw
    // provider text at this point in the codebase.
    if (typeof error.statusCode === 'number' && error.statusCode < 500 && error.statusCode >= 400) {
        return {
            message: error.message,
            code: error.code || (error.statusCode === 401 ? ErrorCodes.UNAUTHORIZED
                : error.statusCode === 403 ? ErrorCodes.FORBIDDEN
                    : error.statusCode === 404 ? ErrorCodes.PROJECT_NOT_FOUND
                        : ErrorCodes.VALIDATION_FAILED),
            statusCode: error.statusCode,
            retryable: false
        };
    }

    const haystack = `${error.message || ''} ${error.code || ''} ${error.error?.code || ''} ${error.error?.type || ''}`;

    if (error.message === 'AI Request Timeout') {
        return {
            message: `The request to ${providerHint} took too long and was cancelled. Please try again.`,
            code: ErrorCodes.GATEWAY_TIMEOUT,
            statusCode: 504,
            retryable: true
        };
    }

    if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(haystack)) {
        return {
            message: `Could not reach ${providerHint}. Please check your connection and try again.`,
            code: ErrorCodes.SERVICE_UNAVAILABLE,
            statusCode: 503,
            retryable: true
        };
    }

    if (/\b503\b|service unavailable|overloaded|\bUNAVAILABLE\b/i.test(haystack)) {
        return {
            message: `${providerHint} is currently experiencing high demand. Please try again in a moment.`,
            code: ErrorCodes.SERVICE_UNAVAILABLE,
            statusCode: 503,
            retryable: true
        };
    }

    if (/\b401\b|\b403\b|invalid[_ ]api[_ ]key|authentication_error|unauthorized/i.test(haystack)) {
        return {
            message: `The ${providerHint} API key on this account was rejected. Update it in Settings.`,
            code: ErrorCodes.UNAUTHORIZED,
            statusCode: 401,
            retryable: false
        };
    }

    if (/\b429\b|quota|rate limit/i.test(haystack)) {
        return {
            message: `${providerHint} is rate-limiting requests right now. Please wait a moment and try again.`,
            code: ErrorCodes.RATE_LIMIT_EXCEEDED,
            statusCode: 429,
            retryable: true
        };
    }

    return {
        message: 'An unexpected error occurred while generating this content. Our team has been notified.',
        code: ErrorCodes.AI_PROCESSING_ERROR,
        statusCode: 500,
        retryable: false
    };
}
