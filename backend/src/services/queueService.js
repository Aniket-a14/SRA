import { Client } from "@upstash/qstash";
import { log } from "../middleware/logger.js";
import prisma from "../config/prisma.js";
import crypto from 'crypto';
import { createNextVersion } from './versioning.js';
import { assertWithinQuota } from './quotaService.js';
import { resolveProviderKey } from './providers/providerKeyService.js';

const qstashClient = new Client({
    token: process.env.QSTASH_TOKEN,
});

const BACKEND_URL = process.env.BACKEND_URL;

export const addAnalysisJob = async (userId, text, projectId, settings, parentId = null, rootId = null) => {
    if (!BACKEND_URL) {
        throw new Error("BACKEND_URL is not defined");
    }

    // 0. IDEMPOTENCY CHECK
    // Prevent duplicate submissions while an identical job is PENDING
    // Use a hash of the input text for efficient comparison
    const inputHash = crypto.createHash('md5').update(text).digest('hex');
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
            body: payload,
            retries: 3,
        });

        log.info({ msg: "Job sent to QStash", jobId: result.messageId, analysisId: newId });
        return { id: newId, status: 'PENDING' };
    } catch (error) {
        log.error({ msg: "Failed to send job to QStash", error: error.message });
        // Optional: Update status to FAILED if QStash fails
        await prisma.analysis.update({
            where: { id: newId },
            data: { status: 'FAILED' }
        });
        throw error;
    }
};

/**
 * Re-run a FAILED (or stale IN_PROGRESS) analysis from its last checkpoint instead of
 * starting over. Resets the row to PENDING and re-dispatches the SAME analysisId to the
 * worker; performAnalysis then loads `metadata.checkpoint` and skips the stages that
 * already completed. Ownership + BYOK key are re-validated first.
 */
export const resumeAnalysisJob = async (userId, analysisId) => {
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

    const settings = analysis.metadata?.promptSettings || {};

    // BYOK pre-flight (same rule as a fresh submit) — the platform key funds embeddings only.
    if (process.env.MOCK_AI !== 'true') {
        try {
            await resolveProviderKey(userId, settings?.modelProvider, settings?.modelName);
        } catch (keyErr) {
            keyErr.statusCode = 400; throw keyErr;
        }
    }

    // Reset to PENDING so the worker's atomic PENDING → IN_PROGRESS transition fires. The
    // checkpoint lives in metadata and is intentionally preserved here.
    await prisma.analysis.update({
        where: { id: analysisId },
        data: { status: 'PENDING', title: 'Resuming analysis…' }
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
    const result = await qstashClient.publishJSON({ url: `${baseUrl}/api/worker/process`, body: payload, retries: 3 });
    log.info({ msg: "Resume job sent to QStash", jobId: result.messageId, analysisId });
    return { id: analysisId, status: 'PENDING' };
};

/** Invalidate the cached dashboard list (mirrors analysisService's helper). */
const invalidateUserAnalysesCache = async (userId) => {
    try {
        const { getRedisClient } = await import('../config/redis.js');
        const redis = getRedisClient();
        if (redis) await redis.del(`user:analyses:${userId}`);
    } catch { /* cache invalidation is best-effort */ }
};

export const getJobStatus = async (jobId) => {
    // Now we can actually query the DB!
    const analysis = await prisma.analysis.findUnique({
        where: { id: jobId },
        select: {
            status: true,
            resultQuality: true,
            resultJson: true,
            id: true
        }
    });
    return analysis ? { ...analysis, result: analysis.resultJson } : { status: 'unknown' };
};
