import 'dotenv/config';
process.env.MOCK_AI = 'true';
process.env.MOCK_QSTASH = 'true';

import prisma from '../src/config/prisma.js';
import { regenerate } from '../src/controllers/analysisController.js';
import { getJobStatus } from '../src/services/queueService.js';

// Mock Response Object
const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

// Helper: Wait for Job
async function waitForJob(jobId) {
    console.log(`Waiting for job ${jobId}...`);
    let attempts = 0;
    while (attempts < 20) {
        const status = await getJobStatus(jobId);
        if (status?.status === 'COMPLETED' || status?.status === 'completed') {
            return status;
        }
        if (status?.status === 'FAILED' || status?.status === 'failed') {
            throw new Error(`Job failed: ${status.error}`);
        }
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
    }
    throw new Error("Timeout waiting for job");
}

async function runLayer4Test() {
    console.log("--- TESTING LAYER 4 INTEGRATION (Regeneration) ---");

    try {
        // 1. Setup User and Analysis (V1)
        const user = await prisma.user.create({
            data: { email: `layer4-test-${Date.now()}@test.com`, name: 'Layer 4 Tester' }
        });

        const v1 = await prisma.analysis.create({
            data: {
                userId: user.id,
                title: "V1 Original",
                inputText: "Original requirements",
                resultJson: { introduction: { purpose: { content: "Original Purpose" } } },
                version: 1,
                status: 'COMPLETED',
                id: crypto.randomUUID(), // Explicit ID for root tracking
                rootId: null // Will update self
            }
        });

        // Fix rootId to be self
        await prisma.analysis.update({
            where: { id: v1.id },
            data: { rootId: v1.id }
        });

        console.log(`Setup complete. V1 ID: ${v1.id}`);

        // 2. Call Regenerate Controller
        const req = {
            params: { id: v1.id },
            body: {
                affectedSections: ['introduction'],
                improvementNotes: "Make the purpose more formal.",
                force: false
            },
            user: { userId: user.id }
        };
        const res = mockRes();
        const next = (err) => { throw err; };

        console.log("Calling regenerate()...");
        await regenerate(req, res, next);

        // 3. Verify Response
        if (res.statusCode !== 202) {
            throw new Error(`Expected 202 Accepted, got ${res.statusCode}`);
        }
        if (!res.data.jobId) {
            throw new Error("No jobId returned");
        }
        console.log("Regeneration queued. Job ID:", res.data.jobId);

        // 4. Wait for Job
        await waitForJob(res.data.jobId);

        // 5. Verify V2 Creation
        // The job ID is the Analysis ID in the new flow
        const v2 = await prisma.analysis.findUnique({ where: { id: res.data.jobId } });

        if (!v2) throw new Error("V2 Analysis not found after job completion");
        console.log(`V2 Created. Version: ${v2.version}, Root: ${v2.rootId}, Parent: ${v2.parentId}`);

        if (v2.version !== 2) throw new Error("Expected Version 2");
        if (v2.parentId !== v1.id) throw new Error("Expected parent to be V1");
        if (v2.rootId !== v1.id) throw new Error("Expected root to be V1");

        console.log("Layer 4 Verification: PASSED");
        process.exit(0);

    } catch (e) {
        console.error("Layer 4 Error:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Need crypto for UUID generation in setup
import crypto from 'crypto';

runLayer4Test();
