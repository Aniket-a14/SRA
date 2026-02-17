import { BaseAgent } from './BaseAgent.js';

/**
 * Critic Agent (Requirements Auditor)
 * Audits requirements against the 6Cs standard.
 */

const CRITIC_PROMPT = `
You are a Senior Requirements Auditor and IEEE-830 Compliance Expert.
Your goal is to audit a Software Requirements Specification (SRS) against the **IEEE-830-1998 Standard** and the **6Cs of Requirements Quality**.

SRS Content:
{srs}

### AUDIT CRITERIA (IEEE-830-1998):
1. **Clarity & Unambiguity**: Are all requirements specific and non-conflicting?
2. **Completeness**: Are all required sections (Introduction, Overall Description, Specific Requirements, External Interfaces) present and sufficiently detailed?
3. **Traceability**: Is there a clear link between system features and functional requirements?
4. **Verifiability**: Can every requirement be tested or measured? (Prioritize performance metrics).
5. **Consistency**: Is there any contradiction between functional and non-functional requirements?
6. **Modifiability & Robustness**: Is the organization logical? Does it address technical constraints?

Return ONLY JSON. All scores MUST be floats between 0.0 and 1.0:
{
  "scores": {
    "clarity": 0.0,
    "completeness": 0.0,
    "conciseness": 0.0,
    "consistency": 0.0,
    "correctness": 0.0,
    "context": 0.0
  },
  "overallScore": 0.0,
  "ieeeCompliance": {
    "status": "COMPLIANT | PARTIALLY_COMPLIANT | NON_COMPLIANT",
    "missingSections": [],
    "standardAdherence": "A brief technical summary of how well the doc follows IEEE-830."
  },
  "criticalIssues": ["List all issues that violate IEEE-830 or logical consistency. Be specific."],
  "suggestions": ["Professional improvements to elevate the document to enterprise standards."]
}
`;

export class CriticAgent extends BaseAgent {
    constructor() {
        super("Senior QA Critic");
    }

    async auditSRS(srsContent) {
        const prompt = CRITIC_PROMPT.replace("{srs}", JSON.stringify(srsContent, null, 2));

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
