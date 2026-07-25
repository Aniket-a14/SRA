/**
 * Distinguishes an *exhausted* quota from an ordinary rate limit.
 *
 * Both arrive as HTTP 429, but they need opposite handling. A per-minute limit clears
 * on its own, so backing off and retrying is correct. A per-day (or billing-exhausted)
 * quota does not clear for hours — every retry is guaranteed to fail, and on a
 * serverless deployment those doomed attempts burn the function's execution budget
 * before the pipeline ever gets to report why it stopped.
 *
 * Observed live 2026-07-25 on a free-tier Gemini key:
 *   quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "20"
 * Three attempts were made 2s and 4s apart against a cap that resets daily.
 */

// Google returns the quota descriptor in a QuotaFailure detail block; the `PerDay`
// substring is the reliable marker across free/paid tiers and model families.
const GEMINI_DAILY = /PerDay|per day|GenerateRequestsPerDayPerProject/i;

// OpenAI-compatible providers (OpenAI, Grok) signal a spent balance with
// `insufficient_quota` rather than a windowed limit — also not worth retrying.
const OPENAI_EXHAUSTED = /insufficient_quota|exceeded your current quota/i;

/**
 * @param {Error} error - the provider error, as thrown by an adapter
 * @returns {boolean} true when retrying cannot succeed within this run
 */
export function isExhaustedQuota(error) {
    if (!error) return false;

    // SDKs surface the QuotaFailure details in different places depending on provider
    // and transport, so check the structured fields before falling back to the message.
    const structured = [
        error.code,
        error.error?.code,
        error.error?.type,
        error.details && JSON.stringify(error.details)
    ].filter(Boolean).join(' ');

    const haystack = `${structured} ${error.message || ''}`;

    return GEMINI_DAILY.test(haystack) || OPENAI_EXHAUSTED.test(haystack);
}

/**
 * Builds the operator-facing error for an exhausted quota. Deliberately names the model,
 * because the Gemini cap is per-model-per-day — switching models is a real remedy, and a
 * bare "quota exceeded" hides that.
 *
 * @param {Error} error - the originating provider error
 * @param {string} [modelName] - the model whose quota was spent
 * @returns {Error} a 429 error flagged non-retryable
 */
export function buildExhaustedQuotaError(error, modelName) {
    const limitMatch = (error.message || '').match(/limit:\s*(\d+)/i);
    const limit = limitMatch ? `${limitMatch[1]} requests/day` : 'the daily allowance';
    const target = modelName ? `for ${modelName}` : 'for this model';

    const enhanced = new Error(
        `Daily AI quota exhausted ${target} (${limit}). This resets tomorrow — retrying now cannot succeed. ` +
        `A full analysis needs roughly 15-25 model calls, so pick a model with a higher daily cap or enable billing on the key.`
    );
    enhanced.statusCode = 429;
    enhanced.quotaExhausted = true;
    enhanced.cause = error;
    return enhanced;
}
