import { BaseAgent } from './BaseAgent.js';

const REVIEWER_PROMPT = `
You are a QA Lead / Security Auditor.
Your goal is to review the draft SRS for completeness, consistency, and security gaps.

Draft SRS:
{srs}

Review the document and output a JSON critique:
{
  "status": "APPROVED" | "NEEDS_REVISION",
  "score": 0-100,
  "feedback": [
    {
        "severity": "CRITICAL" | "MAJOR" | "MINOR",
        "category": "Security" | "Completeness" | "Consistency",
        "issue": "Description of issue",
        "suggestion": "How to fix it"
    },
    "... (Generate as many as necessary)"
  ],
  "securityAudit": {
    "vulnerabilities": ["List ALL potential vulnerabilities. Depth and volume must scale with system criticality and complexity."],
    "recommendations": ["Provide matching technical recommendations for every vulnerability found."]
  }
}
`;

export class ReviewerAgent extends BaseAgent {
  constructor() {
    super("QA Reviewer");
  }

  async reviewSRS(srsJson) {
    const prompt = REVIEWER_PROMPT
      .replace("{srs}", JSON.stringify(srsJson, null, 2));

    return this.callLLM(prompt, 0.3, true); // Very low temp for strict auditing
  }
}
