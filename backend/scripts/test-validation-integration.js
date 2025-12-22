import { validateRequirements } from '../src/services/validationService.js';

async function testValidation() {
    console.log("--- TESTING VALIDATION SERVICE (Layer 2 Gatekeeper) ---");

    // Sample data to validate
    const srsData = {
        projectTitle: "Test Project",
        introduction: {
            purpose: "This is a test purpose." // Likely too short, should trigger a warning
        },
        systemFeatures: [
            {
                name: "Add Task",
                functionalRequirements: ["The system shall add tasks."]
            }
        ]
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
