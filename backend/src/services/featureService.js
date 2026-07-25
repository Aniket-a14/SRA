import { analyzeText } from './aiService.js';
import { asAiSettings } from './providers/providerKeyService.js';
import { layoutAllDFD } from './dfdLayoutService.js';
import { FEATURE_EXPANSION_PROMPT, DFD_STRUCT_GEN_PROMPT } from '../utils/prompts.js';
import { stringifyForPrompt } from '../utils/promptCompaction.js';
import { sanitizePromptLabel, fillTemplate } from '../utils/promptSanitizer.js';
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
    const systemPrompt = FEATURE_EXPANSION_PROMPT
        .replace('{{name}}', 'Provided in user input')
        .replace('{{prompt}}', 'Provided in user input');

    const result = await analyzeText(`Feature Name: ${name}\nDescription/Prompt: ${prompt}`, {
        ...settings,
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
    // projectName reaches the system role, so it is reduced to a single safe line first —
    // `fillTemplate` also stops `$&`/`$'` in the name from splicing the template into itself.
    const systemPrompt = fillTemplate(
        DFD_STRUCT_GEN_PROMPT,
        '{{projectName}}',
        sanitizePromptLabel(projectName) || 'Project'
    );

    const result = await analyzeText(
        `Project: ${projectName}\nDescription: ${description}\nSRS Content Reference: ${stringifyForPrompt(srsContent || "N/A", 12000)}`,
        {
            ...settings,
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
