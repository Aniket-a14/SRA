import fs from 'fs';
import readline from 'readline';

const REQUIRED_SECTIONS = [
    "projectTitle",
    "introduction",
    "overallDescription",
    "externalInterfaceRequirements",
    "systemFeatures",
    "nonFunctionalRequirements",
    "otherRequirements"
];

function checkMermaidSyntaxHeuristic(mermaidCode) {
    const errors = [];
    const lines = mermaidCode.split('\n');
    let diagramType = "";

    // Identify Diagram Type
    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('graph ') || line.startsWith('flowchart ')) {
            diagramType = "flowchart";
            break;
        } else if (line.startsWith('sequenceDiagram')) {
            diagramType = "sequence";
            break;
        } else if (line.startsWith('erDiagram')) {
            diagramType = "er";
            break;
        } else if (line.startsWith('classDiagram')) {
            diagramType = "class";
            break;
        }
    }

    if (!diagramType) return ["Unrecognized or missing diagram type."];

    // Common Heuristics
    if (diagramType === "flowchart") {
        for (let line of lines) {
            line = line.trim();
            // Check for unquoted labels with special chars in nodes
            // Example: N1[Label with spaces] is better as N1["Label with spaces"]
            // though Mermaid usually allows spaces in brackets, it fails on some chars.
            if (line.includes('[') && line.includes(']') && !line.includes('"')) {
                const label = line.match(/\[(.*?)\]/);
                if (label && /[:;!@#$%^&*()]/.test(label[1])) {
                    errors.push(`Flowchart: Label "${label[1]}" contains special characters and should be quoted.`);
                }
            }
        }
    }

    if (diagramType === "sequence") {
        let blockStack = [];
        for (let line of lines) {
            line = line.trim();
            if (/\b(alt|opt|loop|par|rect|critical)\b/.test(line)) blockStack.push(line.split(' ')[0]);
            if (line === "end") {
                if (blockStack.length === 0) errors.push("Sequence: 'end' found without matching block start.");
                else blockStack.pop();
            }
            // Check for participant aliases without quotes if they have spaces
            if (line.startsWith('participant ') && line.includes(' as ')) {
                const alias = line.split(' as ')[1];
                if (alias.includes(' ') && !alias.startsWith('"')) {
                    errors.push(`Sequence: Alias ${alias} with spaces must be quoted.`);
                }
            }
        }
        if (blockStack.length > 0) errors.push(`Sequence: Unclosed blocks: ${blockStack.join(', ')}`);
    }

    if (diagramType === "er") {
        for (let line of lines) {
            line = line.trim();
            // Relationships: ENT1 ||--o{ ENT2 : "Label"
            if (line.includes('--') || line.includes('..')) {
                if (line.includes(':') && !line.includes('"')) {
                    errors.push(`ERD: Relationship label after ':' should be quoted.`);
                }
            }
        }
    }

    return errors;
}

const targetFile = process.argv[2] || 'golden_training_dataset.jsonl';

async function verifyDataset(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Error: ${filePath} not found.`);
        return;
    }

    console.log(`🔍 Starting Deep Quality & Mermaid Audit of: ${filePath}\n`);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let totalCount = 0;
    let errors = [];
    let warnings = [];

    for await (const line of rl) {
        totalCount++;
        if (!line.trim()) continue;

        let entry;
        try {
            entry = JSON.parse(line);
        } catch (e) {
            errors.push(`Line ${totalCount}: Invalid JSON syntax.`);
            continue;
        }

        // Handle both raw (source, srs_json) and SFT (instruction, input, output) formats
        let srs_json;
        let source_id = `Line ${totalCount}`;

        if (entry.srs_json) {
            srs_json = entry.srs_json;
            source_id = entry.source || source_id;
        } else if (entry.output) {
            // SFT Format
            try {
                srs_json = typeof entry.output === 'string' ? JSON.parse(entry.output) : entry.output;
            } catch (e) {
                errors.push(`Line ${totalCount}: 'output' field is not valid JSON.`);
                continue;
            }
        }

        if (!srs_json) {
            errors.push(`Line ${totalCount}: Could not find SRS JSON data (tried 'srs_json' and 'output' fields).`);
            continue;
        }

        // 1. IEEE 830 Section Check
        const sectionsFound = Object.keys(srs_json);
        const missingSections = REQUIRED_SECTIONS.filter(s => !sectionsFound.includes(s));
        if (missingSections.length > 0) {
            errors.push(`${source_id}: Missing sections: ${missingSections.join(", ")}`);
        }

        // 2. Content Quality Check
        for (const [section, content] of Object.entries(srs_json)) {
            const isObject = typeof content === 'object' && content !== null;
            const isArray = Array.isArray(content);
            const contentStr = isObject ? JSON.stringify(content) : String(content);

            if (contentStr !== "[]" && contentStr.trim() !== "" && contentStr !== "{}") {
                if (/insert here|placeholder|\[|\]|\.\.\.|\bTBD\b/i.test(contentStr) && contentStr.length < 50) {
                    if (!isObject || (isArray && content.length > 0) || (!isArray && Object.keys(content).length > 0)) {
                        warnings.push(`${source_id} [${section}]: Potential placeholder detected: "${contentStr.substring(0, 30)}..."`);
                    }
                }
            }

            if (contentStr.length < 10 && section !== "projectTitle" && contentStr !== "[]" && contentStr !== "{}") {
                warnings.push(`${source_id} [${section}]: Section content seems unusually short (${contentStr.length} chars).`);
            }
        }

        // 3. Mermaid Syntax Heuristics
        const srsStr = JSON.stringify(srs_json);
        const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/g;
        let match;
        while ((match = mermaidRegex.exec(srsStr)) !== null) {
            const mermaidCode = match[1];
            const mErrors = checkMermaidSyntaxHeuristic(mermaidCode);
            mErrors.forEach(err => errors.push(`${source_id} [Mermaid Syntax Error]: ${err}`));
        }
    }

    console.log(`📊 Audit Complete for ${totalCount} records.`);
    console.log(`❌ Errors Found: ${errors.length}`);
    console.log(`⚠️ Warnings Found: ${warnings.length}\n`);

    if (errors.length > 0) {
        console.log("--- ERRORS ---");
        errors.slice(0, 20).forEach(e => console.log(e));
        if (errors.length > 20) console.log("... and more errors.");
    }

    if (warnings.length > 0) {
        console.log("--- WARNINGS ---");
        warnings.slice(0, 10).forEach(w => console.log(w));
        if (warnings.length > 10) console.log("... and more warnings.");
    }

    if (errors.length === 0) {
        console.log("\n✅ DATASET PASSED ALL VERIFICATIONS (Schema, Quality, Mermaid Heuristics).");
        if (warnings.length === 0) {
            console.log("💎 DATASET QUALITY: EXCELLENT.");
        } else {
            console.log("💡 DATASET QUALITY: GOOD (Minor warnings).");
        }
    } else {
        console.log("\n🛑 DATASET FAILED VERIFICATION. FIX ERRORS BEFORE TRAINING.");
    }
}

verifyDataset(targetFile);
