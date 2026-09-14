import { z } from 'zod';

/**
 * Converts a Gemini-native `SchemaType`-shaped descriptor (see utils/aiSchemas.js and
 * formats/schemaBuilder.js) into an equivalent zod schema, so the exact same shape already
 * declared for Gemini's `responseSchema` can also validate every OTHER provider's output —
 * OpenAI, Claude, and Grok are never constrained by `responseSchema` (that's a Gemini-only
 * API feature), so before this, a malformed response from any of them only had
 * `jsonRepair.js`'s best-effort syntactic repair between it and persistence, no shape check
 * at all. One converter over the existing declarative schemas beats hand-writing a second,
 * parallel set of zod schemas that would inevitably drift from the Gemini ones.
 *
 * Deliberately permissive, not a strict mirror of the JSON-schema-like input:
 * - Objects are `.passthrough()` — extra fields a provider adds are kept, not rejected.
 *   Gemini's `responseSchema` constrains generation to exactly these fields; the other three
 *   providers were never told that constraint, so rejecting extras would fail providers that
 *   are behaving reasonably, not catch a real defect.
 * - Fields not listed in `required` become `.optional()`. Fields that ARE required stay
 *   required — a required field that's missing or `null` is exactly the kind of malformed
 *   output this exists to catch.
 * - An unrecognized `type` (schema evolves faster than this converter) falls back to
 *   `z.unknown()` rather than throwing, so a new field kind degrades to "unchecked" instead
 *   of breaking validation for the whole document.
 */
export function geminiSchemaToZod(schema) {
    if (!schema || typeof schema !== 'object') return z.unknown();

    switch (schema.type) {
        case 'string':
            return z.string();
        case 'number':
            return z.number();
        case 'integer':
            return z.number().int();
        case 'boolean':
            return z.boolean();
        case 'array': {
            const itemSchema = schema.items ? geminiSchemaToZod(schema.items) : z.unknown();
            return z.array(itemSchema);
        }
        case 'object': {
            const properties = schema.properties || {};
            const required = new Set(schema.required || []);
            const shape = {};
            for (const [key, propSchema] of Object.entries(properties)) {
                const zodProp = geminiSchemaToZod(propSchema);
                shape[key] = required.has(key) ? zodProp : zodProp.optional();
            }
            return z.object(shape).passthrough();
        }
        default:
            return z.unknown();
    }
}

/**
 * Human-readable summary of a zod validation failure, fed back to the model as a correction
 * prompt (see BaseAgent.callLLM) and logged on final failure. Capped so a deeply-nested
 * schema mismatch can't blow up the prompt or the log line.
 */
export function summarizeZodIssues(zodError, maxIssues = 12) {
    const issues = zodError.issues.slice(0, maxIssues).map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        return `- ${path}: ${issue.message}`;
    });
    const more = zodError.issues.length > maxIssues ? `\n- ...and ${zodError.issues.length - maxIssues} more` : '';
    return issues.join('\n') + more;
}
