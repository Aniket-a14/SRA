import logger from '../../config/logger.js';
import { repairDiagram } from '../aiService.js';

/**
 * Heuristic pre-checks + AI self-repair for the Mermaid diagrams in an SRS draft, run BEFORE
 * the reflection loop scores the draft so a minor syntax slip (legacy `graph` prefix, bad ERD
 * colon/quoting, invalid keys) doesn't tank the quality audit. Mutates `srs` in place.
 *
 * Extracted verbatim from analysisService.performAnalysis — behavior is unchanged.
 *
 * @param {object} srs - the assembled SRS draft (mutated in place)
 * @param {object} settings - prompt/model settings forwarded to repairDiagram
 */
export async function validateAndAutoRepairDiagrams(srs, settings) {
    if (!srs.appendices?.analysisModels) return;

    const models = srs.appendices.analysisModels;
    const diagramTypes = [
        { key: 'flowchartDiagram', name: 'Flowchart' },
        { key: 'sequenceDiagram', name: 'Sequence Diagram' },
        { key: 'entityRelationshipDiagram', name: 'Entity Relationship Diagram' }
    ];

    for (const { key, name } of diagramTypes) {
        const diagram = models[key];
        if (diagram && diagram.code) {
            let needsRepair = false;
            let heuristicError = "";
            let code = diagram.code.trim();

            // 1. GLOBAL: Fix legacy 'graph' prefix for modern 'flowchart'
            if (code.startsWith('graph')) {
                code = code.replace(/^graph/, 'flowchart');
                needsRepair = true;
                heuristicError = "Legacy 'graph' prefix detected. Converted to 'flowchart'.";
            }

            // 2. ERD SPECIFIC
            if (key === 'entityRelationshipDiagram') {
                if (code.includes(' : ') && code.indexOf(' : ') < code.indexOf('--')) {
                    needsRepair = true;
                    heuristicError = "Invalid ERD colon placement.";
                }
                if (code.includes(' : ') && !code.includes('"') && code.split(' : ')[1]?.includes(' ')) {
                    needsRepair = true;
                    heuristicError = "ERD labels with spaces must be quoted.";
                }
                if (/\b(NN)\b/.test(code)) {
                    needsRepair = true;
                    heuristicError = "Invalid ERD key 'NN' found.";
                }
            }

            // 3. SEQUENCE SPECIFIC
            if (key === 'sequenceDiagram') {
                if (!code.includes('+') && !code.includes('-') && code.includes('->>')) {
                    // Heuristic: If there are calls but no activations, it might be lower quality
                    logger.debug("[Diagram Repair] Sequence diagram lacks activation markers. Proceeding but marking for potential UI improvement.");
                }
            }

            if (needsRepair) {
                logger.info(`[Diagram Repair] Auto-repairing ${name} due to: ${heuristicError}`);
                try {
                    const repaired = await repairDiagram(code, heuristicError, settings);
                    if (repaired) diagram.code = repaired;
                } catch (err) {
                    logger.warn(`[Diagram Repair] Repair failed for ${name}: ${err.message}`);
                }
            }
        }
    }

    // AI-selected dynamic diagrams (any Mermaid type). We only apply the safe, generic
    // heuristic (legacy `graph` → `flowchart`) here — the extended palette (state, class,
    // journey, gantt, …) has no per-type heuristic yet, so we normalise and leave the rest
    // to the renderer's own error handling rather than risk mangling valid syntax.
    if (Array.isArray(models.additionalDiagrams)) {
        for (const diagram of models.additionalDiagrams) {
            if (!diagram || typeof diagram.code !== 'string' || !diagram.code.trim()) continue;
            let code = diagram.code.trim();

            if (code.startsWith('graph')) {
                code = code.replace(/^graph/, 'flowchart');
                const label = diagram.title || diagram.type || 'diagram';
                logger.info(`[Diagram Repair] Normalised legacy 'graph' prefix in additional diagram: ${label}`);
                try {
                    const repaired = await repairDiagram(code, "Legacy 'graph' prefix detected. Converted to 'flowchart'.", settings);
                    diagram.code = repaired || code;
                } catch (err) {
                    diagram.code = code;
                    logger.warn(`[Diagram Repair] Repair failed for additional diagram ${label}: ${err.message}`);
                }
            }
        }
    }
}
