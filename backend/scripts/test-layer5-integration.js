import 'dotenv/config';
import prisma from '../src/config/prisma.js';
import { finalizeAnalysis } from '../src/controllers/analysisController.js';
import crypto from 'crypto';

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

async function runLayer5Test() {
    console.log("--- TESTING LAYER 5 INTEGRATION (Finalization) ---");

    try {
        // 1. Setup User and Analysis
        const user = await prisma.user.create({
            data: { email: `layer5-test-${Date.now()}@test.com`, name: 'Layer 5 Tester' }
        });

        const analysis = await prisma.analysis.create({
            data: {
                userId: user.id,
                title: "To Be Finalized",
                inputText: "Some input text",
                resultJson: {
                    introduction: { scope: "Scope of the system..." },
                    systemFeatures: [
                        { name: "Feature A", functionalRequirements: ["Req 1", "Req 2"] },
                        { name: "Feature B", functionalRequirements: ["Req 3"] }
                    ],
                    nonFunctionalRequirements: {
                        security: ["Must be secure"]
                    }
                },
                version: 1,
                status: 'COMPLETED',
                isFinalized: false
            }
        });

        console.log(`Setup complete. Analysis ID: ${analysis.id}`);

        // 2. Call Finalize Controller
        const req = {
            params: { id: analysis.id },
            user: { userId: user.id }
        };
        const res = mockRes();
        const next = (err) => { throw err; };

        console.log("Calling finalizeAnalysis()...");
        await finalizeAnalysis(req, res, next);

        // 3. Verify Response
        if (!res.data || !res.data.data || res.data.data.chunksStored === undefined) {
            console.error("Full Response Data:", res.data);
            throw new Error("Response missing chunksStored count or failed.");
        }
        const chunksStored = res.data.data.chunksStored;
        console.log(`Finalized. Chunks stored according to API: ${chunksStored}`);

        // 4. Verify DB State (Atomic Check)
        const updatedAnalysis = await prisma.analysis.findUnique({ 
            where: { id: analysis.id } 
        });

        console.log("Verification - Analysis State:");
        console.log(`- isFinalized: ${updatedAnalysis.isFinalized}`);
        console.log(`- hasHeuristicSignature: ${!!updatedAnalysis.metadata?.heuristicSignature}`);

        if (!updatedAnalysis.isFinalized) throw new Error("isFinalized did not update to true");

        // 5. Verify KnowledgeChunks (Batch Check)
        const chunks = await prisma.knowledgeChunk.findMany({
            where: { sourceAnalysisId: analysis.id }
        });

        console.log(`Verification - KnowledgeChunks: Found ${chunks.length} chunks in DB.`);
        
        if (chunks.length !== res.data.data.chunksStored) {
            throw new Error(`Mismatch! API reported ${res.data.data.chunksStored} but found ${chunks.length} in DB.`);
        }

        // 6. Verify Vector Storage (Expert Check)
        // Since Prisma doesn't support 'vector' type in findMany, we check one via Raw SQL
        if (chunks.length > 0) {
            const vectorCheck = await prisma.$queryRaw`
                SELECT id, (embedding IS NOT NULL) as has_vector 
                FROM "KnowledgeChunk" 
                WHERE "sourceAnalysisId" = ${analysis.id} 
                LIMIT 1;
            `;
            console.log(`Verification - Vector Check: ${vectorCheck[0].has_vector ? "SUCCESS (Vector stored)" : "FAILURE (No vector found)"}`);
        }

        console.log("\nLayer 5 Optimization Verification: PASSED ✅");
        process.exit(0);

    } catch (e) {
        console.error("Layer 5 Error:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runLayer5Test();
