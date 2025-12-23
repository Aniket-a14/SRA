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

    // 1. Create the Analysis record immediately with PENDING status
    let finalRootId = rootId;
    let version = 1;
    const newId = crypto.randomUUID();

    // Determine version/root if needed (similar logic to what was in service, but simplified for initial creation)
    if (!finalRootId) {
        finalRootId = newId;
    } else {
        const maxVersionAgg = await prisma.analysis.findFirst({
            where: { rootId: finalRootId },
            orderBy: { version: 'desc' },
            select: { version: true }
        });
        version = (maxVersionAgg?.version || 0) + 1;
    }

    const title = `Analysis in Progress (v${version})`;

    const analysis = await prisma.analysis.create({
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

    const payload = {
        analysisId: newId, // Pass the ID we just created
        userId,
        text,
        projectId,
        settings,
        parentId,
        rootId: finalRootId
    };

    try {
        const result = await qstashClient.publishJSON({
            url: `${BACKEND_URL}/api/worker/process`,
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
        select: { status: true }
    });
    return analysis || { status: 'unknown' };
};
