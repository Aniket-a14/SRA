import fs from 'fs';
import readline from 'readline';
import { JSDOM } from 'jsdom';
import mermaid from 'mermaid';

/**
 * FRONTEND-BATTLE-TESTED MERMAID VALIDATOR
 * This script uses the EXACT same cleaning and auto-fix logic as our frontend.
 */

const { window } = new JSDOM('<!DOCTYPE html><div id="mermaid-holder"></div>');
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.DOMParser = window.DOMParser;
global.XMLSerializer = window.XMLSerializer;
global.Node = window.Node;
global.HTMLElement = window.HTMLElement;
global.SVGElement = window.SVGElement;

mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
});

async function validateWithFrontendLogic(filePath) {
    console.log(`\n🔍 VALIDATING DATASET WITH FRONTEND RENDERER LOGIC: ${filePath}`);
    console.log("--------------------------------------------------");

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    let mermaidBlocks = 0;
    let fixedBlocks = 0;
    let failedBlocks = 0;
    let errors = [];

    for await (const line of rl) {
        count++;
        if (!line.trim()) continue;

        let entry;
        try {
            entry = JSON.parse(line);
        } catch (e) { continue; }

        const output = typeof entry.output === 'string' ? JSON.parse(entry.output) : entry.output;
        if (!output) continue;

        const srsStr = JSON.stringify(output);
        const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/g;
        let match;

        while ((match = mermaidRegex.exec(srsStr)) !== null) {
            mermaidBlocks++;
            let code = match[1].trim();

            // --- 1. FRONTEND CLEANING LOGIC (Exactly from mermaid-renderer.tsx) ---
            let formatted = code
                .replace(/\\n/g, "\n")
                .replace(/[^\x20-\x7E\n\t]/g, "")
                .trim();

            // --- 2. FRONTEND RENDERING ATTEMPT ---
            try {
                // We use parse instead of render in CLI to check syntax validity
                await mermaid.parse(formatted);
            } catch (renderError) {
                const errString = String(renderError);

                // --- 3. FRONTEND AUTO-FIX LOGIC (Exactly from mermaid-renderer.tsx) ---
                if (errString.includes("Trying to inactivate an inactive participant")) {
                    fixedBlocks++;
                    const fixedCode = formatted.replace(/^\s*deactivate\s+.*$/gim, "%% Fixed: deactivated removed");
                    try {
                        await mermaid.parse(fixedCode);
                        // If it passes now, we count it as "Valid (Auto-Fixed)"
                    } catch (e2) {
                        failedBlocks++;
                        errors.push(`Line ${count} [Sequence]: Auto-fix failed. Original error: ${errString}`);
                    }
                } else {
                    failedBlocks++;
                    errors.push(`Line ${count}: Syntax Error - ${errString.substring(0, 100)}...`);
                }
            }
        }
    }

    console.log(`\nDataset Profile for ${filePath}:`);
    console.log(`- Total Records: ${count}`);
    console.log(`- Total Mermaid Diagrams: ${mermaidBlocks}`);
    console.log(`- Valid Diagrams: ${mermaidBlocks - failedBlocks}`);
    console.log(`- Auto-Fixed Diagrams: ${fixedBlocks}`);
    console.log(`- FAILED Diagrams: ${failedBlocks}`);

    if (errors.length > 0) {
        console.log("\n❌ CRITICAL SYNTAX ERRORS FOUND:");
        errors.forEach(e => console.log(`  - ${e}`));
        console.log("\nACTION: You must fix these diagrams or the SRA-Pro model will learn broken syntax.");
    } else {
        console.log("\n✅ ALL DIAGRAMS ARE COMPATIBLE WITH THE FRONTEND RENDERER.");
        console.log("🚀 SFT Readiness: 100%");
    }
}

const target = process.argv[2] || 'train_sft.jsonl';
validateWithFrontendLogic(target);
