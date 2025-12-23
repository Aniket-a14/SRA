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
        if (res.data.chunksStored === undefined) {
            throw new Error("Response missing chunksStored count");
        }
        console.log(`Finalized. Chunks stored: ${res.data.chunksStored}`);

        // 4. Verify DB State
        const updatedAnalysis = await prisma.analysis.findUnique({ where: { id: analysis.id } });

        if (!updatedAnalysis.isFinalized) throw new Error("isFinalized is false");
        if (!updatedAnalysis.metadata?.heuristicSignature) throw new Error("metadata.heuristicSignature is missing");

        // 5. Verify Chunks
        const chunks = await prisma.knowledgeChunk.findMany({
            where: { sourceAnalysisId: analysis.id }
        });

        console.log(`Chunks found in DB: ${chunks.length}`);
        if (chunks.length === 0) throw new Error("No knowledge chunks created");

        // Check content of a chunk
        const featureChunk = chunks.find(c => c.type === 'FEATURE');
        if (!featureChunk) throw new Error("Feature chunk not found");

        console.log("Layer 5 Verification: PASSED");
        process.exit(0);

    } catch (e) {
        console.error("Layer 5 Error:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

runLayer5Test();
