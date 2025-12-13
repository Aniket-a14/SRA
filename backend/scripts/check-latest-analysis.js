
import 'dotenv/config';
import prisma from '../src/config/prisma.js';

async function checkLatest() {
    try {
        const count = await prisma.user.count();
        if (count === 0) {
            console.log("No users.");
            return;
        }

        const latestAnalysis = await prisma.analysis.findFirst({
            orderBy: { createdAt: 'desc' }
        });

        if (!latestAnalysis) {
            console.log("No analysis found.");
            return;
        }

        console.log("Latest Analysis ID:", latestAnalysis.id);
        console.log("Title:", latestAnalysis.title);
        console.log("Input Text:", latestAnalysis.inputText);
        console.log("Result JSON Type:", typeof latestAnalysis.resultJson);
        console.log("Result JSON Keys:", latestAnalysis.resultJson ? Object.keys(latestAnalysis.resultJson) : "NULL");

        if (latestAnalysis.resultJson) {
            const json = latestAnalysis.resultJson;
            console.log("Entities:", json.entities?.length);
            console.log("User Stories:", json.userStories?.length);
            console.log("Functional Reqs:", json.functionalRequirements?.length);
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkLatest();
