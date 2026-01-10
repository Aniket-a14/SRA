import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend/ directory (one level up from scripts/)
dotenv.config({ path: path.join(__dirname, '../.env') });

import { validateRequirements } from '../src/services/validationService.js';

async function testLayer2() {
    console.log("=== LAYER 2 VALIDATION CHECK ===");

    // Scenario 1: Hard Conflict (Banking vs Pizza)
    const bankingWithPizza = {
        details: {
            projectName: { content: "SafeBank Mobile" },
            fullDescription: { content: "A secure mobile banking application for managing personal finances, transfers, and savings." }
        },
        systemFeatures: [
            {
                name: "Pepperoni Order",
                description: "User can order a pepperoni pizza from the dashboard.",
                functionalRequirements: ["System shall contact local pizzeria."]
            }
        ]
    };

    console.log("\n--- TEST 1: Banking App with Pizza Feature (EXPECT BLOCKER/FAIL) ---");
    try {
        const result1 = await validateRequirements(bankingWithPizza);
        console.log("Result 1 Status:", result1.validation_status);
        console.dir(result1.issues, { depth: null });

        if (result1.validation_status === 'FAIL' && result1.issues.some(i => i.severity === 'BLOCKER')) {
            console.log("✅ PASSED: Correctly blocked domain mismatch.");
        } else {
            console.log("❌ FAILED: Did not block domain mismatch.");
        }
    } catch (e) {
        console.error("Error in Test 1:", e);
    }

    // Scenario 2: Valid Banking App
    const validBanking = {
        details: {
            projectName: { content: "SafeBank Mobile" },
            fullDescription: { content: "A secure mobile banking application for managing personal finances, transfers, and savings." }
        },
        systemFeatures: [
            {
                name: "Transfer Funds",
                description: "User can transfer money to other accounts.",
                functionalRequirements: ["System shall validate balance.", "System shall execute transfer."]
            }
        ]
    };

    console.log("\n--- TEST 2: Valid Banking App (EXPECT PASS) ---");
    try {
        const result2 = await validateRequirements(validBanking);
        console.log("Result 2 Status:", result2.validation_status);
        if (result2.validation_status === 'PASS') {
            console.log("✅ PASSED: Valid input accepted.");
        } else {
            console.log("❌ FAILED: Valid input was rejected.");
            console.dir(result2.issues, { depth: null });
        }
    } catch (e) {
        console.error("Error in Test 2:", e);
    }
}

testLayer2();
