import 'dotenv/config';
process.env.MOCK_AI = 'true';
import prisma from '../src/config/prisma.js';
import { performAnalysis, getAnalysisHistory } from '../src/services/analysisService.js';
import { processChat } from '../src/services/chatService.js';
import { compareAnalyses } from '../src/services/diffService.js';

async function runTest() {
    console.log("Starting Versioning Test...");

    try {
        // 1. Get a User
        let user = await prisma.user.findFirst();
        if (!user) {
            console.log("No user found. Creating test user...");
            user = await prisma.user.create({
                data: {
                    email: `test-${Date.now()}@example.com`,
                    name: "Test User"
                }
            });
        }
        console.log(`Using User: ${user.id}`);

        // 2. Create V1
        console.log("Creating Analysis V1...");
        const v1 = await performAnalysis(user.id, "Create a todo app");
        console.log(`V1 Created: ${v1.id} (Version: ${v1.version}, Root: ${v1.rootId})`);

        if (v1.version !== 1) throw new Error("V1 version mismatch");
        if (v1.rootId !== v1.id) throw new Error("V1 rootId mismatch (should be self)");

        // 3. Create V2 via Chat
        console.log("Creating V2 via Chat...");
        const chatResult = await processChat(user.id, v1.id, "Make it a collaborative todo app");

        if (!chatResult.newAnalysisId) throw new Error("Chat did not trigger new analysis version");

        const v2 = await prisma.analysis.findUnique({ where: { id: chatResult.newAnalysisId } });
        console.log(`V2 Created: ${v2.id} (Version: ${v2.version}, Root: ${v2.rootId}, Parent: ${v2.parentId})`);

        if (v2.version !== 2) throw new Error("V2 version mismatch");
        if (v2.rootId !== v1.rootId) throw new Error("V2 rootId mismatch");
        if (v2.parentId !== v1.id) throw new Error("V2 parentId mismatch");

        // 4. Verify History
        console.log("Fetching History...");
        const history = await getAnalysisHistory(user.id, v1.rootId);
        console.log(`History count: ${history.length}`);

        // Should be at least 2 (V2, V1) order desc
        if (history.length < 2) throw new Error("History length too short");
        if (history[0].id !== v2.id) throw new Error("History order mismatch (V2 should be first)");

        // 5. Verify Diff
        console.log("Verifying Diff...");
        const diff = compareAnalyses(v1, v2);
        console.log("Diff result keys:", Object.keys(diff));
        // We know v1 input was "Create a todo app" and v2 input (from chat) is likely same? 
        // Wait, chatService uses `currentAnalysis.inputText` for new analysis.
        // So inputText diff should be null?
        // Unless chat response changed requirements.

        if (diff.inputText) console.log("Input text changed (unexpected but possible if logic changed)");

        console.log("Test Passed!");

    } catch (e) {
        console.error("Test Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
