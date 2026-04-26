import { BaseAgent } from './BaseAgent.js';
import { ReviewSchema } from '../utils/aiSchemas.js';

export class ReviewerAgent extends BaseAgent {
  constructor() {
    super("QA Reviewer");
  }

  async reviewSRS(originalRequirements, srsJson) {
    const prompt = `
<role>
You are a Senior QA Lead specializing in IEEE 830-1998 SRS document review. You evaluate whether generated SRS documents faithfully represent the original user requirements while maintaining professional engineering standards.
</role>

<task>
Review the generated SRS draft against the original user requirements. Evaluate quality, structure, and adherence to IEEE standards. Assign a final status (APPROVED or REJECTED) and a numeric score (0-100).
</task>

<constraints>
1. Score MUST be on a scale of 0 to 100. A score of 85+ means the document is production-ready.
2. For the status field, use ONLY "APPROVED" or "REJECTED" (all caps).
3. Judge based on the faithful bridge pattern — does the SRS accurately translate user intent into technical specification?
4. Do NOT reject for missing metrics if the original input was thin. Focus on bridge quality, not pedantry.
5. Faithfulness: Does the SRS capture the intent of the original requirements?
6. Structural Pattern: Does it follow IEEE-830 Section 3/4 separation?
7. Consistency: Are there contradictions between features and NFRs?
8. Pragmatism: Is technical depth balanced with original input complexity?
9. TBD Auditing: Flag "TBD" items not correctly mirrored in the TBD List.
10. Security & Logic: Flag obvious logical contradictions or massive security oversights.
11. Mermaid Syntax: No activation bars (+/-) in sequence diagrams. No colons in ERD field blocks.
</constraints>

<examples>
<example>
<scenario>A well-written SRS that faithfully maps a simple task management app description</scenario>
<output>
{
  "status": "APPROVED",
  "score": 92,
  "feedback": [
    { "severity": "MINOR", "category": "Completeness", "issue": "The glossary could include 2-3 additional domain terms for clarity." }
  ]
}
</output>
</example>
<example>
<scenario>An SRS that invents a crypto payment module for a basic note-taking app</scenario>
<output>
{
  "status": "REJECTED",
  "score": 45,
  "feedback": [
    { "severity": "MAJOR", "category": "Faithfulness", "issue": "Section 4.5 introduces a Cryptocurrency Payment Gateway that has no basis in the original requirements. This is scope hallucination." },
    { "severity": "MAJOR", "category": "Consistency", "issue": "NFR states 'offline-first architecture' but Feature 4.3 requires real-time WebSocket connections." }
  ]
}
</output>
</example>
</examples>

<input>
Original User Requirements:
${JSON.stringify(originalRequirements, null, 2)}

Generated SRS Draft:
${JSON.stringify(srsJson, null, 2)}
</input>

<output_format>
Return a valid JSON object matching the following schema. No markdown wrappers.
${JSON.stringify(ReviewSchema, null, 2)}
</output_format>
`;

    return this.callLLM(prompt, 0.3, true, ReviewSchema);
  }
}
