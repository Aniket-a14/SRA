import { lintRequirements } from '../src/services/qualityService.js';
import { CriticAgent } from '../src/agents/CriticAgent.js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Pillar 4 manual eval (paid, real LLM call): can the Critic catch a logical contradiction
 * and score an obviously weak SRS low?
 *
 *   node tests/pillar4_semantic.validator.js
 *
 * The key is passed explicitly. This used to go through qualityService.runSemanticAudit,
 * which built a CriticAgent with no key and so ran on the platform's shared Gemini client.
 * Pick the provider with EVAL_PROVIDER / EVAL_API_KEY / EVAL_MODEL; by default it uses
 * GEMINI with GEMINI_API_KEY and GEMINI_MODEL_NAME, i.e. the developer's own key.
 * Exits 1 when the eval fails, so it can gate a release.
 */
const SCORE_CEILING = 70; // overallScore is 0-100; a document this weak must land below it

async function validatePillar4() {
    console.log("--- Pillar 4: Semantic Audit Validation ---");

    const providerConfig = {
        provider: process.env.EVAL_PROVIDER || 'GEMINI',
        apiKey: process.env.EVAL_API_KEY || process.env.GEMINI_API_KEY,
        modelName: process.env.EVAL_MODEL || undefined
    };
    if (!providerConfig.apiKey) {
        console.error("No key: set EVAL_API_KEY (or GEMINI_API_KEY for the default provider).");
        process.exit(1);
    }

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
                    "Requirement 1: The system shall sync data to the cloud every 5 seconds." // Contradicts the description
                ]
            }
        ],
        nonFunctionalRequirements: {
            performanceRequirements: ["The system should be fast."] // Not measurable
        }
    };

    const audit = await new CriticAgent(providerConfig).auditSRS(null, messySRS);
    console.log("Overall Score:", audit.overallScore);
    console.log("Critical Issues:", audit.criticalIssues);
    console.log("Lint score:", lintRequirements(messySRS, audit).score);

    const issues = (audit.criticalIssues || []).map((i) => String(i).toLowerCase());
    const foundContradiction = issues.some((i) => /contradict|internet|cloud|offline/.test(i));
    const scoredLow = Number(audit.overallScore) < SCORE_CEILING;

    console.log(foundContradiction ? "PASS contradiction detected" : "FAIL contradiction not mentioned");
    console.log(scoredLow ? `PASS score below ${SCORE_CEILING}` : `FAIL score not below ${SCORE_CEILING}`);
    process.exit(foundContradiction && scoredLow ? 0 : 1);
}

validatePillar4().catch((err) => {
    console.error("EVAL ERRORED:", err.message);
    process.exit(1);
});
