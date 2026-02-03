import { Client } from "@upstash/qstash";
import { log } from "../middleware/logger.js";
import prisma from "../config/prisma.js";
import crypto from 'crypto';

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
    const existingJob = await prisma.analysis.findFirst({
        where: {
            userId: userId,
            projectId: projectId,
            parentId: parentId, // Strict lineage check
            status: 'PENDING',
            // Check text match using a simple hash check on metadata or directly on content?
            // Since we don't store text hash in a column, we can rely on PENDING + inputs.
            // But let's verify text content matches too (expensive but safe).
            inputText: text
        },
        select: { id: true }
    });

    if (existingJob) {
        log.info({ msg: "Returning existing PENDING job (Idempotency Hit)", analysisId: existingJob.id });
        return { id: existingJob.id, status: 'PENDING' };
    }

    // 1. Create the Analysis record immediately with PENDING status
    let finalRootId = rootId;
    let version = 1;
    const newId = crypto.randomUUID();

    const analysis = await prisma.$transaction(async (tx) => {
        // Determine version/root if needed (ATOMICALLY)
        if (!finalRootId) {
            finalRootId = newId;
        } else {
            const maxVersionAgg = await tx.analysis.findFirst({
                where: { rootId: finalRootId },
                orderBy: { version: 'desc' },
                select: { version: true }
            });
            version = (maxVersionAgg?.version || 0) + 1;
        }

        const title = `Analysis in Progress (v${version})`;

        return await tx.analysis.create({
            data: {
                id: newId,
                userId,
                inputText: text,
                resultJson: {}, // Empty initially
                version,
                title,
                rootId: finalRootId,
                parentId,
                projectId,
                status: 'PENDING',
                metadata: {
                    trigger: 'initial',
                    source: 'ai',
                    promptSettings: settings
                }
            }
        });
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
                log.error({ msg: "MOCK_QSTASH: Local job failed", error: error.message });
                await prisma.analysis.update({
                    where: { id: newId },
                    data: { status: 'FAILED' }
                });
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

export const getJobStatus = async (jobId) => {
    // Now we can actually query the DB!
    const analysis = await prisma.analysis.findUnique({
        where: { id: jobId },
        select: {
            status: true,
            resultJson: true,
            id: true
        }
    });
    return analysis ? { ...analysis, result: analysis.resultJson } : { status: 'unknown' };
};
