import { analyzeText } from "./aiService.js";
import logger from "../config/logger.js";

/**
 * Surgical Refine Service — Layer 4
 * 
 * Instead of re-running the full multi-agent pipeline (PO → Arch → Dev → QA → Critic),
 * this service makes a SINGLE focused AI call that edits only the affected sections
 * of an existing SRS, preserving everything else.
 * 
 * Typical response time: 5-10s (vs 30-60s for full pipeline)
 */

const SURGICAL_REFINE_PROMPT = `
<role>
You are a senior SRS editor performing a SURGICAL EDIT on an existing Software Requirements Specification document.
You are NOT rewriting the entire document. You are making TARGETED changes to specific sections based on the user's feedback.
</role>

<rules>
1. You will receive the COMPLETE current SRS as JSON and the user's improvement instructions.
2. Return ONLY a JSON object containing the sections that need to change. Do NOT return unchanged sections.
3. The returned JSON keys MUST match the exact key names from the original SRS (e.g., "systemFeatures", "nonFunctionalRequirements", "introduction", etc.).
4. For array fields (like systemFeatures), return the COMPLETE array for that field — not just the changed items. This is because arrays cannot be partially merged.
5. For object fields (like introduction, overallDescription), return the COMPLETE object for that field with your edits applied.
6. Preserve all technical accuracy, IEEE 830 compliance, and formatting from the original.
7. Do NOT invent new sections. Only modify sections the user asked about.
8. If the user's feedback is vague, apply reasonable improvements to the most relevant section.
9. Maintain consistency with unchanged sections — don't introduce contradictions.
</rules>

<output_format>
Return ONLY valid JSON — a partial object containing ONLY the modified sections.

Example: If the user wants to improve the introduction and add a feature:
{
  "introduction": { ...full updated introduction object... },
  "systemFeatures": [ ...full updated features array... ]
}

Do NOT wrap in markdown. Do NOT include explanations. ONLY the JSON partial.
</output_format>
`;

/**
 * Perform a surgical refinement on an existing SRS
 * @param {object} currentSRS - The full current resultJson
 * @param {string} improvementNotes - User's feedback
 * @param {string[]} affectedSections - Section keys to focus on (optional)
 * @returns {object} Partial JSON with only the modified sections
 */
export async function surgicalRefine(currentSRS, improvementNotes, affectedSections = []) {
    const sectionFocus = affectedSections.length > 0
        ? `\nFOCUS ON THESE SECTIONS: ${affectedSections.join(', ')}`
        : '\nThe user did not specify sections. Determine the relevant sections from their feedback.';

    const userPrompt = `
[CURRENT_SRS_START]
${JSON.stringify(currentSRS, null, 2)}
[CURRENT_SRS_END]

[USER_FEEDBACK_START]
${improvementNotes}
${sectionFocus}
[USER_FEEDBACK_END]

Apply the user's feedback as a surgical edit. Return ONLY the modified sections as JSON.
`;

    logger.info({ msg: "[Layer 4] Surgical refinement starting", sections: affectedSections });

    let attempt = 0;
    const maxRetries = 3;
    let delay = 2000;

    while (attempt < maxRetries) {
        try {
            const response = await analyzeText(userPrompt, {
                modelName: process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash',
                systemPrompt: SURGICAL_REFINE_PROMPT,
                temperature: 0.3,
                zodSchema: null
            });

            if (!response || response.success === false) {
                throw new Error(response?.error || "AI refinement call failed");
            }

            // The response could come as response.srs (parsed JSON) or response.raw (string)
            let partial = response.srs;

            if (!partial || typeof partial !== 'object') {
                // Try parsing raw
                const raw = response.raw || '';
                try {
                    partial = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
                } catch {
                    throw new Error("AI returned non-JSON response for surgical edit");
                }
            }

            // Validate: partial should be a plain object with at least one key
            if (!partial || typeof partial !== 'object' || Object.keys(partial).length === 0) {
                throw new Error("AI returned empty surgical edit — no sections were modified");
            }

            logger.info({ msg: "[Layer 4] Surgical refinement complete", modifiedSections: Object.keys(partial) });
            return partial;

        } catch (err) {
            attempt++;
            const isRetryable = err.message?.includes("429") || err.message?.includes("503") || err.message?.includes("fetch failed");

            if (isRetryable && attempt < maxRetries) {
                logger.warn({ msg: `[Layer 4] Retryable error, attempt ${attempt}/${maxRetries}`, error: err.message });
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                continue;
            }

            logger.error({ msg: "[Layer 4] Surgical refinement failed", error: err.message });
            throw err;
        }
    }

    throw new Error("[Layer 4] All retry attempts exhausted for surgical refinement.");
}
