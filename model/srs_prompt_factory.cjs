/**
 * SRA-PRO PROMPT FACTORY (Industry-Grade)
 * 
 * Generates system and user prompts for section-wise SRS generation.
 * 
 * Architecture:
 *   System Prompt = Standard-specific persona + rules + forbidden terms
 *   User Prompt   = SECTION INSTRUCTION + SCHEMA + CONTEXT + ACTION
 * 
 * Mirrors the backend's Layer 1 (ProductOwnerAgent) prompt architecture.
 */

const { TEMPLATES, FORBIDDEN_TERMS } = require('./srs_templates.cjs');
const { getFewShotBlock } = require('./srs_few_shot_examples.cjs');

/**
 * Generates the system prompt for a given section and template.
 * This is the LLM's "persona" — it defines WHO the model is.
 */
function getSystemPrompt(section, templateId) {
    const template = TEMPLATES[templateId];
    if (!template) throw new Error(`Unknown template: ${templateId}`);

    const forbiddenList = (template.rules.forbiddenTerms || FORBIDDEN_TERMS).join(', ');
    const fewShotBlock = getFewShotBlock(templateId, section);

    return `${template.systemPromptDirective}

STANDARD: ${template.name}

CRITICAL RULES:
1. Return ONLY valid JSON matching the provided schema. No markdown, no commentary, no code fences.
2. All requirements must use the prefix: "${template.rules.requirementPrefix}".
3. FORBIDDEN TERMS — Do not use any of these vague terms: ${forbiddenList}. Replace them with quantified metrics or specific descriptions.
4. CONSISTENCY — Do not contradict any data in the "PREVIOUSLY GENERATED SECTIONS" context.
5. COMPLETENESS — Fill every field in the schema. If information is not available from the project description, state "TBD" rather than leaving empty.
6. TESTABILITY — Every requirement must be verifiable. If it cannot be tested, rewrite it until it can be.

INDUSTRY QUALITY STANDARDS (ISO 29148):
- UNAMBIGUOUS: Only one interpretation is possible. Use numbers and units.
- SINGULAR: Each requirement must address only one function or constraint.
- MEASURABLE: Avoid "as soon as possible" or "fast". Use "within 500ms" or "> 99.9%".
- IMPLEMENTATION INDEPENDENT: Describe WHAT the system does, not HOW (no database table names, no specific code snippets unless requested).${fewShotBlock}`;
}

/**
 * Generates the user prompt for a given section and template.
 * This is the "task" — it tells the model WHAT to do.
 * 
 * Structure:
 *   SECTION INSTRUCTION  — Official guidance text from the standard
 *   SCHEMA               — Exact JSON structure to fill
 *   CONTEXT              — Previously generated sections (chained)
 *   ACTION               — What to do
 */
function getUserPrompt(section, projectName, projectDescription, previousSections, templateId) {
    const template = TEMPLATES[templateId];
    if (!template) throw new Error(`Unknown template: ${templateId}`);

    // 1. Build section instruction
    const instructionBlock = buildSectionInstruction(section, template);

    // 2. Build schema block
    const sectionSkeleton = template.skeleton[section];
    const schemaBlock = JSON.stringify(sectionSkeleton, null, 2);

    // 3. Build context block
    const contextBlock = buildContextBlock(previousSections);

    // 4. Assemble the prompt
    return `PROJECT: ${projectName}
DESCRIPTION: ${projectDescription}

---
SECTION INSTRUCTION (from ${template.name}):
${instructionBlock}
---
EXPECTED JSON SCHEMA (fill this structure):
${schemaBlock}
---
${contextBlock}---
ACTION: Generate the "${section}" section for the project described above. Return ONLY the JSON object matching the schema. Do not wrap in code fences or add any text outside the JSON.`;
}

/**
 * Builds the section instruction text from the template's sectionInstructions.
 * Includes both the top-level instruction and per-field instructions.
 */
function buildSectionInstruction(section, template) {
    const instructions = template.sectionInstructions[section];
    if (!instructions) {
        return `Generate the "${section}" section according to ${template.name} standard guidelines.`;
    }

    const lines = [];

    // Top-level section instruction
    if (instructions._self) {
        lines.push(instructions._self);
        lines.push('');
    }

    // Per-field instructions
    for (const [field, instruction] of Object.entries(instructions)) {
        if (field === '_self') continue;
        lines.push(`• ${field}: ${instruction}`);
    }

    return lines.join('\n');
}

/**
 * Builds the chained context block from previously generated sections.
 */
function buildContextBlock(previousSections) {
    if (!previousSections || Object.keys(previousSections).length === 0) {
        return '';
    }

    let context = 'PREVIOUSLY GENERATED SECTIONS (for consistency — do not contradict):\n';

    for (const [sectionName, sectionContent] of Object.entries(previousSections)) {
        let contentStr = JSON.stringify(sectionContent, null, 2);
        // Cap individual section context to prevent token overflow
        if (contentStr.length > 2000) {
            contentStr = contentStr.substring(0, 2000) + '\n... [TRUNCATED]';
        }
        context += `\n[${sectionName}]:\n${contentStr}\n`;
    }

    return context + '\n';
}

module.exports = { getSystemPrompt, getUserPrompt };
