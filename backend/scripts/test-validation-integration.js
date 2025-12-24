import { validateRequirements } from '../src/services/validationService.js';

async function testValidation() {
    console.log("--- TESTING VALIDATION SERVICE (Layer 2 Gatekeeper) ---");

    // 2. Test Case: Semantic Mismatch (Hard Conflict)
    console.log("\n[TEST] 2. Domain Drift (Banking vs Pizza)");
    const srsDataMismatch = {
        projectTitle: "FinTech Pro",
        introduction: {
            purpose: { content: "A secure banking application for personal finance management." }
        },
        systemFeatures: {
            features: [
                {
                    name: "Order Pizza",
                    description: { content: "The user shall be able to order a pepperoni pizza from the dashboard." },
                    rawInput: "I want to order pizza"
                }
            ]
        }
    };

    try {
        const result = await validateRequirements(srsDataMismatch);
        const hasConflict = result.issues.some(i => i.conflict_type === 'HARD_CONFLICT' || i.issue_type === 'SEMANTIC_MISMATCH');
        if (hasConflict) {
            console.log("✅ SUCCESS: Detected Domain Drift (Semantic Mismatch)");
            console.table(result.issues.filter(i => i.conflict_type));
        } else {
            console.log("❌ FAIL: Did not detect domain drift");
            console.log("Issues:", result.issues);
        }
    } catch (e) { console.error(e); }

    // 1. Test Case: Vague Input
    const srsData = {
        projectTitle: "Test Project",
        introduction: {
            purpose: { content: "This is a test purpose." }
        },
        systemFeatures: {
            features: [
                {
                    name: "Add Task",
                    functionalRequirements: { content: "The system shall be fast." }, // Vague
                    rawInput: "Make it fast"
                }
            ]
        }
    };

    try {
        console.log("Sending data to validation service...");
        const result = await validateRequirements(srsData);

        console.log("--- RESULT RECEIVED ---");
        console.log("Validation Status:", result.validation_status);
        console.log("Issues Found:", result.issues?.length || 0);

        if (result.issues && result.issues.length > 0) {
            console.table(result.issues.map(i => ({
                Title: i.title,
                Type: i.issue_type,
                Severity: i.severity,
                Description: i.description
            })));
        }

        if (result.validation_status === "PASS" || result.validation_status === "FAIL") {
            console.log("Validation Service Verification: PASSED (Result structure is correct)");
        } else {
            console.error("Validation Service Verification: FAILED - Missing status");
        }

    } catch (e) {
        console.error("Validation Error:", e);
    }
}

testValidation();
