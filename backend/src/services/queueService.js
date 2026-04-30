import { Client } from "@upstash/qstash";
import { log } from "../middleware/logger.js";
import prisma from "../config/prisma.js";
import crypto from 'crypto';

import { isVersionConflictError, VERSION_CONFLICT_MAX_RETRIES } from '../utils/versionConflict.js';

const qstashClient = new Client({
    token: process.env.QSTASH_TOKEN,
});

const BACKEND_URL = process.env.BACKEND_URL;

export const addAnalysisJob = async (userId, text, projectId, settings, parentId = null, rootId = null) => {
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

    // 1. Create or Update the Analysis record immediately with PENDING status
    let analysis = null;
    const finalRootId = rootId || crypto.randomUUID();

    for (let attempt = 1; attempt <= VERSION_CONFLICT_MAX_RETRIES; attempt++) {
        try {
            analysis = await prisma.$transaction(async (tx) => {
                let version = 1;
                let targetId = crypto.randomUUID();
                let isPromotion = false;

                // Check if we are promoting an existing Draft-like record (Layer 1)
                if (parentId) {
                    const parent = await tx.analysis.findUnique({
                        where: { id: parentId },
                        select: { id: true, status: true, version: true, rootId: true, metadata: true }
                    });
                    
                    const isDraftState = [
                        'DRAFT', 
                        'VALIDATING', 
                        'VALIDATED', 
                        'NEEDS_FIX'
                    ].includes(parent?.status || '') || 
                    [
                        'DRAFT', 
                        'VALIDATING', 
                        'VALIDATED', 
                        'NEEDS_FIX'
                    ].includes((parent?.metadata)?.status || '');

                    if (parent && isDraftState) {
                        // REUSE the draft record for the AI job (Promotion)
                        targetId = parent.id;
                        version = parent.version; // Stay at current version (usually 1)
                        isPromotion = true;

                        // CLEANUP: Delete any newer versions in this lineage that might be blocking the view
                        // (These are usually artifacts of previous failed attempts or ghost records)
                        await tx.analysis.deleteMany({
                            where: {
                                rootId: parent.rootId || parent.id,
                                id: { not: targetId },
                                version: { gt: version }
                            }
                        });
                    }
                }

                if (!isPromotion && finalRootId) {
                    const maxVersionAgg = await tx.analysis.findFirst({
                        where: { rootId: finalRootId },
                        orderBy: { version: 'desc' },
                        select: { version: true }
                    });
                    version = (maxVersionAgg?.version || 0) + 1;
                }

                const title = `Analysis in Progress (v${version})`;
                const commonData = {
                    inputText: text,
                    resultJson: {},
                    version,
                    title,
                    rootId: finalRootId,
                    projectId,
                    status: 'PENDING',
                    metadata: {
                        trigger: 'initial',
                        source: 'ai',
                        promptSettings: settings,
                        validationResult: settings?.validationResult,
                        inputHash
                    }
                };

                if (isPromotion) {
                    return tx.analysis.update({
                        where: { id: targetId },
                        data: commonData
                    });
                } else {
                    return tx.analysis.create({
                        data: {
                            id: targetId,
                            userId,
                            ...commonData
                        }
                    });
                }
            });
            break;
        } catch (error) {
            if (isVersionConflictError(error) && attempt < VERSION_CONFLICT_MAX_RETRIES) {
                log.warn({ msg: 'Version conflict while creating queued analysis, retrying', attempt, rootId: finalRootId });
                continue;
            }
            throw error;
        }
    }

    if (!analysis) {
        throw new Error('Failed to allocate analysis version for queued job');
    }

    const newId = analysis.id;

    const payload = {
        analysisId: newId, // Pass the ID we just created
        userId,
        text,
        projectId,
        settings,
        parentId,
        rootId: finalRootId
    };

    const useMockQueue = process.env.MOCK_QSTASH === 'true';

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
                // Note: performAnalysis now handles its own status updates (e.g. reverting to DRAFT)
                // We don't need to update the status here.
            }
        })();

        return { id: newId, status: 'PENDING' };
    }

    if (!BACKEND_URL) {
        throw new Error("BACKEND_URL is not defined");
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

export const getJobStatus = async (jobId, userId) => {
    // Now we can actually query the DB!
    const analysis = await prisma.analysis.findFirst({
        where: {
            id: jobId,
            userId
        },
        select: {
            status: true,
            resultJson: true,
            id: true
        }
    });
    return analysis ? { ...analysis, result: analysis.resultJson } : { status: 'unknown' };
};
