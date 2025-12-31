import { analyzeText } from '../src/services/aiService.js';

async function testLayer1() {
    console.log("--- TESTING LAYER 1 INTEGRATION (Structured Input) ---");

    // New Structured Input (mimicking Intake)
    const srsData = {
        introduction: {
            projectName: { content: "TodoMaster Pro" },
            content: { content: "Purpose: A simple to-do list app for professionals.\nScope: Users can create, update, delete tasks. Includes a dark mode.\nDefinitions: Task - A unit of work." }
        },
        overallDescription: {
            content: { content: "Product Perspective: Independent web application.\nUser Classes: End Users (manage tasks), Admins (manage system).\nConstraints: Must run on modern browsers." }
        },
        externalInterfaces: {
            content: { content: "User Interfaces: Clean, minimalist UI with drag-and-drop.\nCommunication: HTTPS for all data transfer." }
        },
        systemFeatures: {
            features: [
                {
                    id: "feat-1",
                    name: "Task Management",
                    description: { content: "Allow users to add, edit, and delete tasks." },
                    functionalRequirements: { content: "The system shall allow users to create a new task." },
                    stimulusResponse: { content: "Stimulus: Click 'Add Task'. Response: New task form appears." }
                }
            ]
        },
        nonFunctional: {
            content: { content: "Performance: < 200ms response time.\nSecurity: Encrypted at rest." }
        },
        other: {
            appendix: { content: "No appendix." }
        }
    };

    const textInput = JSON.stringify(srsData, null, 2);

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
        // Check for correct DISTRIBUTION of content
        // e.g., did "Purpose" from Intro get mapped to result.introduction.purpose?

        const checks = {
            "Introduction Exists": !!result.introduction,
            "Purpose Mapped": result.introduction?.purpose?.toLowerCase().includes("professional") || result.introduction?.purpose?.length > 10,
            "Scope Mapped": result.introduction?.productScope?.toLowerCase().includes("delete tasks") || !!result.introduction?.productScope,
            "Feature Preserved": result.systemFeatures?.[0]?.name === "Task Management",
            "NFRs Mapped": !!result.nonFunctionalRequirements?.performanceRequirements
        };

        console.table(checks);

        if (checks["Purpose Mapped"] && checks["Feature Preserved"]) {
            console.log("Layer 1 Verification: PASSED");
            process.exit(0);
        } else {
            console.error("Layer 1 Verification: FAILED - Content mapping issue");
            console.log("Received Intro Purpose:", result.introduction?.purpose);
            process.exit(1);
        }

    } catch (e) {
        console.error("Layer 1 Error:", e);
        process.exit(1);
    }
}

testLayer1();
