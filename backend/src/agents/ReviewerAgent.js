import { BaseAgent } from './BaseAgent.js';
import { ReviewSchema } from '../utils/aiSchemas.js';

const REVIEWER_PROMPT = `
You are a Senior QA Lead. Your goal is to review if the generated SRS draft is a professional, faithful, and logically connected representation of the Original User Requirements.

### IMPORTANT: SCORING RULES
1. The score MUST be on a scale of 0 to 100.
2. A score of 85+ means the document is production-ready.
3. Judge based on the faithful bridge pattern, not pedantry.
4. For the **status** field: Use ONLY "APPROVED" or "REJECTED" (all caps).

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
8. **Mermaid Syntax (Specialist Edition)**: Verify that the 3 core diagrams (Flowchart, Sequence, ERD) use specialized shapes (e.g., [(Database)], [/IO/]) and activation bars (+/-) for sequence flows. Correct any legacy 'graph' or colon-heavy ERD syntax.
`;

export class ReviewerAgent extends BaseAgent {
  constructor() {
    super("QA Reviewer", "gemini-2.5-flash");
  }

  async reviewSRS(originalRequirements, srsJson) {
    const prompt = REVIEWER_PROMPT
      .replace("{originalRequirements}", JSON.stringify(originalRequirements, null, 2))
      .replace("{srs}", JSON.stringify(srsJson, null, 2));

    return this.callLLM(prompt, 0.3, true, ReviewSchema);
  }
}
