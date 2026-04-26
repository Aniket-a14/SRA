import { BaseAgent } from './BaseAgent.js';
import { AuditSchema } from '../utils/aiSchemas.js';

/**
 * Critic Agent (Requirements Auditor)
 * Audits requirements against the 6Cs standard.
 */

export class CriticAgent extends BaseAgent {
    constructor() {
        super("Senior QA Critic");
    }

    async auditSRS(originalRequirements, srsContent) {
        const prompt = `
<role>
You are a Senior Requirements Auditor. Your goal is to audit a Software Requirements Specification (SRS) against the Original User Requirements to ensure it creates a professional and faithful technical bridge.
</role>

<task>
Analyze the original requirements and the generated SRS draft. Evaluate against established criteria, provide scores (0-100), and point out areas for improvement.
</task>

<constraints>
[SCORING RULES]
1. All scores (overallScore and individual metrics) MUST be on a scale of 0 to 100.
2. A score of 85+ means the document is production-ready.
3. Be brutally honest. If there are ambiguities, penalize the score.

[AUDIT CRITERIA (IEEE INDUSTRIAL PERSPECTIVE)]
1. Faithful Translation: Does the SRS accurately map the User Input into an IEEE-830 pattern?
2. Structural Integrity (Section 4.x): Does every system feature contain the required 4.x.1 (Description/Priority), 4.x.2 (Stimulus), and 4.x.3 (Functional) sub-sections?
3. Quality Attribute Coverage (Section 5.4): Does the SRS explicitly address applicable attributes like Adaptability, Portability, and Maintainability?
4. Logical Consistency: Are there technical contradictions? (e.g., "Requires 2FA" vs "Only basic email login allowed").
5. No Pedantry: Do NOT penalize for missing metrics if they were not in the Original requirements. Judge based on faithful mapping.
6. TBD Management: If "TBD" or "placeholder" strings are found in the body, are they accurately summarized in the TBD List?
</constraints>

<output_format>
Return a valid JSON object matching the following schema. No markdown wrappers.
${JSON.stringify(AuditSchema, null, 2)}
</output_format>

<input>
Original User Requirements:
${JSON.stringify(originalRequirements, null, 2)}

Generated SRS Draft:
${JSON.stringify(srsContent, null, 2)}
</input>
`;

        const auditResult = await this.callLLM(prompt, 0.3, true, AuditSchema);
        return auditResult;
    }
}
