import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend/ directory
dotenv.config({ path: path.join(__dirname, '../.env') });

import { validateRequirements } from '../src/services/validationService.js';

async function testClarification() {
    console.log("=== LAYER 2 CLARIFICATION CHECK ===");

    // Scenario: Vague Input
    const vagueInput = {
        details: {
            projectName: { content: "FastTracker" },
            fullDescription: { content: "A super fast tracking system for users." }
        },
        systemFeatures: []
    };

    console.log("\n--- TEST: Vague Input (EXPECT CLARIFICATION_REQUIRED) ---");
    try {
        const result = await validateRequirements(vagueInput);
        console.log("Status:", result.validation_status);

        if (result.validation_status === 'CLARIFICATION_REQUIRED') {
            console.log("✅ PASSED: System requested clarification.");
            console.log("Questions:", result.clarification_questions);
        } else {
            console.log("❌ FAILED: Expected CLARIFICATION_REQUIRED, got", result.validation_status);
            console.log("Issues:", result.issues);
        }

        if (result.issues && result.issues.length > 0) {
            if (result.issues[0].id) {
                console.log("✅ PASSED: Issues have IDs (Fix for React Key Warning). ID ex:", result.issues[0].id);
            } else {
                console.log("❌ FAILED: Issues do NOT have IDs.");
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testClarification();
