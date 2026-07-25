import { jsonrepair } from 'jsonrepair';
import logger from '../config/logger.js';

/**
 * Shared, fault-tolerant JSON recovery for model output.
 *
 * This exists because there were two divergent parsers: BaseAgent ran a full repair
 * pipeline (fences -> structural pre-fixes -> truncation balancing -> jsonrepair), while
 * aiService.analyzeText only tried a native parse plus a bad-escape retry. Output that
 * BaseAgent recovered from would hard-fail in analyzeText — a live validation-gate run
 * died on `Expected double-quoted property name in JSON at position 240`, which
 * jsonrepair fixes trivially. One pipeline now, so behaviour cannot drift again.
 *
 * Stages are ordered cheapest-and-safest first; each is a superset fallback of the last.
 */

/** Strip markdown fences and anything outside the outermost JSON object/array. */
export function extractJsonBody(text) {
    let clean = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();

    // Prefer an object, but fall back to an array when the model returned a bare list.
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) return clean.substring(firstBrace, lastBrace + 1);

    const firstBracket = clean.indexOf('[');
    const lastBracket = clean.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) return clean.substring(firstBracket, lastBracket + 1);

    return clean;
}

/** Structural fixes for the malformations Flash-class models produce most often. */
export function applyStructuralFixes(text) {
    return text
        // Comments are not valid JSON but models emit them anyway.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        // Accidentally doubled close braces/brackets between array items.
        .replace(/\}\s*\}\s*,\s*\{/g, '}, {')
        .replace(/\]\s*\]\s*,\s*\[/g, '], [')
        // Trailing commas before a close.
        .replace(/,\s*\}/g, '}')
        .replace(/,\s*\]/g, ']')
        // Missing colons in key/value pairs: "key" "value" -> "key": "value"
        .replace(/"([^"]+)"\s+"([^"]*)"/g, '"$1": "$2"')
        .replace(/"([^"]+)"\s+([0-9.]+)/g, '"$1": $2')
        .replace(/"([^"]+)"\s+(true|false|null)/g, '"$1": $2');
}

/** Escape lone backslashes that aren't valid JSON escape sequences. */
export function fixBadEscapes(text) {
    return text.replace(/\\(?!(["\\/bfnrt]|u[0-9a-fA-F]{4}))/g, '\\\\');
}

/**
 * Close unbalanced braces/brackets left by a truncated response.
 * @returns {{ text: string, truncated: boolean, missingBraces: number, missingBrackets: number }}
 */
export function balanceTruncation(text) {
    const count = (ch) => (text.match(new RegExp(`\\${ch}`, 'g')) || []).length;
    const missingBraces = Math.max(0, count('{') - count('}'));
    const missingBrackets = Math.max(0, count('[') - count(']'));
    // Brackets close before braces: an unterminated array sits inside its object.
    const balanced = text + ']'.repeat(missingBrackets) + '}'.repeat(missingBraces);
    return { text: balanced, truncated: missingBraces + missingBrackets > 0, missingBraces, missingBrackets };
}

/**
 * Run the full recovery pipeline and return parsed JSON.
 * @param {string} text - raw model output
 * @param {{ label?: string }} [options] - label used in logs (agent or service name)
 * @throws {Error} when every stage fails; message includes the underlying parse error
 */
export function repairAndParseJSON(text, { label = 'JSON' } = {}) {
    let cleanText = extractJsonBody(text);

    try {
        cleanText = applyStructuralFixes(cleanText);

        const { text: balanced, truncated, missingBraces, missingBrackets } = balanceTruncation(cleanText);
        if (truncated) {
            logger.warn({
                msg: `[${label}] Detected truncated JSON. Attempting to auto-balance.`,
                missingBraces,
                missingBrackets,
                tailContent: `...${cleanText.slice(-100)}`
            });
        }
        cleanText = balanced;

        // Escape lone backslashes BEFORE jsonrepair. jsonrepair resolves an invalid escape
        // by deleting the backslash, so `"C:\Program Files"` would come back as
        // "C:Program Files" — silent data loss inside requirement text. Escaping first is
        // lossless and a no-op on already-valid JSON.
        const escaped = fixBadEscapes(cleanText);

        let parsed;
        // Stage 1: jsonrepair handles the long tail (unquoted keys, single quotes, missing
        // commas) that hand-rolled regexes cannot.
        try {
            parsed = JSON.parse(jsonrepair(escaped));
        } catch {
            try {
                // Stage 2: retry unescaped, in case the escaping itself confused the repair.
                parsed = JSON.parse(jsonrepair(cleanText));
            } catch {
                // Stage 3: last resort, in case a repair stage mangled otherwise-valid JSON.
                parsed = JSON.parse(cleanText);
            }
        }

        // A refusal or a plain prose reply repairs "successfully" into a bare string or
        // number. Callers all expect a structured payload, so treat that as a parse failure
        // instead of handing back something they will silently mis-handle.
        if (parsed === null || typeof parsed !== 'object') {
            throw new Error(`Model returned ${typeof parsed} rather than a JSON object or array`);
        }
        return parsed;
    } catch (error) {
        logger.error({ msg: `[${label}] JSON Parsing Failed`, error: error.message });

        const posMatch = error.message.match(/at position (\d+)/);
        if (posMatch) {
            const pos = Number.parseInt(posMatch[1], 10);
            const start = Math.max(0, pos - 50);
            const end = Math.min(cleanText.length, pos + 50);
            logger.debug({
                msg: 'JSON Parse Context',
                position: pos,
                contextSnippet: `...${cleanText.substring(start, pos)} >>> ${cleanText[pos] || ''} <<< ${cleanText.substring(pos + 1, end)}...`
            });
        }

        throw error;
    }
}
