import { Client } from "@upstash/qstash";
import { log } from "../middleware/logger.js";
import prisma from "../config/prisma.js";
import crypto from 'crypto';
import { createNextVersion } from './versioning.js';
import { assertWithinQuota } from './quotaService.js';
import { resolveProviderKey } from './providers/providerKeyService.js';
import { isModelExhausted } from './providers/modelQuotaService.js';

const qstashClient = new Client({
    token: process.env.QSTASH_TOKEN,
});

// Which QStash endpoint this actually resolved to.
//
// QStash is regional and there is no global router: `https://qstash.upstash.io` IS the
// eu-central-1 endpoint, and it is what the SDK falls back to when QSTASH_URL is unset. A
// us-east-1 account therefore authenticates against the wrong region by default and every
// publish fails with "user … not found in this region" — a message that reads like a bad
// credential and is not one. Setting QSTASH_URL is what picks the region; the us-east-1
// endpoint is `https://qstash-us-east-1.upstash.io`.
//
// Passing `token` alone also does not mean the SDK uses it: `resolveCredentials` only honours
// a config token verbatim when `baseUrl` is supplied alongside it. Otherwise it reads
// QSTASH_REGION and, if the matching <REGION>_QSTASH_URL / <REGION>_QSTASH_TOKEN pair exists,
// uses those instead — silently replacing the token on the line above.
//
// Both failures are invisible from our own configuration, so log the resolved endpoint once
// at boot and make it a glance rather than an excavation. The token is never logged.
log.info({
    msg: 'QStash client initialised',
    baseUrl: qstashClient.http?.baseUrl,
    region: process.env.QSTASH_REGION || 'unset (defaults to eu-central-1)',
    tokenConfigured: Boolean(process.env.QSTASH_TOKEN)
});

const BACKEND_URL = process.env.BACKEND_URL;

export const addAnalysisJob = async (userId, text, projectId, settings, parentId = null, rootId = null) => {
    if (!BACKEND_URL) {
        throw new Error("BACKEND_URL is not defined");
    }

    // 0. IDEMPOTENCY CHECK
    // Prevent duplicate submissions while an identical job is PENDING
    // Use a hash of the input text for efficient comparison
    //
    // Bumped from MD5 to SHA-256 for the same content-addressable-ID reason as the other
    // hash sites in this codebase — not because MD5 was crackable here, but to stop
    // normalizing weak cryptography as the default. This one is the exception that reads
    // its own stored value back (`equals: inputHash` below) rather than writing a fresh
    // label: a PENDING row created before this change carries an MD5 digest, so a resubmit
    // of the same text during the deploy window won't match and gets queued as a second
    // job. Bounded and self-healing — the stale PENDING row completes or expires and the
    // mismatch stops mattering — so no dual-read migration for what is, at worst, one
    // duplicate queued analysis per in-flight submission across a single deploy.
    const inputHash = crypto.createHash('sha256').update(text).digest('hex');
    const existingJob = await prisma.analysis.findFirst({
        where: {
            userId: userId,
            projectId: projectId,
            parentId: parentId, // Strict lineage check
            status: 'PENDING',
            metadata: {
                path: ['inputHash'],
                equals: inputHash
            }
        },
        select: { id: true }
    });

    if (existingJob) {
        log.info({ msg: "Returning existing PENDING job (Idempotency Hit)", analysisId: existingJob.id });
        return { id: existingJob.id, status: 'PENDING' };
    }

    // ABUSE / COST GUARD — throws a 429 (with Retry-After) if the user is over their
    // concurrency or daily quota. Runs AFTER the idempotency check so a retried identical
    // submit doesn't burn quota, and BEFORE creating the record so we never persist a job
    // the user isn't allowed to start.
    await assertWithinQuota(userId);

    // BYOK PRE-FLIGHT — generation runs on the user's own provider key (the platform
    // GEMINI_API_KEY is reserved for embeddings). Resolve it up front so a missing key
    // returns a clear 400 at submit time instead of silently creating a job that fails
    // later in the worker. Skipped under MOCK_AI, which never makes a real provider call.
    if (process.env.MOCK_AI !== 'true') {
        try {
            await resolveProviderKey(userId, settings?.modelProvider, settings?.modelName);
        } catch (keyErr) {
            keyErr.statusCode = 400;
            throw keyErr;
        }
    }

    // 1. Create the Analysis record immediately with PENDING status
    let finalRootId = rootId;
    const newId = crypto.randomUUID();

    const analysis = await prisma.$transaction(async (tx) => {
        if (!finalRootId) {
            finalRootId = newId;
            return await tx.analysis.create({
                data: {
                    id: newId,
                    userId,
                    inputText: text,
                    resultJson: {},
                    version: 1,
                    title: `Analysis in Progress (v1)`,
                    rootId: finalRootId,
                    parentId,
                    projectId,
                    status: 'PENDING',
                    metadata: {
                        trigger: 'initial',
                        source: 'ai',
                        promptSettings: settings,
                        inputHash
                    }
                }
            });
        }

        return await createNextVersion(tx, finalRootId, (version) => ({
            id: newId,
            userId,
            inputText: text,
            resultJson: {},
            version,
            title: `Analysis in Progress (v${version})`,
            rootId: finalRootId,
            parentId,
            projectId,
            status: 'PENDING',
            metadata: {
                trigger: 'initial',
                source: 'ai',
                promptSettings: settings,
                inputHash // Store hash for idempotency lookup
            }
        }));
    });

    // The dashboard list is cached for an hour and every other mutation drops that key —
    // creation was the one that did not. A new analysis therefore did not appear in the
    // sidebar or the analyses list at all until the cache aged out, which reads as the run
    // having silently vanished, and as still being missing after closing and reopening the
    // site. It has to happen here, before dispatch, so the row is visible while it runs.
    await invalidateUserAnalysesCache(userId);

    const payload = {
        analysisId: newId, // Pass the ID we just created
        userId,
        text,
        projectId,
        settings,
        parentId,
        rootId: finalRootId
    };

    const useMockQueue = process.env.MOCK_QSTASH === 'true' || process.env.NODE_ENV === 'development';

    if (useMockQueue) {
        log.info({ msg: "MOCK_QSTASH enabled: Skipping QStash publish and processing locally", analysisId: newId });
        // Asynchronously invoke the analysis logic to simulate a worker
        (async () => {
            try {
                const { performAnalysis } = await import('./analysisService.js');
                await performAnalysis(userId, text, projectId, parentId, finalRootId, settings, newId);
                log.info({ msg: "MOCK_QSTASH: Local job completed", analysisId: newId });
            } catch (error) {
                log.error({ msg: "MOCK_QSTASH: Local job failed", error: error.message, stack: error.stack });
                try {
                    await prisma.analysis.update({
                        where: { id: newId },
                        data: {
                            status: 'FAILED',
                            metadata: {
                                trigger: 'initial',
                                source: 'ai',
                                failureReason: error.message
                            }
                        }
                    });
                    await invalidateUserAnalysesCache(userId);
                } catch (updateErr) {
                    log.error({ msg: "MOCK_QSTASH: Failed to update analysis status to FAILED", error: updateErr.message });
                }
            }
        })();

        return { id: newId, status: 'PENDING' };
    }

    try {
        const baseUrl = BACKEND_URL.replace(/\/$/, "");
        const result = await qstashClient.publishJSON({
            url: `${baseUrl}/api/worker/process`,
            failureUrl: `${baseUrl}/api/worker/dlq`,
            body: payload,
            retries: 3,
        });

        log.info({ msg: "Job sent to QStash", jobId: result.messageId, analysisId: newId });
        return { id: newId, status: 'PENDING' };
    } catch (error) {
        log.error({ msg: "Failed to send job to QStash", error: error.message, analysisId: newId });
        // Record *why*, not just that it failed. This path used to write a bare `FAILED` with
        // no reason, so a dispatch outage (an expired QSTASH_TOKEN, QStash unreachable) was
        // indistinguishable in the UI from a model that ran and gave up — the actual cause was
        // only recoverable from the platform logs. The in-process path already stored a reason;
        // this one did not. The provider's raw message stays in the log because it carries
        // infrastructure identifiers that have no business being rendered to the person who
        // submitted the analysis.
        await prisma.analysis.update({
            where: { id: newId },
            data: {
                status: 'FAILED',
                metadata: {
                    ...(analysis.metadata || {}),
                    failureReason: 'Could not queue this analysis for processing. Nothing was wrong with your input — the job queue rejected the request. Retry, and if it keeps happening the queue credentials need attention.'
                }
            }
        });
        await invalidateUserAnalysesCache(userId);
        throw error;
    }
};

/**
 * Hand a partially-run analysis to a fresh worker invocation.
 *
 * Called when the pipeline yields at a stage boundary because it is out of function time
 * (see pipelineBudget.js). Unlike resumeAnalysisJob this is machine-driven and mid-flight:
 * the row deliberately stays IN_PROGRESS so the UI keeps showing a running job, and the
 * payload carries `continuation: true` so the worker's PENDING-only guard lets it back in.
 *
 * @param {object} payload - the original worker payload for this analysis
 * @param {string} stage - the stage that had just completed when the budget ran out
 */
export const enqueueContinuation = async (payload, stage) => {
    if (!BACKEND_URL) throw new Error("BACKEND_URL is not defined");

    const continuationPayload = { ...payload, continuation: true, resumedAfter: stage };

    // In-process mode has no function time limit, so a continuation should never be
    // requested there; recursing through HTTP would be wrong. Run it inline instead.
    const useMockQueue = process.env.MOCK_QSTASH === 'true' || process.env.NODE_ENV === 'development';
    if (useMockQueue) {
        log.info({ msg: "MOCK_QSTASH: continuing analysis in-process", analysisId: payload.analysisId, stage });
        const { performAnalysis } = await import('./analysisService.js');
        await performAnalysis(
            payload.userId, payload.text, payload.projectId,
            payload.parentId, payload.rootId, payload.settings, payload.analysisId
        );
        return { continued: true, inProcess: true };
    }

    const baseUrl = BACKEND_URL.replace(/\/$/, "");
    const result = await qstashClient.publishJSON({
        url: `${baseUrl}/api/worker/process`,
        body: continuationPayload,
        retries: 3
    });

    log.info({ msg: "Analysis continuation queued", analysisId: payload.analysisId, stage, jobId: result.messageId });
    return { continued: true, messageId: result.messageId };
};

/**
 * Re-run a FAILED (or stale IN_PROGRESS) analysis from its last checkpoint instead of
 * starting over. Resets the row to PENDING and re-dispatches the SAME analysisId to the
 * worker; performAnalysis then loads `metadata.checkpoint` and skips the stages that
 * already completed. Ownership + BYOK key are re-validated first.
 */
export const resumeAnalysisJob = async (userId, analysisId, modelOverride = {}) => {
    if (!BACKEND_URL) throw new Error("BACKEND_URL is not defined");

    const analysis = await prisma.analysis.findUnique({
        where: { id: analysisId },
        select: { id: true, userId: true, status: true, inputText: true, projectId: true, parentId: true, rootId: true, metadata: true }
    });

    if (!analysis) {
        const err = new Error("Analysis not found"); err.statusCode = 404; throw err;
    }
    if (analysis.userId !== userId) {
        const err = new Error("Not authorized to resume this analysis"); err.statusCode = 403; throw err;
    }
    if (!(analysis.status === 'FAILED' || analysis.status === 'IN_PROGRESS')) {
        const err = new Error(`Only a failed analysis can be resumed (current status: ${analysis.status}).`); err.statusCode = 409; throw err;
    }

    const stored = analysis.metadata?.promptSettings || {};

    // Switching model on resume is the remedy for the most common reason a run dies: the
    // selected model's daily quota ran out partway through. The checkpoint is provider-
    // agnostic — it holds finished stage *output*, not anything model-specific — so the
    // remaining stages can be completed by a different model without redoing the earlier ones.
    const settings = {
        ...stored,
        ...(modelOverride.modelProvider ? { modelProvider: modelOverride.modelProvider } : {}),
        ...(modelOverride.modelName ? { modelName: modelOverride.modelName } : {})
    };

    // BYOK pre-flight (same rule as a fresh submit) — the platform key funds embeddings only.
    if (process.env.MOCK_AI !== 'true') {
        try {
            await resolveProviderKey(userId, settings?.modelProvider, settings?.modelName);
        } catch (keyErr) {
            keyErr.statusCode = 400; throw keyErr;
        }

        // Refuse a model we already know is spent, rather than letting the run restart, burn
        // its checkpoint progress and die at the same wall.
        if (await isModelExhausted(userId, settings?.modelProvider, settings?.modelName)) {
            const err = new Error(
                `${settings.modelName} has no quota left right now. Pick a different model to resume with.`
            );
            err.statusCode = 429;
            throw err;
        }
    }

    // Reset to PENDING so the worker's atomic PENDING → IN_PROGRESS transition fires. The
    // checkpoint lives in metadata and is intentionally preserved here. The chosen model is
    // persisted so the worker (and any later resume) uses it rather than the original.
    await prisma.analysis.update({
        where: { id: analysisId },
        data: {
            status: 'PENDING',
            title: 'Resuming analysis…',
            metadata: { ...(analysis.metadata || {}), promptSettings: settings }
        }
    });
    await invalidateUserAnalysesCache(userId);

    const payload = {
        analysisId,
        userId,
        text: analysis.inputText,
        projectId: analysis.projectId,
        settings,
        parentId: analysis.parentId,
        rootId: analysis.rootId
    };

    const useMockQueue = process.env.MOCK_QSTASH === 'true' || process.env.NODE_ENV === 'development';
    if (useMockQueue) {
        log.info({ msg: "MOCK_QSTASH: Resuming analysis locally", analysisId });
        (async () => {
            try {
                const { performAnalysis } = await import('./analysisService.js');
                // Worker normally does the PENDING → IN_PROGRESS flip; do it here for the mock path.
                await prisma.analysis.updateMany({ where: { id: analysisId, userId, status: 'PENDING' }, data: { status: 'IN_PROGRESS' } });
                await performAnalysis(userId, analysis.inputText, analysis.projectId, analysis.parentId, analysis.rootId, settings, analysisId);
            } catch (error) {
                log.error({ msg: "MOCK_QSTASH: Resume failed", error: error.message });
            }
        })();
        return { id: analysisId, status: 'PENDING' };
    }

    const baseUrl = BACKEND_URL.replace(/\/$/, "");
    try {
        const result = await qstashClient.publishJSON({ url: `${baseUrl}/api/worker/process`, body: payload, retries: 3 });
        log.info({ msg: "Resume job sent to QStash", jobId: result.messageId, analysisId });
    } catch (error) {
        // The row was flipped FAILED → PENDING above so the worker's atomic PENDING →
        // IN_PROGRESS guard would fire. If the dispatch itself fails there is no worker
        // coming, and leaving it PENDING is worse than where it started: the analysis sits
        // there looking queued until the reconciliation sweep, and the resume control is gone
        // because that only offers itself for FAILED or IN_PROGRESS. Put it back to FAILED so
        // the row stays honest and the user keeps the one action that can recover it.
        log.error({ msg: "Failed to send resume job to QStash", error: error.message, analysisId });
        await prisma.analysis.update({
            where: { id: analysisId },
            data: {
                status: 'FAILED',
                metadata: {
                    ...(analysis.metadata || {}),
                    promptSettings: settings,
                    failureReason: 'Could not queue this analysis for processing. Nothing was wrong with your input — the job queue rejected the request. Retry, and if it keeps happening the queue credentials need attention.'
                }
            }
        });
        await invalidateUserAnalysesCache(userId);
        throw error;
    }
    return { id: analysisId, status: 'PENDING' };
};

/** Invalidate the cached dashboard list (mirrors analysisService's helper). */
const invalidateUserAnalysesCache = async (userId) => {
    try {
        const { getRedisClient } = await import('../config/redis.js');
        const redis = getRedisClient();
        if (redis) await redis.del(`user:analyses:v2:${userId}`);
    } catch { /* cache invalidation is best-effort */ }
};

/**
 * Poll a job's status and, once finished, its result.
 *
 * `userId` is required and filtered in the query. This looked up the row by id alone, and
 * the row it returns carries `resultJson` — the entire generated SRS. Any authenticated
 * caller who had an analysis id could therefore read another user's whole document through
 * the polling endpoint, while every other read path (`getAnalysisById`) checked ownership.
 * Analysis ids are not a secret: they sit in URLs, in `sra.config.json`, and in the
 * traceability records the CLI publishes.
 *
 * An id belonging to someone else is reported as `unknown`, exactly like an id that does
 * not exist — a "not yours" answer would still confirm the id is real.
 */
export const getJobStatus = async (jobId, userId) => {
    if (!userId) throw new Error('getJobStatus requires a userId');

    const analysis = await prisma.analysis.findFirst({
        where: { id: jobId, userId },
        select: {
            status: true,
            resultQuality: true,
            resultJson: true,
            id: true
        }
    });
    return analysis ? { ...analysis, result: analysis.resultJson } : { status: 'unknown' };
};
