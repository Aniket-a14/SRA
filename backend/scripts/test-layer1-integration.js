import 'dotenv/config'; // Load env vars
console.log("DEBUG: Script started");
process.env.MOCK_AI = 'true'; // Force Mock Mode for Integration Test
import { analyzeText } from '../src/services/aiService.js';

async function testLayer1() {
    console.log("--- TESTING LAYER 1 INTEGRATION (Unified Monolithic Input) ---");

    // Unified Input (mimicking Single-Field Intake)
    const srsData = {
        details: {
            projectName: { content: "Test Project Unified", metadata: { section_id: "1", subsection_id: "1.1", domain_type: "web", is_required: true, completion_status: "complete" } },
            fullDescription: { content: "This is a test project description for the unified intake system.", metadata: { section_id: "1", subsection_id: "1.2", domain_type: "web", is_required: true, completion_status: "complete" } }
        }
    };

    // Simulate Controller Logic (Layer 2 Tokenization)
    const projectName = srsData.details.projectName.content;
    const fullDesc = srsData.details.fullDescription.content;
    const combinedText = `Project: ${projectName}\n\nDescription:\n${fullDesc}`;
    const wordArray = combinedText.split(/\s+/).filter(word => word.length > 0);

    // Payload to AI is the array directly
    const textInput = JSON.stringify(wordArray);

    try {
        console.log("Sending Payload...");
        const result = await analyzeText(textInput, {
            modelName: 'gemini-2.5-flash-lite',
            profile: 'default'
        });

        if (result.success === false) {
            console.error("AI FAILED:", result.error);
            return;
        }

        console.log("--- RESULT RECEIVED ---");

        const checks = {
            "Introduction Exists": !!result.introduction,
            "Purpose Extracted": result.introduction?.purpose?.toLowerCase().includes("social media") || false,
            "Features Extracted": (result.systemFeatures?.length || 0) >= 2,
            "Specific Feature Found": result.systemFeatures?.some(f => f.name.includes("Scheduling")) || false,
            "NFR Extracted": result.securityRequirements?.length > 0 || result.nonFunctionalRequirements?.securityRequirements?.length > 0,
            "Exact Title Maintained": result.projectTitle === "Test Project Unified"
        };

        console.table(checks);

        if (checks["Purpose Extracted"] && checks["Specific Feature Found"] && checks["Exact Title Maintained"]) {
            console.log("Layer 1 Verification: PASSED - Monolithic input successfully unbundled.");
            process.exit(0);
        } else {
            console.error("Layer 1 Verification: FAILED - AI failed to distribute content.");
            console.log("Full Result Intro:", result.introduction);
            console.log("Full Result Features:", result.systemFeatures);
            process.exit(1);
        }

    } catch (e) {
        console.error("Layer 1 Error:", e);
        process.exit(1);
    }
}

testLayer1();
