import { genAI } from "../src/config/gemini.js";
import { CHAT_PROMPT } from "../src/utils/prompts.js";

// Mock Data representing Layer 1 output (Initial Analysis)
const MOCK_ANALYSIS_JSON = {
    projectTitle: "To-Do App",
    introduction: { purpose: "Task management." },
    systemFeatures: [
        { name: "Add Task", description: "User adds a task." }
    ]
};

async function testLayer2() {
    console.log("--- TESTING LAYER 2 INTEGRATION (Chat Refinement) ---");
    const userMessage = "Please add a feature for Dark Mode.";

    // Construct Prompt similar to chatService.js
    const fullPrompt = `
${CHAT_PROMPT}
${JSON.stringify(MOCK_ANALYSIS_JSON, null, 2)}

CHAT HISTORY:
User: ${userMessage}
`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); // Use lite for speed/cost if available, or fallback
        console.log("Sending refinement request to AI...");
        const result = await model.generateContent(fullPrompt);
        let outputText = result.response.text();

        // Clean markdown
        outputText = outputText.replace(/```json/g, "").replace(/```/g, "").trim();

        const parsed = JSON.parse(outputText);

        console.log("--- RESULT RECEIVED ---");

        // Verification Checks
        const checks = {
            "Valid JSON": !!parsed,
            "Has Reply": !!parsed.reply,
            "Has Updated Analysis": !!parsed.updatedAnalysis,
            "Feature Added": !!parsed.updatedAnalysis?.systemFeatures?.some(f => f.name.toLowerCase().includes("dark mode"))
        };

        console.table(checks);

        if (checks["Has Updated Analysis"] && checks["Feature Added"]) {
            console.log("Layer 2 Verification: PASSED");
            process.exit(0);
        } else {
            console.error("Layer 2 Verification: FAILED - Dark Mode feature not found or analysis not updated.");
            console.log("AI Reply:", parsed.reply);
            process.exit(1);
        }

    } catch (e) {
        console.error("Layer 2 Error:", e);
        process.exit(1);
    }
}

testLayer2();
