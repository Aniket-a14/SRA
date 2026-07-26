import prisma from '../../config/prisma.js';
import logger from '../../config/logger.js';
import { normalizeProvider } from './index.js';

/**
 * Per-user, per-model quota bookkeeping.
 *
 * Two sources feed this, and they are not equally good:
 *
 *  - `PROVIDER` — OpenAI, Anthropic and Grok report limit/remaining/reset on every response,
 *    already correct for the key's tier. Recorded verbatim.
 *  - `COUNTED` — Gemini reports nothing at all (no usage endpoint, no rate-limit headers), so
 *    all we can do is count the calls we make and learn the ceiling from a 429. That count is
 *    a *lower bound* on real usage, because the same key may be used outside this platform.
 *
 * Every read carries its `source` so the UI can label the second kind as an estimate instead
 * of passing our arithmetic off as the provider's number.
 *
 * Nothing here is allowed to break a generation run: quota bookkeeping is an observation of
 * the call, not part of it, so every write is best-effort and swallows its own failures.
 */

/**
 * Gemini's RPD resets at midnight Pacific ("Requests per day (RPD) quotas reset at midnight
 * Pacific time" — ai.google.dev/gemini-api/docs/rate-limits), so the usage day has to be a
 * Pacific day. A UTC day would roll the counter at 5pm Pacific and report a fresh allowance
 * that the provider has not actually granted yet.
 */
export function pacificDateString(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);
}

/** The next midnight Pacific, as an absolute instant. */
export function nextPacificMidnight(now = new Date()) {
    // Find Pacific's current offset by comparing the same instant rendered in both zones,
    // which keeps this correct across DST without shipping a timezone table.
    const pacificNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const offsetMs = now.getTime() - pacificNow.getTime();

    const nextMidnightPacificWallClock = new Date(pacificNow);
    nextMidnightPacificWallClock.setHours(24, 0, 0, 0);

    return new Date(nextMidnightPacificWallClock.getTime() + offsetMs);
}

const key = (userId, provider, modelName) => ({
    userId_provider_modelName: { userId, provider: normalizeProvider(provider), modelName }
});

/**
 * Reduce a provider error to the part a person can act on.
 *
 * Gemini's message carries the whole `google.rpc` detail array inline — Help links, the
 * QuotaFailure block, RetryInfo — several hundred characters of machine payload that renders
 * in the UI as an unreadable wall. The leading sentences say what actually happened ("You
 * exceeded your current quota... limit: 20, model: x"), so keep those and drop the rest.
 * The full error is still logged; this field exists only to be displayed.
 */
export function condenseProviderError(message) {
    if (!message) return null;

    let text = String(message)
        // The structured detail array, always appended after the human sentences.
        .replace(/\s*\[\s*\{\s*"@type".*$/s, '')
        // SDK prefix and the endpoint URL add width without adding meaning.
        .replace(/^\[\w+ Error\]:\s*/i, '')
        .replace(/Error fetching from \S+:\s*/i, '')
        // Documentation pointers, which the UI links to separately if it wants them.
        .replace(/For more information on this error[^*]*/i, '')
        .replace(/To monitor your current usage[^*]*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (text.length > 300) text = `${text.slice(0, 297)}…`;
    return text || null;
}

/**
 * Note one call against a model. Records provider-reported figures when the adapter captured
 * them, and always advances our own counter so Gemini has something to show.
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {string} args.provider
 * @param {string} args.modelName
 * @param {{requestLimit: number|null, requestsRemaining: number|null,
 *          tokensRemaining: number|null, resetsAt: Date|null}|null} [args.rateLimit]
 *        parsed response headers, or null when the provider sent none
 */
export async function recordUsage({ userId, provider, modelName, rateLimit = null }) {
    if (!userId || !modelName) return;
    const today = pacificDateString();
    const normalized = normalizeProvider(provider);

    try {
        const existing = await prisma.modelQuotaState.findUnique({ where: key(userId, normalized, modelName) });
        const sameDay = existing?.usageDate === today;

        // A successful call proves the allowance is back, so any recorded exhaustion is stale.
        const cleared = { exhaustedAt: null, lastErrorText: null };

        const fromHeaders = rateLimit
            ? {
                source: 'PROVIDER',
                requestLimit: rateLimit.requestLimit ?? existing?.requestLimit ?? null,
                requestsRemaining: rateLimit.requestsRemaining,
                tokensRemaining: rateLimit.tokensRemaining,
                resetsAt: rateLimit.resetsAt
            }
            : {
                source: existing?.source === 'PROVIDER' ? 'PROVIDER' : 'COUNTED',
                // Keep the learned ceiling; only a 429 or a header can change it.
                requestLimit: existing?.requestLimit ?? null
            };

        await prisma.modelQuotaState.upsert({
            where: key(userId, normalized, modelName),
            create: {
                userId, provider: normalized, modelName,
                usageDate: today, requestsUsed: 1,
                source: fromHeaders.source,
                requestLimit: fromHeaders.requestLimit ?? null,
                requestsRemaining: fromHeaders.requestsRemaining ?? null,
                tokensRemaining: fromHeaders.tokensRemaining ?? null,
                resetsAt: fromHeaders.resetsAt ?? null
            },
            update: {
                ...fromHeaders,
                usageDate: today,
                requestsUsed: sameDay ? { increment: 1 } : 1,
                ...cleared
            }
        });
    } catch (err) {
        logger.debug({ msg: '[ModelQuota] usage write failed (non-fatal)', error: err.message });
    }
}

/**
 * Note that a model refused for quota reasons.
 *
 * @param {object} args
 * @param {number|null} [args.limit] the allowance, when the provider disclosed it
 * @param {number|null} [args.retryAfterMs]
 * @param {boolean} [args.perDay] true for a daily cap — the reset is midnight Pacific, not
 *        the short `retryDelay` Gemini also sends for its per-minute bucket
 * @param {string} [args.message] the provider's own wording, kept for display
 */
export async function recordExhausted({ userId, provider, modelName, limit = null, retryAfterMs = null, perDay = true, message = null }) {
    if (!userId || !modelName) return;
    const normalized = normalizeProvider(provider);
    const now = new Date();

    const resetsAt = perDay
        ? nextPacificMidnight(now)
        : new Date(now.getTime() + (retryAfterMs ?? 60000));

    try {
        await prisma.modelQuotaState.upsert({
            where: key(userId, normalized, modelName),
            create: {
                userId, provider: normalized, modelName,
                source: 'COUNTED',
                usageDate: pacificDateString(now),
                requestsUsed: limit ?? 0,
                requestLimit: limit,
                requestsRemaining: 0,
                exhaustedAt: now,
                resetsAt,
                lastErrorText: condenseProviderError(message)
            },
            update: {
                requestLimit: limit ?? undefined,
                requestsRemaining: 0,
                exhaustedAt: now,
                resetsAt,
                lastErrorText: condenseProviderError(message)
            }
        });
    } catch (err) {
        logger.debug({ msg: '[ModelQuota] exhaustion write failed (non-fatal)', error: err.message });
    }
}

/** True once the recorded reset instant has passed. */
const isStale = (row, now) => !row.exhaustedAt || (row.resetsAt && row.resetsAt <= now);

/**
 * Quota state for every model this user has actually used, with expired exhaustion already
 * cleared so a caller never has to reason about staleness.
 */
export async function listQuotaStates(userId) {
    if (!userId) return [];
    const now = new Date();
    const today = pacificDateString(now);

    const rows = await prisma.modelQuotaState.findMany({ where: { userId } });

    return rows.map((row) => {
        const expired = isStale(row, now);
        const isExhausted = !expired;
        const sameDay = row.usageDate === today;
        const requestsUsed = sameDay ? row.requestsUsed : 0;

        // Our tally only counts calls made through this platform, so it is a lower bound on
        // real usage — a key used elsewhere spends the same allowance invisibly. When the
        // provider has actually said the allowance is gone, that statement wins: reporting
        // "19 of 20 left" next to "out of quota" is worse than reporting nothing, because it
        // invites the user to pick a model that cannot run.
        const derived = row.requestLimit === null
            ? null
            : Math.max(0, row.requestLimit - requestsUsed);

        return {
            provider: row.provider,
            modelName: row.modelName,
            source: row.source,
            requestLimit: row.requestLimit,
            requestsRemaining: isExhausted
                ? 0
                : (row.source === 'PROVIDER' ? row.requestsRemaining : derived),
            tokensRemaining: row.source === 'PROVIDER' && !isExhausted ? row.tokensRemaining : null,
            requestsUsed,
            isExhausted,
            resetsAt: isExhausted ? row.resetsAt : null,
            lastErrorText: isExhausted ? row.lastErrorText : null
        };
    });
}

/**
 * The models this user currently cannot call, as `PROVIDER:model` keys.
 * Used to gate the picker and to refuse a run before it burns a pipeline slot.
 */
export async function listExhaustedModels(userId) {
    const states = await listQuotaStates(userId);
    return states.filter((s) => s.isExhausted).map((s) => `${s.provider}:${s.modelName}`);
}

/** Whether one specific model is currently known-exhausted. */
export async function isModelExhausted(userId, provider, modelName) {
    if (!userId || !modelName) return false;
    try {
        const row = await prisma.modelQuotaState.findUnique({ where: key(userId, provider, modelName) });
        return !!row && !isStale(row, new Date());
    } catch {
        // Never block a run because the bookkeeping table is unavailable.
        return false;
    }
}
