import { BaseAgent } from './BaseAgent.js';
import { constructMasterPrompt } from '../utils/prompts.js';
import { SRSSchema, SRSShellSchema, SRSFeaturesSchema, SRSRequirementsSchema } from '../utils/aiSchemas.js';

export class DeveloperAgent extends BaseAgent {
  constructor() {
    super("Lead Developer", "gemini-2.5-flash");
  }

  /**
   * SECTION 1: generateShell
   * Focuses on Project Metadata, Introduction, and Overall Description.
   */
  async generateShell(requirements, architecture, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const masterPrompt = await constructMasterPrompt({ profile: "default", projectName }, version);

    const prompt = `
${masterPrompt}
## SUB-TASK: GENERATE SRS SHELL (INTRO & OVERVIEW)
You are generating the FOUNDATION of the SRS. Focus on accuracy, professional tone, and alignment with the architecture.

### INPUT DATA:
- Requirements: ${JSON.stringify(requirements, null, 2)}
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
  async generateFeatures(requirements, architecture, featuresChunk, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const masterPrompt = await constructMasterPrompt({ profile: "default", projectName }, version);

    const prompt = `
${masterPrompt}
## SUB-TASK: GENERATE SYSTEM FEATURES (SECTIONAL)
You are generating a specific block of 'systemFeatures'. 

### TARGET FEATURES TO DOCUMENT:
${JSON.stringify(featuresChunk, null, 2)}

### CONTEXT:
- Architecture: ${JSON.stringify(architecture, null, 2)}
- Historical Patterns: ${ragContext || "None"}

### INSTRUCTIONS:
1. For EACH target feature, generate: name, description, stimulusResponseSequences, and functionalRequirements.
2. Be technically precise. Map requirements to the provided architecture.
3. Use the ${projectName}- prefix.
`;

    return this.callLLM(prompt, 0.4, true, SRSFeaturesSchema);
  }

  /**
   * SECTION 3: generateRequirements (NFRs & Appendices)
   * Focuses on Interfaces, NFRs, Glossary, and high-fidelity Mermaid diagrams.
   */
  async generateRequirements(requirements, architecture, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const masterPrompt = await constructMasterPrompt({ profile: "default", projectName }, version);

    const prompt = `
${masterPrompt}
## SUB-TASK: GENERATE NFRs, INTERFACES & APPENDICES (MERMAID)
You are completing the SRS. This section includes the critical technical requirements and diagrams.

### INPUT DATA:
- Requirements: ${JSON.stringify(requirements, null, 2)}
- Architecture: ${JSON.stringify(architecture, null, 2)}
- Historical NFRs: ${ragContext || "None"}

### MERMAID DIAGRAM GOLD STANDARD (OFFICIAL 10.x+):
- **Flowcharts**: Use \`flowchart TD\`. 
  - Shapes: \`([Start/End])\`, \`[Process]\`, \`{Decision}\`, \`[/Input-Output/]\`, \`[(Database)]\`, \`[[Subroutine]]\`.
  - Links: \`-->\`, \`-.->\` (dotted), \`==>\` (thick).
- **Sequence Diagrams**: Use \`sequenceDiagram\`. 
  - Participants: USE \`actor User\` for humans, \`participant\` for systems.
  - Activation: USE \`+\` and \`-\` suffix on arrows for lifecycles (e.g., \`A->>+B: Request\`, \`B-->>-A: Response\`).
- **ERDs**: Use \`erDiagram\`. 
  - Fields: \`ENTITY { type name PK,FK }\` (NO COLONS).
  - Relationships: \`||--o{\` (1:N), \`||--||\` (1:1).

### CRITICAL RULES:
1. **NO COLONS** inside ERD entity blocks.
2. **NO PARENTHESES** in node IDs. Use double quotes for labels: \`A["Node Label"]\`.
`;

    return this.callLLM(prompt, 0.5, true, SRSRequirementsSchema);
  }

  async generateSRS(requirements, architecture, settings = {}) {
    // Legacy support or fallback. For SRA 4.0, direct orchestration in service is preferred.
    // However, keeping this for internal consistency if called.
    return this.generateShell(requirements, architecture, settings);
  }

  /**
   * Pillar 1: Agentic Reflection
   * Refines an existing SRS draft based on feedback.
   */
  async refineSRS(originalRequirements, originalArchitecture, previousDraft, feedback, settings = {}) {
    const { projectName = "Project" } = settings;

    const prompt = `
You are the Lead Developer. You previously generated an SRS, but it needs refinement.
Your goal is to perform SURGICAL REFINEMENT.

### ISSUES TO FIX:
${JSON.stringify(feedback, null, 2)}

### CONTEXT:
- Previous Draft: [Too large to display, focus on the feedback]
- Architecture: ${JSON.stringify(originalArchitecture, null, 2)}

### INSTRUCTIONS:
1. Provide a FULLY UPDATED version of the SRS that incorporates all feedback.
2. Ensure technical consistency across all sections.
3. Adhere to the official Mermaid 10.x syntax standards.
`;

    return this.callLLM(prompt, 0.4, true, SRSSchema);
  }
}
