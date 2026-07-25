import prisma from '../config/prisma.js';
import { ErrorCodes } from '../utils/errorCodes.js';

/**
 * Per-user abuse / cost controls for AI analysis runs.
 *
 * These limits originally protected a shared platform Gemini quota, which is why the
 * concurrency cap was as low as 3. That rationale is gone: generation is BYOK on every
 * provider, so a user's runs spend only their own key's quota and cannot affect anyone
 * else. The remaining purpose is narrower — stop a runaway client from queueing work
 * without bound — so concurrency is set to let people work across several projects at once
 * (the way any chat product allows) while still catching a submit loop.
 *
 * Counted directly off the Analysis table (cheap given @@index([userId]) +
 * @@index([status])) — no extra counter table to keep consistent.
 *
 * Tunable via env; set either to 0 to disable that check. Enforcement is skipped in the
 * test environment so the suite stays deterministic.
 */

const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

export const MAX_CONCURRENT_ANALYSES = num(process.env.MAX_CONCURRENT_ANALYSES, 10);
export const MAX_DAILY_ANALYSES = num(process.env.MAX_DAILY_ANALYSES, 50);

const quotaError = (message, retryAfter) => {
    const err = new Error(message);
    err.statusCode = 429;
    err.code = ErrorCodes.RATE_LIMIT_EXCEEDED;
    if (retryAfter) err.retryAfter = retryAfter;
    return err;
};

/**
 * Throws a 429 (with Retry-After) if the user is over their concurrency or daily quota.
 * Call before creating a new analysis job. DRAFT rows (Layer 1 wizard state, no AI) are
 * excluded from the daily count since they don't consume model calls.
 *
 * @param {string} userId
 */
export async function assertWithinQuota(userId) {
    if (process.env.NODE_ENV === 'test') return;

    if (MAX_CONCURRENT_ANALYSES > 0) {
        const active = await prisma.analysis.count({
            where: { userId, status: { in: ['PENDING', 'IN_PROGRESS'] } }
        });
        if (active >= MAX_CONCURRENT_ANALYSES) {
            throw quotaError(
                `You already have ${active} analysis${active === 1 ? '' : 'es'} in progress. Wait for one to finish before starting another.`,
                60
            );
        }
    }

    if (MAX_DAILY_ANALYSES > 0) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const todayCount = await prisma.analysis.count({
            where: { userId, status: { not: 'DRAFT' }, createdAt: { gte: since } }
        });
        if (todayCount >= MAX_DAILY_ANALYSES) {
            throw quotaError(
                `You've reached the limit of ${MAX_DAILY_ANALYSES} analyses in 24 hours. Please try again later.`,
                3600
            );
        }
    }
}
