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
 * IMPLEMENTS: [Persona Hardening] + [Industrial Standard Guarding]
 */
function getSystemPrompt(section, templateId) {
    const template = TEMPLATES[templateId];
    if (!template) throw new Error(`Unknown template: ${templateId}`);

    const fewShotBlock = getFewShotBlock(templateId, section);

    return `<persona>
${template.systemPromptDirective}

Your Role: Lead Industrial Systems Engineer & Compliance Auditor.
Primary Goal: Generate high-fidelity, zero-hallucination SRS documentation matching the ${template.name} standard.

CORE OPERATING PRINCIPLES:
1. PRECISION: Use measurable metrics (milliseconds, percentages, tolerances) for every technical claim.
2. SINGULARITY: Each requirement must describe exactly one function or constraint.
3. ATOMICITY: No "etc.", "and so on", or "and more". List all items explicitly or stop.
4. TESTABILITY: If a requirement cannot be verified by an automated test or inspection, it is invalid.
</persona>

${fewShotBlock}`;
}

/**
 * Generates the user prompt.
 * IMPLEMENTS: [XML Tagging] + [Anchor Positioning] + [Chain-of-Thought]
 */
function getUserPrompt(section, projectName, projectDescription, previousSections, templateId) {
    const template = TEMPLATES[templateId];
    if (!template) throw new Error(`Unknown template: ${templateId}`);

    const forbiddenList = (template.rules.forbiddenTerms || FORBIDDEN_TERMS).join(', ');
    const instructionBlock = buildSectionInstruction(section, template);
    const sectionSkeleton = template.skeleton[section];
    const schemaBlock = JSON.stringify(sectionSkeleton, null, 2);
    const contextBlock = buildContextBlock(previousSections);

    return `<project_stimulus>
PROJECT: ${projectName}
RAW DESCRIPTION: ${projectDescription}
</project_stimulus>

<section_requirements>
STANDARD: ${template.name}
TARGET SECTION: ${section}
INSTRUCTIONS:
${instructionBlock}
</section_requirements>

<json_contract>
TARGET SCHEMA:
${schemaBlock}
</json_contract>

<chained_context>
${contextBlock}</chained_context>

<mandatory_compliance_rules>
1. OUTPUT: Return ONLY valid JSON. No markdown backticks, no text.
2. PREFIX: Every requirement must start with "${template.rules.requirementPrefix}:".
3. TRUTHFULNESS: If the project description lacks data for a field, state "TBD". Never invent details.
4. CONSISTENCY: Do not contradict the <chained_context>.
5. FORBIDDEN TERMS: NEVER use these vague terms: ${forbiddenList}.
6. LAZINESS GUARD: Do not use placeholders like "etc." or "and so on".
</mandatory_compliance_rules>

<action>
Step 1 [Reasoning]: Mentally analyze the <project_stimulus> and <chained_context>.
Step 2 [Validation]: Verify how the ${section} relates to previous anchor sections.
Step 3 [Extraction]: Identify specific technical metrics to satisfy the rules.
Step 4 [Generation]: Produce the JSON object matching the <json_contract>.
</action>`;
}

/**
 * Builds the section instruction text from the template's sectionInstructions.
 * Includes both the top-level instruction and per-field instructions.
 */
function buildSectionInstruction(section, template) {
    const instructions = template.sectionInstructions[section];

    // If instructions is a string, return it directly
    if (typeof instructions === 'string') {
        return instructions;
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
 * IMPLEMENTS: [Semantic Anchoring] — Highlighting high-impact sections.
 */
function buildContextBlock(previousSections) {
    if (!previousSections || Object.keys(previousSections).length === 0) {
        return '';
    }

    let context = 'PREVIOUSLY GENERATED SECTIONS (for consistency — do not contradict):\n';

    // Anchor sections that influence many others
    const ANCHOR_SECTIONS = ['FunctionalRequirements', 'SystemFeatures', 'Functions', 'ProductFunctions'];

    for (const [sectionName, sectionContent] of Object.entries(previousSections)) {
        const isAnchor = ANCHOR_SECTIONS.some(a => sectionName.includes(a));
        const anchorLabel = isAnchor ? ' [PRIMARY ANCHOR]' : '';

        let contentStr = JSON.stringify(sectionContent, null, 2);
        if (contentStr.length > 2000) {
            contentStr = contentStr.substring(0, 2000) + '\n... [TRUNCATED]';
        }
        context += `\n[${sectionName}]${anchorLabel}:\n${contentStr}\n`;
    }

    return context + '\n';
}

module.exports = { getSystemPrompt, getUserPrompt };
