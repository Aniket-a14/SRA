/**
 * SRS PROMPT FACTORY
 * Generates structured prompts for each SRS section.
 * Supports context chaining by taking previously generated sections as input.
 */

const SECTION_DESCRIPTIONS = {
    introduction: "Define the purpose, scope, and audience of the software.",
    overallDescription: "Describe the perspective, functions, environment, and constraints of the product.",
    externalInterfaceRequirements: "Detail the user, hardware, software, and communication interfaces.",
    systemFeatures: "Provide a list of high-level features with functional requirements.",
    nonFunctionalRequirements: "Specify performance, safety, and security requirements with measurable metrics.",
    appendices: "Include analysis models (Mermaid diagrams) and a TBD list."
};

/**
 * Creates a system prompt for a specific SRS section.
 * @param {string} sectionName 
 * @returns {string}
 */
function getSystemPrompt(sectionName) {
    return `You are a professional software architect writing an IEEE 830-1998 compliant SRS.
Task: Generate the "${sectionName}" section.
Section Description: ${SECTION_DESCRIPTIONS[sectionName]}

STRICT RULES:
1. Return ONLY a valid JSON object matching the requested schema.
2. NO conversational text, NO preamble, NO markdown blocks. Just the raw JSON.
3. QUALITY RULE: Every functional requirement MUST start with "The system shall".
4. ANTI-AMBIGUITY: Do NOT use vague terms like "easy", "robust", "fast", "user-friendly", "efficient". Use quantitative metrics where applicable.
5. CONTINUITY: Ensure clinical consistency with any context provided from previous sections.
6. DATA TYPE: Ensure all fields have the correct data type (strings, arrays, objects) as per the schema.`;
}

/**
 * Creates a user prompt for a specific SRS section with contextual context.
 * @param {string} sectionName 
 * @param {string} projectName 
 * @param {string} projectDescription 
 * @param {object} previousSections - JSON object containing already generated sections
 * @returns {string}
 */
function getUserPrompt(sectionName, projectName, projectDescription, previousSections = {}) {
    let contextSnippet = "";
    if (Object.keys(previousSections).length > 0) {
        contextSnippet = `\nPREVIOUSLY GENERATED SECTIONS (for consistency):\n${JSON.stringify(previousSections, null, 2)}\n`;
    }

    return `Project Name: ${projectName}
Project Description: ${projectDescription}
${contextSnippet}
ACTION: Generate the JSON for the "${sectionName}" section based on the above description and context.`;
}

module.exports = { getSystemPrompt, getUserPrompt };
