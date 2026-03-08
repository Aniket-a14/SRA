import fs from 'fs';
import path from 'path';

/**
 * REPAIR SCRIPT for SFT Dataset Mermaid Diagrams
 * Final version with context-aware operator protection and performance logging.
 */

function repairMermaidCode(code) {
    if (!code || typeof code !== 'string') return code;

    // 1. Initial Sanitization
    let c = code.replace(/[^\x20-\x7E\n\t]/g, "").trim();
    c = c.replace(/^(erDiagram|graph|flowchart|sequenceDiagram)([A-Za-z0-9_])/i, '$1\n$2');

    let lines = c.split('\n');
    let typeLine = lines[0].toLowerCase();
    let isERD = typeLine.includes('erdiagram');
    let isFlowchart = typeLine.includes('graph') || typeLine.includes('flowchart');
    let isSequence = typeLine.includes('sequencediagram');

    const masks = [];
    function mask(text) {
        masks.push(text);
        return `§M${masks.length - 1}§`;
    }

    if (isERD) {
        // STEP A: PROTECT RELATIONSHIPS
        c = c.replace(/([|o{}]{1,2})\s*([\-\.]{2})\s*([|o{}]{1,2})/g, (match, left, mid, right) => {
            return mask(left.replace(/\s+/g, '') + mid + right.replace(/\s+/g, ''));
        });

        c = c.replace(/([|o{}]{1,2})\s*(--|..)([A-Za-z0-9_]+)/g, (match, op, mid, entity) => {
            return mask(op.replace(/\s+/g, '') + mid) + " " + entity;
        });
        c = c.replace(/([A-Za-z0-9_]+)\s*(--|..)\s*([|o{}]{1,2})/g, (match, entity, mid, op) => {
            return entity + " " + mask(mid + op.replace(/\s+/g, ''));
        });

        // STEP B: NORMALIZE BLOCKS
        c = c.replace(/([A-Za-z0-9_]+)\s*{\s*/g, '$1 {\n');
        c = c.replace(/\s*}\s*/g, '\n}\n');
    }

    if (isFlowchart) {
        c = c.replace(/(--\s*".*?"\s*|--\s*[^"\|\s\n-]+\s*)(-->|--)/g, ' $2 ');
        c = c.replace(/(-->|--|->)\s*("(.*?)"|([^"\|\s\n]+))\s*(-->|--|->)/g, ' -->|$3$4| ');
        c = c.replace(/(-->|--|->)\s*(\|.*?\|)?\s*$/gm, '');
    }

    if (isSequence) {
        c = c.replace(/-->>-X/g, '-->>X');
        c = c.replace(/^\s*else\s+if\s+/gim, 'else ');
    }

    // STEP C: LINE-BY-LINE RECOVERY
    lines = c.split('\n');
    let processedLines = lines.map(line => {
        let l = line.trim();
        if (!l) return '';

        if ((l.match(/"/g) || []).length % 2 !== 0) {
            if (!l.endsWith(':') && !l.endsWith('-->')) l += '"';
        }

        if (isERD) {
            l = l.replace(/\bbool\b/g, 'boolean');
            l = l.replace(/\b(PK|UK|FK)\s+(PK|UK|FK)\b/g, '$1, $2');
            if (!l.includes(':') && !l.includes('§M')) {
                l = l.replace(/"([^"]+)"/g, (m, g) => g.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, ''));
            }
        }
        return l;
    });

    // STEP D: FINAL ASSEMBLY
    let result = processedLines.filter(l => l).join('\n');

    // Restore masks (nested support with safety limit)
    let iter = 0;
    while (result.includes('§M') && iter < 10) {
        result = result.replace(/§M(\d+)§/g, (match, idx) => masks[parseInt(idx)] || match);
        iter++;
    }

    if (isERD) {
        result = result.replace(/([A-Za-z0-9_]+)\s*([|o{}]{1,2}[\-\.]{2}[|o{}]{1,2})\s*([A-Za-z0-9_]+)/g, '$1 $2 $3');

        // Attribute grouping inside blocks (Safer non-recursive match)
        result = result.replace(/\{([^{}]*)\}/g, (match, content) => {
            const rawAttrs = content.trim().split(/\s+/).filter(a => a);
            if (rawAttrs.length === 0) return '{}';
            let formatted = [];
            for (let i = 0; i < rawAttrs.length; i += 2) {
                if (rawAttrs[i + 1]) {
                    let type = rawAttrs[i + 1].toLowerCase();
                    if (type === 'bool') type = 'boolean';
                    formatted.push(`    ${rawAttrs[i]} ${type}`);
                } else {
                    formatted.push(`    ${rawAttrs[i]}`);
                }
            }
            return `{\n${formatted.join('\n')}\n}`;
        });

        result = result.replace(/}\s*([A-Za-z0-9_]+)/g, '}\n$1');
    }

    return result.trim().replace(/\n{3,}/g, '\n\n');
}

async function repairFile(filePath) {
    console.log(`\n🛠️  REPAIRING: ${filePath}`);
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    const resultLines = lines.map((line, index) => {
        if (!line.trim()) return line;

        if (index % 5 === 0) {
            process.stdout.write(`Processing line ${index}/${totalLines}...\r`);
        }

        try {
            const entry = JSON.parse(line);
            let output;
            let isStringOutput = false;
            if (typeof entry.output === 'string') {
                output = JSON.parse(entry.output);
                isStringOutput = true;
            } else {
                output = entry.output;
            }

            if (output?.appendices?.analysisModels) {
                const models = output.appendices.analysisModels;
                const keys = ['flowchartDiagram', 'sequenceDiagram', 'erDiagram', 'entityRelationshipDiagram', 'erDiagramDiagram'];
                for (const key of keys) {
                    if (models[key]) {
                        const original = typeof models[key] === 'string' ? models[key] : (models[key].code || "");
                        const repaired = repairMermaidCode(original);
                        if (repaired && repaired !== original) {
                            if (typeof models[key] === 'string') models[key] = repaired;
                            else models[key].code = repaired;
                        }
                    }
                }
            }
            entry.output = isStringOutput ? JSON.stringify(output) : output;
            return JSON.stringify(entry);
        } catch (e) { return line; }
    });
    console.log(`\nWriting repaired content to ${filePath}...`);
    fs.writeFileSync(filePath, resultLines.join('\n'));
    console.log(`✅ Fixed!`);
}

const target = process.argv[2];
if (target) {
    repairFile(target);
} else {
    repairFile('train_sft.jsonl');
    repairFile('test_sft.jsonl');
}
