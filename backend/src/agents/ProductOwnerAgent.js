import { BaseAgent } from './BaseAgent.js';
import { RefinedIntentSchema } from '../utils/aiSchemas.js';

export class ProductOwnerAgent extends BaseAgent {
  constructor() {
    super("Product Owner");
  }

  async refineIntent(userInput, settings = {}) {
    const { projectName = "Project" } = settings;

    const personaInstruction = `
You are a Senior Business Analyst focused on Business Value and ROI.
Your goal is to refine vague user requests into a clear, structured list of features and user stories.
Emphasize business goals, user benefits, revenue impact, and operational efficiency.
    `;

    const prompt = `
${personaInstruction}

### SPECIFIC TASK:
Refine the following user request for the project "${projectName}" into a structured refined intent.

User Input:
"${userInput}"
`;

    return this.callLLM(prompt, 0.7, true, RefinedIntentSchema);
  }
}
