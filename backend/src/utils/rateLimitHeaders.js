/**
 * Reads a provider's rate-limit response headers into one shape.
 *
 * Providers differ in what they will tell you, and that difference decides what the UI can
 * honestly claim:
 *
 * - **OpenAI / Grok** send `x-ratelimit-{limit,remaining,reset}-{requests,tokens}` on every
 *   response. Grok's API is OpenAI-compatible; if it ever stops sending them we simply get
 *   nothing back from here, which is the correct degradation.
 * - **Anthropic** sends `anthropic-ratelimit-requests-{limit,remaining,reset}` plus token
 *   variants, with resets as RFC 3339 timestamps.
 * - **Gemini** sends none of this. There is no usage endpoint either — its 429 links to the
 *   AI Studio dashboard — so the only figure available for Gemini is one we count ourselves.
 *
 * Because these come from the live response, they are already correct for whatever tier the
 * key is on. That is why they are preferred over any table of published limits: a Tier-4
 * OpenAI key and a free one report their own numbers without us having to know which is which.
 */

/** `1s`, `6m0s`, `2h30m`, `88ms` → milliseconds. OpenAI's reset headers use this format. */
function parseDuration(raw) {
    if (!raw) return null;
    const text = String(raw).trim();

    // A bare number is seconds (`retry-after` style).
    if (/^\d+(\.\d+)?$/.test(text)) return Math.round(parseFloat(text) * 1000);

    const pattern = /(\d+(?:\.\d+)?)(ms|s|m|h|d)/g;
    const unitMs = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
    let total = 0;
    let matched = false;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        matched = true;
        total += parseFloat(match[1]) * unitMs[match[2]];
    }
    return matched ? Math.round(total) : null;
}

/** A reset header is either an RFC 3339 instant (Anthropic) or a duration (OpenAI). */
function parseReset(raw) {
    if (!raw) return null;
    const text = String(raw).trim();

    const asDate = new Date(text);
    if (!Number.isNaN(asDate.getTime()) && /[-:T]/.test(text)) return asDate;

    const ms = parseDuration(text);
    return ms === null ? null : new Date(Date.now() + ms);
}

const toInt = (raw) => {
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : null;
};

/**
 * Header bags arrive as a `Headers` instance, a plain object, or a `Map` depending on which
 * SDK produced them, so read through one accessor rather than assuming a shape.
 */
function reader(headers) {
    if (!headers) return () => null;
    if (typeof headers.get === 'function') return (name) => headers.get(name);
    const lowered = {};
    for (const [k, v] of Object.entries(headers)) lowered[k.toLowerCase()] = v;
    return (name) => lowered[name.toLowerCase()] ?? null;
}

/**
 * @param {Headers|object|Map} headers - raw response headers
 * @returns {{requestLimit: number|null, requestsRemaining: number|null,
 *            tokensRemaining: number|null, resetsAt: Date|null}|null}
 *          null when the provider reported nothing usable, so callers can tell
 *          "no data" apart from "zero remaining".
 */
export function parseRateLimitHeaders(headers) {
    const get = reader(headers);

    const requestLimit = toInt(get('x-ratelimit-limit-requests') ?? get('anthropic-ratelimit-requests-limit'));
    const requestsRemaining = toInt(get('x-ratelimit-remaining-requests') ?? get('anthropic-ratelimit-requests-remaining'));
    const tokensRemaining = toInt(get('x-ratelimit-remaining-tokens') ?? get('anthropic-ratelimit-tokens-remaining'));
    const resetsAt = parseReset(get('x-ratelimit-reset-requests') ?? get('anthropic-ratelimit-requests-reset'));

    if (requestLimit === null && requestsRemaining === null && tokensRemaining === null && resetsAt === null) {
        return null;
    }
    return { requestLimit, requestsRemaining, tokensRemaining, resetsAt };
}

/**
 * Pull the daily allowance out of a Gemini 429.
 *
 * Gemini's only disclosure of a limit is the QuotaFailure block on the error itself, e.g.
 * `quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "20"`, mirrored
 * in the message as `limit: 20`. Captured live against a free-tier key.
 *
 * @returns {{limit: number|null, retryAfterMs: number|null}}
 */
export function parseQuotaFailure(error) {
    const message = error?.message || '';
    let limit = null;
    let retryAfterMs = null;

    const details = error?.errorDetails || error?.details;
    const blocks = Array.isArray(details) ? details : [];
    for (const block of blocks) {
        for (const violation of block?.violations || []) {
            const value = toInt(violation?.quotaValue);
            if (value !== null) limit = value;
        }
        const delay = parseDuration(block?.retryDelay);
        if (delay !== null) retryAfterMs = delay;
    }

    if (limit === null) {
        const match = message.match(/limit:\s*(\d+)/i);
        if (match) limit = toInt(match[1]);
    }
    if (retryAfterMs === null) {
        const match = message.match(/retry in\s+([0-9.]+)/i);
        if (match) retryAfterMs = Math.round(parseFloat(match[1]) * 1000);
    }

    return { limit, retryAfterMs };
}

/** True when the quota that was hit is a per-day one (Gemini's RPD), not a per-minute burst. */
export function isPerDayQuota(error) {
    const haystack = `${error?.message || ''} ${error?.errorDetails ? JSON.stringify(error.errorDetails) : ''}`;
    return /PerDay|per day|requests_per_day|RequestsPerDay/i.test(haystack);
}
