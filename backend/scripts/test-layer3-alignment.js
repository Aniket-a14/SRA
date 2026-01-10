import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend/ directory
dotenv.config({ path: path.join(__dirname, '../.env') });

import { checkAlignment } from '../src/services/qualityService.js';

async function testLayer3() {
    console.log("=== LAYER 3 ALIGNMENT CHECK ===");

    const originalInput = {
        projectName: "FinTech Pro",
        rawText: "A secure banking application for transfers and savings."
    };

    const validationContext = {
        domain: "Fintech / Banking",
        purpose: "Manage user funds and transfers securely."
    };

    // Scenario 1: ALIGNED
    console.log("\n--- TEST 1: Aligned Content ---");
    const alignedSRS = {
        systemFeatures: [
            { name: "Fund Transfer", description: "Allow users to send money." }
        ]
    };
    const result1 = await checkAlignment(originalInput, validationContext, alignedSRS);
    console.log("Result 1:", result1.status);
    if (result1.status === 'ALIGNED') console.log("✅ PASSED");
    else console.log("❌ FAILED:", result1.mismatches);


    // Scenario 2: MISMATCH (Scope Creep)
    console.log("\n--- TEST 2: Scope Creep (Pizza Delivery) ---");
    const mismatchSRS = {
        systemFeatures: [
            { name: "Pizza Ordering", description: "Order pepperoni pizza to bank branch." }
        ]
    };
    const result2 = await checkAlignment(originalInput, validationContext, mismatchSRS);
    console.log("Result 2:", result2.status);

    if (result2.status === 'MISMATCH_DETECTED') {
        console.log("✅ PASSED: Detected Mismatch.");
        console.log("Details:", result2.mismatches);
    } else {
        console.log("❌ FAILED: Implementation missed the scope creep.");
    }
}

testLayer3();
