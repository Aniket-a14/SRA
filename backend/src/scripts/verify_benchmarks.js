import dotenv from 'dotenv';
dotenv.config();

import { ProductOwnerAgent } from '../agents/ProductOwnerAgent.js';
import { ArchitectAgent } from '../agents/ArchitectAgent.js';
import { DeveloperAgent } from '../agents/DeveloperAgent.js';
import { CriticAgent } from '../agents/CriticAgent.js';
import { evalService } from '../services/evalService.js';

async function runBenchmark() {
    console.log("🚀 Starting FINAL Industry Benchmark Verification Suite\n");

    const settings = {
        projectName: "TaskFlow",
        promptVersion: "1.1.0"
    };

    const testPrompt = `
    Project: TaskFlow
    Description: I need a project management tool for small teams. It should have user authentication, 
    task creation, boards (like Trello), and automated email notifications when a task is due. 
    It must be highly secure and support real-time updates.
    `;

    try {
        const po = new ProductOwnerAgent();
        const arch = new ArchitectAgent();
        const dev = new DeveloperAgent();
        const critic = new CriticAgent();

        console.log("1. Running Product Owner Agent...");
        const poOut = await po.refineIntent(testPrompt, settings);
        if (!poOut) throw new Error("PO Output is null");

        console.log("2. Running Architect Agent...");
        // ArchitectAgent now handles the poOut directly and extracts features internally
        const archOut = await arch.designSystem(poOut, { ...settings, projectId: null });
        if (!archOut) throw new Error("Architect Output is null");

        console.log("3. Running Developer Agent (IEEE 830-1998 Generation)...");
        const srs = await dev.generateSRS(poOut, archOut, settings);
        if (!srs) throw new Error("Developer Output is null");

        console.log("4. Running Critic Agent (6Cs Audit)...");
        const audit = await critic.auditSRS(srs);

        console.log("5. Running RAG Evaluation (Faithfulness/Precision)...");
        const contextStr = typeof archOut === 'string' ? archOut : JSON.stringify(archOut);
        const ragEval = await evalService.evaluateRAG(testPrompt, contextStr, srs);

        console.log("\n================================================================");
        console.log("📊 INDUSTRY BENCHMARK RESULTS (v1.1.0 GOLD)");
        console.log("================================================================");
        console.log(`- Project Title: ${srs.projectTitle || settings.projectName}`);

        const overallScore = audit?.overallScore ?? audit?.score ?? 0;
        console.log(`- Overall Quality Score (6Cs): ${(overallScore > 1 ? overallScore : overallScore * 100).toFixed(1)}%`);

        if (audit?.scores) {
            Object.entries(audit.scores).forEach(([k, v]) => {
                console.log(`  * ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`);
            });
        }

        const faith = ragEval?.faithfulness ?? 0;
        const relevancy = ragEval?.answerRelevancy ?? 0;
        console.log(`- RAG Faithfulness: ${(faith > 1 ? faith : faith * 100).toFixed(1)}%`);
        console.log(`- Answer Relevancy: ${(relevancy > 1 ? relevancy : relevancy * 100).toFixed(1)}%`);
        console.log("================================================================");

        if (audit?.criticalIssues && audit.criticalIssues.length > 0) {
            console.log("\n⚠️  CRITICAL ISSUES DETECTED:");
            audit.criticalIssues.forEach(issue => console.log(`  - ${issue}`));
        }

        console.log("\n✅ Benchmark Suite Completed.");

    } catch (error) {
        console.error("\n❌ Benchmark Pipeline Failed:", error);
    }
}

runBenchmark();
