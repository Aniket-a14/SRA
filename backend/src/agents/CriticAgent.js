import { BaseAgent } from './BaseAgent.js';

/**
 * Critic Agent (Requirements Auditor)
 * Audits requirements against the 6Cs standard.
 */

const CRITIC_PROMPT = `
You are a Senior Requirements Auditor. Your goal is to audit a Software Requirements Specification (SRS) against the **Original User Requirements** to ensure it creates a professional and faithful technical bridge.

### ORIGINAL USER REQUIREMENTS:
{originalRequirements}

### GENERATED SRS DRAFT:
{srs}

### AUDIT CRITERIA (IEEE INDUSTRIAL PERSPECTIVE):
1. **Faithful Translation**: Does the SRS accurately map the User Input into an IEEE-830 pattern?
2. **Structural Integrity (Section 4.x)**: Does every system feature contain the required 4.x.1 (Description/Priority), 4.x.2 (Stimulus), and 4.x.3 (Functional) sub-sections?
3. **Quality Attribute Coverage (Section 5.4)**: Does the SRS explicitly address applicable attributes like Adaptability, Portability, and Maintainability?
4. **Logical Consistency**: Are there technical contradictions? (e.g., "Requires 2FA" vs "Only basic email login allowed").
5. **No Pedantry**: Do NOT penalize for missing metrics if they were not in the Original requirements. Judge based on faithful mapping.
6. **Appendix C (TBD Management)**: If "TBD" or "placeholder" strings are found in the body, are they accurately summarized in Appendix C?

Return ONLY JSON. All scores MUST be integers between 0 and 100:
{
  "scores": {
    "clarity": 0,
    "completeness": 0,
    "conciseness": 0,
    "consistency": 0,
    "correctness": 0,
    "context": 0
  },
  "overallScore": 0,
  "ieeeCompliance": {
    "status": "COMPLIANT | PARTIALLY_COMPLIANT | NON_COMPLIANT",
    "missingSections": [],
    "standardAdherence": "Summary of how well the doc follows the SRS pattern."
  },
  "criticalIssues": ["Issues where the SRS severely diverges from or ignores the input. Be specific."],
  "suggestions": ["Improvements to the mapping or professional tone."]
}
`;

export class CriticAgent extends BaseAgent {
    constructor() {
        super("Senior QA Critic");
    }

    async auditSRS(originalRequirements, srsContent) {
        const prompt = CRITIC_PROMPT
            .replace("{originalRequirements}", JSON.stringify(originalRequirements, null, 2))
            .replace("{srs}", JSON.stringify(srsContent, null, 2));

        try {
            const auditResult = await this.callLLM(prompt, 0.3, true);
            return auditResult;
        } catch (error) {
            console.error("Audit Error:", error);
            return {
                scores: {
                    clarity: 0, completeness: 0, conciseness: 0, consistency: 0, correctness: 0, context: 0
                },
                overallScore: 0,
                criticalIssues: ["Audit engine failed to process the SRS."],
                suggestions: []
            };
        }
    }
}
