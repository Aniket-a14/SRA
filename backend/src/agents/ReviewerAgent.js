import { BaseAgent } from './BaseAgent.js';

const REVIEWER_PROMPT = `
You are a Senior QA Lead. Your goal is to review if the generated SRS draft is a professional, faithful, and logically connected representation of the Original User Requirements.

### ORIGINAL USER REQUIREMENTS:
{originalRequirements}

### GENERATED SRS DRAFT:
{srs}

### REVIEW GUIDELINES (IEEE STANDARDS):
1. **Faithfulness**: Does the SRS capture the intent of the Original requirements?
2. **Structural Pattern**: Does it follow the Section 3/4 separation as per IEEE-830?
3. **Consistency**: Are there no contradictions between features and NFRs?
4. **Pragmatism**: Is the technical depth balanced with the original input complexity?
5. **No Pedantry**: Do NOT reject for missing metrics if the input was thin; focus on the bridge pattern quality.
6. **TBD Auditing**: Flag any "TBD" or "To Be Determined" items that are NOT correctly mirrored in Appendix C.
7. **Security & Logic**: Flag obvious logical contradictions or massive security oversights relative to the input.

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
