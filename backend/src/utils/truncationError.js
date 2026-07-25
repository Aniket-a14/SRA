/**
 * Guards against silently accepting a response the provider cut short.
 *
 * Every adapter asks for constrained JSON output (Gemini via `responseSchema`, the others
 * via schema-shaped prompting), so the model does not emit *syntactically* broken JSON.
 * The one way a well-formed generation still arrives unparseable is truncation: the output
 * hits `maxOutputTokens` and stops mid-structure.
 *
 * That distinction matters because the two failures need opposite handling. Repairing a
 * genuinely malformed payload recovers the data. "Repairing" a truncated one closes the
 * open brackets and yields *valid JSON containing less data than the model produced* — an
 * SRS with requirements missing from the array. Zod still passes it (a short array is a
 * valid array), the Reviewer and Critic score the shortened document, and it persists as a
 * complete spec. Detecting truncation at the adapter boundary keeps that from ever
 * reaching the repair pipeline.
 */

/** Provider-specific finish reasons that mean "output was cut off at the token budget". */
const TRUNCATED_REASONS = new Set(['MAX_TOKENS', 'length', 'max_tokens']);

export class TruncatedOutputError extends Error {
    constructor(provider, modelName, maxOutputTokens) {
        super(
            `${provider} stopped generating at the ${maxOutputTokens ?? 'configured'}-token output limit, ` +
            `leaving the JSON incomplete. The response was NOT auto-repaired, because closing a truncated ` +
            `array silently drops content from the spec. Raise the token budget for this call or split the section.`
        );
        this.name = 'TruncatedOutputError';
        this.provider = provider;
        this.modelName = modelName;
        this.maxOutputTokens = maxOutputTokens;
        this.truncated = true;
        this.statusCode = 502;
    }
}

/**
 * Throws when the provider reports the generation was cut off at the token limit.
 *
 * @param {string|undefined} finishReason - provider finish/stop reason for the response
 * @param {{provider: string, modelName?: string, maxOutputTokens?: number}} context
 * @throws {TruncatedOutputError}
 */
export function assertNotTruncated(finishReason, { provider, modelName, maxOutputTokens }) {
    if (finishReason && TRUNCATED_REASONS.has(finishReason)) {
        throw new TruncatedOutputError(provider, modelName, maxOutputTokens);
    }
}
