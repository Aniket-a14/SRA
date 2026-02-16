import { BaseAgent } from './BaseAgent.js';
import { constructMasterPrompt } from '../utils/prompts.js';

export class DeveloperAgent extends BaseAgent {
  constructor() {
    super("Lead Developer");
  }

  async generateSRS(requirements, architecture, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;

    // Use the default generator from v1_1_0 which maps to the full IEEE SRS structure
    const masterPrompt = await constructMasterPrompt({
      profile: "default",
      projectName
    }, version);

    const prompt = `
${masterPrompt}

### INPUT DATA:
Input Requirements (PO):
${JSON.stringify(requirements, null, 2)}

System Architecture (Architect):
${JSON.stringify(architecture, null, 2)}

### HISTORICAL_CONTEXT (REUSABLE REQUIREMENTS):
${ragContext || "No historical context available."}

### FINAL REMINDER:
You MUST return the output in the exact JSON schema defined in the system prompt above.
Ensure academic prose discipline. Volume and detail depth for each section MUST be judged based on the project's complexity; do NOT use arbitrary limits.
Use the ${projectName}- prefix for all requirements.
`;

    return this.callLLM(prompt, 0.4, true);
  }

  /**
   * Pillar 1: Agentic Reflection
   * Refines an existing SRS draft based on feedback from Reviewer/Critic agents.
   */
  async refineSRS(originalRequirements, originalArchitecture, previousDraft, feedback, settings = {}) {
    const { projectName = "Project" } = settings;

    const prompt = `
You are the Lead Developer. You previously generated an SRS draft, but it was audited and found to have issues.
Your goal is to REFINE the draft to address all feedback.

### ORIGINAL USER REQUIREMENTS:
${JSON.stringify(originalRequirements, null, 2)}

### ORIGINAL ARCHITECT DESIGN:
${JSON.stringify(originalArchitecture, null, 2)}

### PREVIOUS SRS DRAFT (WITH ISSUES):
${JSON.stringify(previousDraft, null, 2)}

### FEEDBACK FROM AUDITORS (Reviewer/Critic):
${JSON.stringify(feedback, null, 2)}

### INSTRUCTIONS:
1. Address EVERY piece of feedback provided above.
2. If there are security gaps, add the missing technical mitigations.
3. If there are logic contradictions, fix them.
4. Improve clarity and completeness based on the 6Cs standard.
5. You MUST return the output in the same JSON schema as the previous draft.

Ensure the final document is significantly improved and professional.
`;

    return this.callLLM(prompt, 0.3, true); // Low temperature for focused refinement
  }
}
