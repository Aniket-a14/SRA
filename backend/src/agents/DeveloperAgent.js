import { BaseAgent } from './BaseAgent.js';
import { constructMasterPrompt } from '../utils/prompts.js';
import { SRSSchema, SRSShellSchema, SRSFeaturesSchema, SRSRequirementsSchema, SRSAppendicesSchema } from '../utils/aiSchemas.js';

const MERMAID_RULES = `
<diagram_rules>
These rules govern ALL Mermaid diagram generation. Violations will produce invalid, unrenderable output.

1. Flowcharts: Use 'flowchart TD'. Shapes: '([Start/End])', '[Process]', '{Decision}', '[/IO/]', '[(Database)]', '[[Subroutine]]'. Links: '-->', '-.->' (dotted), '==>' (thick).
2. Sequence Diagrams: Use 'sequenceDiagram'. Use 'actor User' for humans, 'participant' for systems.
3. Sequence Activations: FORBIDDEN. Do NOT use '+', '-', 'activate', or 'deactivate'. They crash renderers if unbalanced. Use only standard arrows ('A->>B:', 'B-->>A:').
4. Sequence Safety: Never quote alias IDs (use 'participant U as User', not 'participant U as "User"'). Avoid '{}' in messages.
5. ERDs: Use 'erDiagram'. Fields: 'ENTITY { type name PK,FK }' — NO COLONS in field lines.
6. ERD Relationships: '||--o{' (1:N), '||--||' (1:1). Label must always be quoted.
7. ERD Attributes: ONLY PK, FK, UK are valid key markers. FORBIDDEN: NN, NOT NULL, or any non-standard constraint.
8. Flowchart IDs: NEVER use 'end', 'subgraph', or 'class' as IDs. Use alphanumeric only. Labels with spaces must be double-quoted: 'id["My Label"]'.
9. NO PARENTHESES in node IDs. Use double quotes for labels with special characters.
10. Limit ERDs to top 10-12 core entities to prevent output truncation.
</diagram_rules>
`;

export class DeveloperAgent extends BaseAgent {
  constructor() {
    super("Lead Developer");
  }

  /**
   * SECTION 1: generateShell
   * Focuses on Project Metadata, Introduction, and Overall Description.
   */
  async generateShell(rawInput, requirements, architecture, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const masterPrompt = await constructMasterPrompt(null, { profile: "default", projectName }, version);

    const prompt = `
${masterPrompt}

<role>
You are the Lead Developer generating the FOUNDATION of an IEEE 830-1998 SRS document. You specialize in translating refined requirements into precise, professional technical prose.
</role>

<task>
Generate the SRS shell: 'projectTitle', 'revisionHistory', 'introduction', and 'overallDescription'. This forms the document's identity and high-level product context.
</task>

<constraints>
1. Use the "${projectName}-" prefix for all requirement identifiers.
2. The 'productFunctions' in overallDescription must be high-level summaries of the core intent, not detailed specifications.
3. Maintain formal IEEE academic prose. No bullet points in narrative fields.
4. Each paragraph must cover exactly ONE concept, be 3-6 sentences long, and not exceed 120 words.
5. Do NOT invent features or constraints not present in the requirements or architecture inputs.
</constraints>

<context>
<requirements>${JSON.stringify(requirements, null, 2)}</requirements>
<architecture>${JSON.stringify(architecture, null, 2)}</architecture>
<historical_patterns>${ragContext || "No historical context available."}</historical_patterns>
</context>

<input>
Original Raw Description:
${rawInput}
</input>
`;

    return this.callLLM(prompt, 0.4, true, SRSShellSchema);
  }

  /**
   * SECTION 2: generateFeatures
   * Focuses on a specific chunk of system features.
   */
  async generateFeatures(rawInput, section1, requirements, architecture, featuresChunk, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const masterPrompt = await constructMasterPrompt(null, { profile: "default", projectName }, version);

    const prompt = `
${masterPrompt}

<role>
You are the Lead Developer generating detailed IEEE Section 4.x System Features for an SRS document. Each feature must be comprehensive, specific, and production-ready.
</role>

<task>
Generate system features for ONLY the target features listed below. For each, produce: name, description (multi-paragraph), stimulusResponseSequences, and functionalRequirements.
</task>

<constraints>
1. The 'description' MUST be a comprehensive, multi-paragraph explanation of the feature's value, behavior, and workflow. One-liners are unacceptable.
2. Functional requirements must be exhaustive, specifically detailing edge cases, validation, and error handling.
3. Each functional requirement must start with "The system shall" and be atomic (one requirement per item).
4. Stimulus/Response sequences must follow: "Stimulus: [action] Response: [behavior]".
5. Use the "${projectName}-" prefix for requirement identifiers.
6. Do NOT generate features beyond what is listed in the target features below.
</constraints>

<context>
<foundation>${JSON.stringify(section1)}</foundation>
<architecture>${JSON.stringify(architecture, null, 2)}</architecture>
<historical_patterns>${ragContext || "None"}</historical_patterns>
</context>

<input>
Target Features to Document:
${JSON.stringify(featuresChunk, null, 2)}

Original Raw Description:
${rawInput}
</input>
`;

    return this.callLLM(prompt, 0.4, true, SRSFeaturesSchema);
  }

  /**
   * SECTION 3: generateRequirements (NFRs & Interfaces)
   * Focuses on Interfaces, NFRs, Glossary, and high-fidelity Mermaid diagrams.
   */
  async generateRequirements(rawInput, sections1And2, requirements, architecture, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const masterPrompt = await constructMasterPrompt(null, { profile: "default", projectName }, version);

    const prompt = `
${masterPrompt}

<role>
You are the Lead Developer generating the technical requirements sections of an IEEE 830-1998 SRS. This includes External Interface Requirements, Non-Functional Requirements, Other Requirements, and the Glossary.
</role>

<task>
Generate the NFRs, interface requirements, other requirements, and glossary sections. These complete the SRS's critical technical specifications.
</task>

<constraints>
1. NFRs must be specific, measurable, and traceable to the original requirements where possible.
2. Security requirements must address authentication, authorization, and data privacy appropriate to the product scope.
3. Performance requirements must include concrete thresholds when the input provides enough context.
4. The glossary must define all domain-specific terms and acronyms used in the SRS.
5. Use the "${projectName}-" prefix for requirement identifiers.
6. Do NOT invent constraints or requirements not supported by the input.
</constraints>

${MERMAID_RULES}

<context>
<previous_sections>${JSON.stringify(sections1And2)}</previous_sections>
<requirements>${JSON.stringify(requirements, null, 2)}</requirements>
<architecture>${JSON.stringify(architecture, null, 2)}</architecture>
<historical_nfrs>${ragContext || "None"}</historical_nfrs>
</context>

<input>
Original Raw Description:
${rawInput}
</input>
`;

    return this.callLLM(prompt, 0.5, true, SRSRequirementsSchema);
  }

  /**
   * SECTION 4: generateAppendices
   * Generates only the Appendices (Mermaid Diagrams, TBD list).
   * Context: Requires Shell, Features, and Requirements.
   */
  async generateAppendices(rawInput, previousSections, poOutput, architecture, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext } = settings;

    const masterPrompt = await constructMasterPrompt(null, {
      profile: "developer",
      projectName,
      noSchema: true
    }, version);

    const prompt = `
${masterPrompt}

<role>
You are the Lead Developer generating the Appendices section of an IEEE 830-1998 SRS. This section contains ONLY analysis models (Mermaid diagrams) and the TBD List.
</role>

<task>
Generate the appendices containing:
1. A flowchart diagram showing the primary system workflow.
2. A sequence diagram showing a core user interaction flow.
3. An entity relationship diagram showing the data model.
4. A TBD list collecting all unresolved items from the SRS.
Each diagram must include "syntaxExplanation", "code", and "caption".
</task>

<constraints>
1. Diagrams must accurately reflect the content of the previous SRS sections — do not invent new entities or flows.
2. Each diagram must have a concise caption (4-6 words max).
3. Output RAW Mermaid syntax only (no markdown code blocks).
4. The TBD list must reference all "TBD" or "To Be Determined" items found in earlier sections.
</constraints>

${MERMAID_RULES}

<context>
<previous_srs_sections>${JSON.stringify(previousSections, null, 2)}</previous_srs_sections>
<architecture>${JSON.stringify(architecture, null, 2)}</architecture>
</context>

<input>
Original Raw Description:
${JSON.stringify(rawInput, null, 2)}
</input>
`;

    return this.callLLM(prompt, 0.4, true, SRSAppendicesSchema);
  }

  async generateSRS(requirements, architecture, settings = {}) {
    // Legacy support or fallback. For SRA 4.0, direct orchestration in service is preferred.
    return this.generateShell(requirements, architecture, settings);
  }

  /**
   * Pillar 1: Agentic Reflection
   * Refines a specific TARGET SECTION of an existing SRS draft based on feedback.
   */
  async refineSRS(rawInput, originalRequirements, originalArchitecture, targetSectionDraft, targetSectionName, feedback, settings = {}) {
    const { projectName = "Project" } = settings;

    const prompt = `
<role>
You are the Lead Developer performing SURGICAL REFINEMENT on a specific section of an SRS document. You previously generated this section and are now correcting identified issues.
</role>

<task>
Apply all feedback items to the '${targetSectionName}' section. Produce a FULLY UPDATED version of this section that incorporates every feedback point while maintaining technical consistency with the rest of the SRS.
</task>

<constraints>
1. Modify ONLY the target section. Do not alter content outside its scope.
2. Address every feedback item — do not skip any.
3. Maintain IEEE 830-1998 compliance and formal academic prose.
4. If feedback references diagrams, adhere to the Mermaid 11.x syntax standards.
5. Preserve all requirement identifiers and numbering from the original section.
</constraints>

${MERMAID_RULES}

<context>
<overall_architecture>${JSON.stringify(originalArchitecture, null, 2)}</overall_architecture>
</context>

<input>
Issues to Fix:
${JSON.stringify(feedback, null, 2)}

Current '${targetSectionName}' Draft:
${JSON.stringify(targetSectionDraft, null, 2)}

Original Raw Description:
${rawInput}
</input>
`;
    // We determine the schema to use based on the section name
    let schemaToUse = SRSSchema; // fallback
    if (targetSectionName === "Shell") schemaToUse = SRSShellSchema;
    if (targetSectionName === "Features") schemaToUse = SRSFeaturesSchema;
    if (targetSectionName === "Requirements") schemaToUse = SRSRequirementsSchema;

    return this.callLLM(prompt, 0.4, true, schemaToUse);
  }
}
