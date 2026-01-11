import { repairDiagram } from '../src/services/aiService.js';
import dotenv from 'dotenv';
dotenv.config();

async function testRepair() {
    console.log("--- Testing Diagram Repair ---");

    const brokenCode = `graph TD
    A[Start] --> B(Process with spaces)
    B --> C{Decision?}
    C --|Yes| D[End]
    C --|No| B`;

    const errorMessage = "Error: Parse error on line 2:\n...--> B(Process with spaces)\n-----------------------^";

    console.log("Original Code:\n", brokenCode);
    console.log("Error Message:\n", errorMessage);
    console.log("\nCalling AI to repair...");

    try {
        const repairedCode = await repairDiagram(brokenCode, errorMessage);
        console.log("\nRepaired Code:\n", repairedCode);

        if (repairedCode.includes('["Process with spaces"]') || repairedCode.includes('("Process with spaces")')) {
            console.log("\n✅ SUCCESS: Labels are properly quoted.");
        } else {
            console.log("\n⚠️ WARNING: Check if the repair resolved the issue.");
        }
    } catch (err) {
        console.error("\n❌ FAILED:", err);
    }
}

testRepair();
