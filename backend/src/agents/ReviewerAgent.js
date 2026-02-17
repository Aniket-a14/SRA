import { BaseAgent } from './BaseAgent.js';

const REVIEWER_PROMPT = `
You are a Senior QA Lead. Your goal is to review if the generated SRS draft is a professional, faithful, and logically connected representation of the Original User Requirements.

### ORIGINAL USER REQUIREMENTS:
{originalRequirements}

### GENERATED SRS DRAFT:
{srs}

### REVIEW GUIDELINES (INDUSTRY STANDARDS):
1. **Faithfulness**: Does the SRS capture the intent of the Original requirements?
2. **Structural Pattern**: Does the SRS follow a professional IEEE-830 pattern?
3. **Internal Connection**: Are the requirements logically connected across sections?
4. **Pragmatism**: Do not penalize for a lack of hyper-quantified metrics (e.g., exact latency numbers) if they were not provided in the Original Requirements. These are for the technical team to define later.
5. **Security & Logic**: Flag obvious logical contradictions or massive security oversights relative to the input.

Review the document and output a JSON critique:
{
  "status": "APPROVED" | "NEEDS_REVISION",
  "score": 0-100,
  "feedback": [
    {
        "severity": "CRITICAL",
        "category": "Security" | "Completeness" | "Consistency",
        "issue": "Technical description of the specific issue found.",
        "suggestion": "Concrete steps to resolve the issue."
    }
  ],
  "securityAudit": {
    "vulnerabilities": ["List major vulnerabilities relative to the input."],
    "recommendations": ["Matching technical recommendations."]
  }
}
`;

export class ReviewerAgent extends BaseAgent {
  constructor() {
    super("QA Reviewer");
  }

  async reviewSRS(originalRequirements, srsJson) {
    const prompt = REVIEWER_PROMPT
      .replace("{originalRequirements}", JSON.stringify(originalRequirements, null, 2))
      .replace("{srs}", JSON.stringify(srsJson, null, 2));

    return this.callLLM(prompt, 0.3, true); // Very low temp for strict auditing
  }
}
