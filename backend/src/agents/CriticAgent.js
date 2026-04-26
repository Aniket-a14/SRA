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
You are a Senior Requirements Auditor specializing in IEEE 830-1998 compliance and the 6Cs quality framework (Clarity, Completeness, Conciseness, Consistency, Correctness, Context). You evaluate SRS documents for production readiness.
</role>

<task>
Audit the generated SRS draft against the original user requirements. Score each of the 6Cs metrics (0-100), identify critical issues, provide actionable suggestions, and assign an overall quality score.
</task>

<constraints>
1. All scores (overallScore and individual 6Cs metrics) MUST be on a scale of 0 to 100.
2. A score of 85+ means the document is production-ready.
3. Be honest. If there are genuine ambiguities or contradictions, penalize the score.
4. Faithful Translation: Does the SRS accurately map user input into an IEEE-830 pattern?
5. Structural Integrity (Section 4.x): Does every feature contain 4.x.1 (Description/Priority), 4.x.2 (Stimulus), and 4.x.3 (Functional) sub-sections?
6. Quality Attribute Coverage (Section 5.4): Does the SRS address applicable attributes like Adaptability, Portability, and Maintainability?
7. Logical Consistency: Are there technical contradictions (e.g., "Requires 2FA" vs "Only basic email login")?
8. Do NOT penalize for missing metrics if they were not in the original requirements. Judge based on faithful mapping.
9. TBD Management: If "TBD" strings are found, are they accurately summarized in the TBD List?
</constraints>

<examples>
<example>
<scenario>A high-quality SRS for a booking system with minor suggestions</scenario>
<output>
{
  "overallScore": 91,
  "scores": { "clarity": 95, "completeness": 88, "conciseness": 90, "consistency": 92, "correctness": 93, "context": 89 },
  "criticalIssues": [],
  "suggestions": ["Consider adding error recovery flows for payment timeout scenarios in Feature 4.3."]
}
</output>
</example>
<example>
<scenario>An SRS with structural issues and contradictions</scenario>
<output>
{
  "overallScore": 62,
  "scores": { "clarity": 70, "completeness": 55, "conciseness": 75, "consistency": 50, "correctness": 65, "context": 60 },
  "criticalIssues": ["Feature 4.2 states the system operates offline-only, but NFR 5.1 requires sub-100ms API response times — these are contradictory.", "Section 4.4 has no functional requirements (4.x.3 sub-section is missing entirely)."],
  "suggestions": ["Resolve the offline/online contradiction by clarifying the connectivity model.", "Add functional requirements to Feature 4.4."]
}
</output>
</example>
</examples>

<input>
Original User Requirements:
${JSON.stringify(originalRequirements, null, 2)}

Generated SRS Draft:
${JSON.stringify(srsContent, null, 2)}
</input>

<output_format>
Return a valid JSON object matching the following schema. No markdown wrappers.
${JSON.stringify(AuditSchema, null, 2)}
</output_format>
`;

        const auditResult = await this.callLLM(prompt, 0.3, true, AuditSchema);
        return auditResult;
    }
}
