import { BaseAgent } from './BaseAgent.js';
import { constructMasterPrompt } from '../utils/prompts.js';

export class DeveloperAgent extends BaseAgent {
  constructor() {
    super("Lead Developer");
  }

  async generateSRS(requirements, architecture, settings = {}) {
    const { projectName = "Project", version = "latest" } = settings;

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

### FINAL REMINDER:
You MUST return the output in the exact JSON schema defined in the system prompt above.
Ensure academic prose discipline. Volume and detail depth for each section MUST be judged based on the project's complexity; do NOT use arbitrary limits.
Use the ${projectName}- prefix for all requirements.
`;

    return this.callLLM(prompt, 0.4, true);
  }
}
