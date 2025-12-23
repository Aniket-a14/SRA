import { analyzeText } from '../src/services/aiService.js';

async function testLayer1() {
    console.log("--- TESTING LAYER 1 INTEGRATION (Raw Text Input) ---");
    const textInput = "I want a To-Do List app where users can add tasks, delete tasks, and mark them as done. It should be a web app.";

    try {
        const result = await analyzeText(textInput, {
            modelName: 'gemini-2.5-flash-lite',
            profile: 'default'
        });

        if (result.success === false) {
            console.error("AI FAILED:", result.error);
            return;
        }

        console.log("--- RESULT RECEIVED ---");
        // Check for key sections expected in Layer 1 output (Initial Analysis)
        const checks = {
            "Introduction": !!result.introduction,
            "Purpose": !!result.introduction?.purpose,
            "System Features": !!result.systemFeatures && result.systemFeatures.length > 0,
            "Feature Name": result.systemFeatures?.[0]?.name ? result.systemFeatures[0].name : "MISSING"
        };

        console.table(checks);

        if (checks["Introduction"] && checks["System Features"]) {
            console.log("Layer 1 Verification: PASSED");
            process.exit(0);
        } else {
            console.error("Layer 1 Verification: FAILED - Missing sections");
            process.exit(1);
        }

    } catch (e) {
        console.error("Layer 1 Error:", e);
        process.exit(1);
    }
}

testLayer1();
