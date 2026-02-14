import { BaseAgent } from './BaseAgent.js';
import { constructMasterPrompt } from '../utils/prompts.js';

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
Refine the following user request for the project "${projectName}" into a structured JSON refined intent.

User Input:
"${userInput}"

### OUTPUT SCHEMA (STRICTLY JSON ONLY):
{
  "projectTitle": "${projectName}",
  "scopeSummary": "Summarize the product scope and purpose. Judge appropriate length/depth based on complexity.",
  "features": [
    {
      "name": "Feature Name",
      "description": "Explain the feature value. Depth should scale with complexity.",
      "priority": "High/Medium/Low"
    },
    "... (Generate as many as needed based on project complexity)"
  ],
  "userStories": [
    {
      "role": "As a [Role]",
      "action": "I want to [Action]",
      "benefit": "So that [Benefit]",
      "acceptanceCriteria": ["Criteria 1", "Criteria 2"]
    },
    "... (Generate as many as needed)"
  ]
}
`;

    return this.callLLM(prompt, 0.7, true);
  }
}
