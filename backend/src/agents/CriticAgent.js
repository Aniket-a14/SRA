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

### AUDIT CRITERIA (INDUSTRY PERSPECTIVE):
1. **Faithful Translation**: Does the SRS accurately map the User Input into an IEEE-830 pattern?
2. **Structural Connection**: Do the features and requirements logically support the project's core purpose?
3. **Clarity & Patterns**: Is the document organization professional, even if some technical quantifiers are left for the dev team?
4. **Verifiability**: Are the requirements clear enough to be tested, given the level of detail in the input?
5. **Avoid Pedantry**: Do NOT penalize for "missing metrics" (e.g., exact RTO/RPO) if they were not in the input. Judge the quality of the translation and the soundness of the SRS pattern.

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
