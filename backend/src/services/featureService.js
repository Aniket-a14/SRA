import { analyzeText } from './aiService.js';
import { layoutAllDFD } from './dfdLayoutService.js';
import { FEATURE_EXPANSION_PROMPT, DFD_STRUCT_GEN_PROMPT } from '../utils/prompts.js';
import { stringifyForPrompt } from '../utils/promptCompaction.js';
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
export async function expandFeatureContent(name, prompt, settings = {}) {
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
export async function generateDfdStructure(projectName, description, srsContent, settings = {}) {
    const systemPrompt = DFD_STRUCT_GEN_PROMPT.replaceAll('{{projectName}}', projectName);

    const result = await analyzeText(
        `Project: ${projectName}\nDescription: ${description}\nSRS Content Reference: ${stringifyForPrompt(srsContent || "N/A", 12000)}`,
        {
            ...settings,
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
