import { lintRequirements, runSemanticAudit } from '../src/services/qualityService.js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Pillar 4 Validation: Semantic Audit Test
 * Tests if the Critic Agent can detect logical contradictions 
 * and missing IEEE-830 sections that regex would miss.
 */
async function validatePillar4() {
    console.log("--- 🕵️ Pillar 4: Semantic Audit Validation ---");

    const messySRS = {
        projectTitle: "Contradictory Project",
        introduction: {
            purpose: "This system must be extremely fast and easy.", // Ambiguous
            scope: "The scope is everything." // Vague
        },
        systemFeatures: [
            {
                name: "Feature A",
                description: "The system MUST NOT require internet.",
                functionalRequirements: [
                    "Requirement 1: The system shall sync data to the cloud every 5 seconds." // LOGICAL CONTRADICTION with description
                ]
            }
        ],
        nonFunctionalRequirements: {
            performanceRequirements: ["The system should be fast."] // Not measurable
        }
    };

    console.log("\n[Step 1] Running Semantic Audit via LLM-Judge...");
    try {
        const audit = await runSemanticAudit(messySRS);
        console.log("\n[Audit Result]");
        console.log("Overall Score:", audit.overallScore);
        console.log("IEEE Compliance:", audit.ieeeCompliance.status);
        console.log("Critical Issues:", audit.criticalIssues);

        console.log("\n[Step 2] Applying Lint Requirements Logic...");
        const result = lintRequirements(messySRS, audit);
        console.log("Final Score:", result.score);

        // Validation Logic
        const foundContradiction = audit.criticalIssues.some(i =>
            i.toLowerCase().includes('contradict') ||
            i.toLowerCase().includes('internet') ||
            i.toLowerCase().includes('cloud')
        );

        if (foundContradiction) {
            console.log("\n✅ SUCCESS: LLM-Judge detected the logical contradiction!");
        } else {
            console.log("\n⚠️ WARNING: LLM-Judge did not explicitly mention the contradiction.");
        }

        if (audit.overallScore < 0.7) {
            console.log("✅ SUCCESS: Correctly gave a low score for messy requirements.");
        }

    } catch (err) {
        console.error("\n❌ TEST FAILED:", err.message);
    }
}

validatePillar4();
