import { analyzeText } from '../src/services/aiService.js';

const INTAKE_Layer1_DATA = {
    introduction: {
        purpose: { content: "Purpose: The System is a To-Do List app. Users can add tasks.", metadata: { section_id: '1' } },
        scope: { content: "Scope: Web only. No mobile app yet.", metadata: { section_id: '1' } }
    },
    systemFeatures: {
        features: [
            {
                id: "feat-1",
                name: "Add Task",
                description: { content: "User enters task name and clicks Add. Priority: High", metadata: { section_id: '4' } },
                stimulusResponse: { content: "Stimulus: Click Add. Response: Task appears in list.", metadata: { section_id: '4' } },
                functionalRequirements: { content: "The system shall add the task to the database.", metadata: { section_id: '4' } }
            }
        ]
    }
};

async function testLayer3() {
    console.log("--- TESTING LAYER 3 INTEGRATION ---");
    const textInput = JSON.stringify(INTAKE_Layer1_DATA, null, 2);

    try {
        const result = await analyzeText(textInput, {
            modelName: 'gemini-2.5-flash-lite',
            profile: 'default'
        });

        if (result.success === false) { // Check specific failure flag
            console.error("AI FAILED:", result.error);
            console.error("RAW OUTPUT:", result.raw);
            process.exit(1);
            return;
        }

        console.log("--- RESULT RECEIVED ---");
        if (!result.introduction) {
            console.error("FAIL: Introduction missing");
        } else {
            console.log("CHECK: Introduction Purpose:", result.introduction.purpose.substring(0, 50) + "...");
            console.log("CHECK: Generated Document Conventions:", result.introduction.documentConventions ? "PRESENT" : "MISSING");
            console.log("CHECK: Generated Audience:", result.introduction.intendedAudience ? "PRESENT" : "MISSING");
        }

        console.log("CHECK: Generated Glossary:", result.glossary ? "PRESENT" : "MISSING");
        console.log("CHECK: Generated Analysis Models:", result.appendices?.analysisModels ? "PRESENT" : "MISSING");

        process.exit(0);

    } catch (e) {
        console.error("Layer 3 Error:", e);
        process.exit(1);
    }
}

testLayer3();
