import { analyzeText } from './aiService.js';
import { asAiSettings } from './providers/providerKeyService.js';
import { layoutAllDFD } from './dfdLayoutService.js';
import { FEATURE_EXPANSION_PROMPT, DFD_STRUCT_GEN_PROMPT } from '../utils/prompts.js';
import { stringifyForPrompt } from '../utils/promptCompaction.js';
import { fillTemplate } from '../utils/promptSanitizer.js';
import { OUTPUT_TOKEN_LIMITS, TEMPERATURES } from '../utils/llmGenerationConfig.js';

/**
 * Standalone (no-SRS-validation) AI helpers used by single-purpose controller endpoints.
 * Extracted from analysisController so the controllers stay thin request/response adapters.
 * Each returns the raw analyzeText result object; the controller decides how to shape the
 * HTTP response (their response shapes differ and are part of the frozen API contract).
 */

/**
 * Expand a single feature idea into structured detail. Uses a task-specific system prompt and
 * intentionally skips SRS Zod validation (zodSchema: null).
 */
export async function expandFeatureContent(name, prompt, settings = {}, providerConfig) {
    // `settings` arrives from the request body. analyzeText treats a `systemPrompt` key as a
    // verbatim override of the system role — no sanitization applied — so a client-supplied
    // one must never reach it. Discarded explicitly rather than relying on this endpoint's own
    // `systemPrompt` (below) simply being spread later in the object literal: that ordering is
    // correct today but is a property a future edit could silently invert.
    const { systemPrompt: _clientSystemPrompt, ...safeSettings } = settings;

    const systemPrompt = FEATURE_EXPANSION_PROMPT
        .replace('{{name}}', 'Provided in user input')
        .replace('{{prompt}}', 'Provided in user input');

    const result = await analyzeText(`Feature Name: ${name}\nDescription/Prompt: ${prompt}`, {
        ...safeSettings,
        // providerConfig was accepted and then never applied, so this endpoint ran on
        // whatever the request happened to carry rather than on the user's own stored key —
        // a BYOK bypass. It is spread after `settings` so the resolved credential wins.
        ...asAiSettings(providerConfig),
        systemPrompt,
        temperature: TEMPERATURES.developer,
        maxOutputTokens: OUTPUT_TOKEN_LIMITS.mediumJson,
        zodSchema: null
    });

    if (result.error) throw new Error(result.error);
    return result;
}

/**
 * Generate a Data Flow Diagram structure and apply auto-layout. Returns the analyzeText result
 * with `result.srs` laid out (dagre positions) when generation succeeded.
 */
export async function generateDfdStructure(projectName, description, srsContent, settings = {}, providerConfig) {
    // Same reasoning as expandFeatureContent: a client-supplied settings.systemPrompt must
    // never reach analyzeText, so it's discarded explicitly rather than relying on this
    // function's own systemPrompt (below) being spread later in the object literal.
    const { systemPrompt: _clientSystemPrompt, ...safeSettings } = settings;

    // The project name is user-supplied, and it already travels in the user turn below. Keeping
    // it out of the system prompt entirely is stronger than sanitising it on the way in: there
    // is no longer a path from request input to the system role to get wrong.
    const systemPrompt = fillTemplate(
        DFD_STRUCT_GEN_PROMPT,
        '{{projectName}}',
        'the project named in the user message'
    );

    const result = await analyzeText(
        `Project: ${projectName}\nDescription: ${description}\nSRS Content Reference: ${stringifyForPrompt(srsContent || "N/A", 12000)}`,
        {
            ...safeSettings,
            ...asAiSettings(providerConfig),
            systemPrompt,
            temperature: TEMPERATURES.architect,
            maxOutputTokens: OUTPUT_TOKEN_LIMITS.architectSection,
            zodSchema: null
        }
    );

    if (result.error) throw new Error(result.error);

    if (result.success && result.srs) {
        result.srs = layoutAllDFD(result.srs);
    }
    return result;
}
