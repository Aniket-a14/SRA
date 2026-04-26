import { BaseAgent } from './BaseAgent.js';
import { constructMasterPrompt } from '../utils/prompts.js';
import { SRSSchema, SRSShellSchema, SRSFeaturesSchema, SRSRequirementsSchema, SRSAppendicesSchema } from '../utils/aiSchemas.js';

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
## SUB-TASK: GENERATE SRS SHELL (INTRO & OVERVIEW)
You are generating the FOUNDATION of the SRS. Focus on accuracy, professional tone, and alignment with the architecture.

### INPUT DATA:
- Original Raw Description: ${rawInput}
- Refined Requirements: ${JSON.stringify(requirements, null, 2)}
- Architecture: ${JSON.stringify(architecture, null, 2)}

### HISTORICAL_CONTEXT:
${ragContext || "No historical context available."}

### INSTRUCTIONS:
1. Generate the 'projectTitle', 'revisionHistory', 'introduction', and 'overallDescription'.
2. Use the ${projectName}- prefix for requirements.
3. Ensure the 'productFunctions' in overallDescription are high-level summaries of the core intent.
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
## SUB-TASK: GENERATE SYSTEM FEATURES (SECTIONAL)
You are generating a specific block of 'systemFeatures'. 

### TARGET FEATURES TO DOCUMENT:
${JSON.stringify(featuresChunk, null, 2)}

### CONTEXT:
- Original Raw Description: ${rawInput}
- Foundation (Section 1): ${JSON.stringify(section1)}
- Architecture: ${JSON.stringify(architecture, null, 2)}
- Historical Patterns: ${ragContext || "None"}

### INSTRUCTIONS:
1. For EACH target feature, generate: name, description, stimulusResponseSequences, and functionalRequirements.
2. The 'description' MUST be a comprehensive, multi-paragraph explanation of the feature's value, behavior, and workflow. Do NOT use one-liners.
3. Functional requirements must be exhaustive, specifically detailing edge cases, validation, and error handling.
4. Use the ${projectName}- prefix.
`;

    return this.callLLM(prompt, 0.4, true, SRSFeaturesSchema);
  }

  /**
   * SECTION 3: generateRequirements (NFRs & Appendices)
   * Focuses on Interfaces, NFRs, Glossary, and high-fidelity Mermaid diagrams.
   */
  async generateRequirements(rawInput, sections1And2, requirements, architecture, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const masterPrompt = await constructMasterPrompt(null, { profile: "default", projectName }, version);

    const prompt = `
${masterPrompt}
## SUB-TASK: GENERATE NFRs, INTERFACES & APPENDICES (MERMAID)
You are completing the SRS. This section includes the critical technical requirements and diagrams.

### INPUT DATA:
- Original Raw Description: ${rawInput}
- Previous Sections (1 & 2): ${JSON.stringify(sections1And2)}
- Refined Requirements: ${JSON.stringify(requirements, null, 2)}
- Architecture: ${JSON.stringify(architecture, null, 2)}
- Historical NFRs: ${ragContext || "None"}

### MERMAID DIAGRAM GOLD STANDARD (OFFICIAL 11.x+):
- **Flowcharts**: Use \`flowchart TD\`. 
  - Shapes: \`([Start/End])\`, \`[Process]\`, \`{Decision}\`, \`[/Input-Output/]\`, \`[(Database)]\`, \`[[Subroutine]]\`.
  - Links: \`-->\`, \`-.->\` (dotted), \`==>\` (thick).
- **Sequence Diagrams**: Use \`sequenceDiagram\`. 
  - Participants: USE \`actor User\` for humans, \`participant\` for systems.
  - Activation: DO NOT USE lifecycle activations (\`+\` or \`-\` or \`activate\` kw). They cause crashes. Just use standard arrows (\`A->>B:\`, \`B-->>A:\`).
- **ERDs**: Use \`erDiagram\`. 
  - Fields: \`ENTITY { type name PK,FK }\` (NO COLONS).
  - Relationships: \`||--o{\` (1:N), \`||--||\` (1:1).

### CRITICAL RULES:
1. **NO COLONS** inside ERD entity blocks.
2. **NO PARENTHESES** in node IDs. Use double quotes for labels: \`A["Node Label"]\`.
3. **NO ACTIVATIONS** in sequence diagrams. Never use '+' or '-' suffixes.
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

### SPECIFIC INSTRUCTION:
Generate ONLY the [Appendices] section containing purely Analysis Models (Mermaid Diagrams) and the TBD List.

- Raw Description: ${JSON.stringify(rawInput, null, 2)}
- Context (Do not repeat, strictly use for diagram mapping):
${JSON.stringify(previousSections, null, 2)}
- Architecture Input: ${JSON.stringify(architecture, null, 2)}

### MERMAID DIAGRAM GOLD STANDARD (OFFICIAL 11.x+):
- **Flowcharts**: Use \`flowchart TD\`. 
  - Shapes: \`([Start/End])\`, \`[Process]\`, \`{Decision}\`, \`[/Input-Output/]\`, \`[(Database)]\`, \`[[Subroutine]]\`.
  - Links: \`-->\`, \`-.->\` (dotted), \`==>\` (thick).
- **Sequence Diagrams**: Use \`sequenceDiagram\`. 
  - Participants: USE \`actor User\` for humans, \`participant\` for systems.
  - Activation: DO NOT USE lifecycle activations (\`+\` or \`-\` or \`activate\` kw). They cause crashes. Just use standard arrows (\`A->>B:\`, \`B-->>A:\`).
- **ERDs**: Use \`erDiagram\`. 
  - Fields: \`ENTITY { type name PK,FK }\` (NO COLONS).
  - Relationships: \`||--o{\` (1:N), \`||--||\` (1:1).
  - IMPORTANT: Limit to the top 10-12 core entities. Do NOT exceed this or the output will break.

### CRITICAL RULES:
1. **NO COLONS** inside ERD entity blocks.
2. **NO PARENTHESES** in node IDs. Use double quotes for labels: \`A["Node Label"]\`.
3. **NO ACTIVATIONS** in sequence diagrams. Never use '+' or '-' suffixes.
`;

    return this.callLLM(prompt, 0.4, true, SRSAppendicesSchema);
  }

  async generateSRS(requirements, architecture, settings = {}) {
    // Legacy support or fallback. For SRA 4.0, direct orchestration in service is preferred.
    // However, keeping this for internal consistency if called.
    return this.generateShell(requirements, architecture, settings);
  }

  /**
   * Pillar 1: Agentic Reflection
   * Refines a specific TARGET SECTION of an existing SRS draft based on feedback.
   */
  async refineSRS(rawInput, originalRequirements, originalArchitecture, targetSectionDraft, targetSectionName, feedback, settings = {}) {
    const { projectName = "Project" } = settings;

    const prompt = `
You are the Lead Developer. You previously generated the '${targetSectionName}' section of an SRS.
Your goal is to perform SURGICAL REFINEMENT on this specific section only.

### ISSUES TO FIX:
${JSON.stringify(feedback, null, 2)}

### CONTEXT:
- Original Raw Description: ${rawInput}
- Target Section Current Draft: ${JSON.stringify(targetSectionDraft, null, 2)}
- Overall Architecture: ${JSON.stringify(originalArchitecture, null, 2)}

### INSTRUCTIONS:
1. Provide a FULLY UPDATED version of the '${targetSectionName}' section that incorporates all feedback.
2. Ensure technical consistency.
3. Adhere to the official Mermaid 11.x syntax standards if modifying diagrams.
`;
    // We determine the schema to use based on the section name
    let schemaToUse = SRSSchema; // fallback
    if (targetSectionName === "Shell") schemaToUse = SRSShellSchema;
    if (targetSectionName === "Features") schemaToUse = SRSFeaturesSchema;
    if (targetSectionName === "Requirements") schemaToUse = SRSRequirementsSchema;

    return this.callLLM(prompt, 0.4, true, schemaToUse);
  }
}
