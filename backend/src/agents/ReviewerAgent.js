import { BaseAgent } from './BaseAgent.js';
import { ReviewSchema } from '../utils/aiSchemas.js';

export class ReviewerAgent extends BaseAgent {
  constructor() {
    super("QA Reviewer");
  }

  async reviewSRS(originalRequirements, srsJson) {
    const prompt = `
<role>
You are a Senior QA Lead. Your goal is to review if the generated SRS draft is a professional, faithful, and logically connected representation of the Original User Requirements.
</role>

<task>
Read the original requirements and the generated SRS document. Evaluate the quality, structure, and adherence to constraints to assign a final status and score.
</task>

<constraints>
[SCORING RULES]
1. The score MUST be on a scale of 0 to 100.
2. A score of 85+ means the document is production-ready.
3. Judge based on the faithful bridge pattern, not pedantry.
4. For the status field: Use ONLY "APPROVED" or "REJECTED" (all caps).

[REVIEW GUIDELINES (IEEE STANDARDS)]
1. Faithfulness: Does the SRS capture the intent of the Original requirements?
2. Structural Pattern: Does it follow the Section 3/4 separation as per IEEE-830?
3. Consistency: Are there no contradictions between features and NFRs?
4. Pragmatism: Is the technical depth balanced with the original input complexity?
5. No Pedantry: Do NOT reject for missing metrics if the input was thin; focus on the bridge pattern quality.
6. TBD Auditing: Flag any "TBD" or "To Be Determined" items that are NOT correctly mirrored in the TBD List.
7. Security & Logic: Flag obvious logical contradictions or massive security oversights relative to the input.
8. Mermaid Syntax: 
   - CRITICAL: For Sequence Diagrams, DO NOT use activation bars (+/-).
   - CRITICAL: For ERDs, ensure NO COLONS are used in field blocks.
</constraints>

<output_format>
Return a valid JSON object matching the following schema. No markdown wrappers.
${JSON.stringify(ReviewSchema, null, 2)}
</output_format>

<input>
Original User Requirements:
${JSON.stringify(originalRequirements, null, 2)}

Generated SRS Draft:
${JSON.stringify(srsJson, null, 2)}
</input>
`;

    return this.callLLM(prompt, 0.3, true, ReviewSchema);
  }
}
