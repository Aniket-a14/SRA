import { BaseAgent } from './BaseAgent.js';

/**
 * Critic Agent (Requirements Auditor)
 * Audits requirements against the 6Cs standard.
 */

const CRITIC_PROMPT = `
You are a Senior Requirements Auditor and Logic Critic.
Your goal is to audit a Software Requirements Specification (SRS) against the **6Cs of Requirements Quality**.

SRS Content:
{srs}

Evaluate the SRS based on the following criteria (Score 0.0 to 1.0):
1. **Clarity**: Is the language unambiguous? Are technical terms defined?
2. **Completeness**: Are all necessary modules (Login, Error handling, Auth) included? Any missing logical gaps?
3. **Conciseness**: Is the document free from filler words and redundant explanations?
4. **Consistency**: Do requirements contradict each other? Is terminology consistent?
5. **Correctness**: Does the technical design (Architect's input) match the functional goals?
6. **Context**: Is the system's boundary and operating environment well-defined?

Return ONLY JSON:
{{
  "scores": {{
    "clarity": 0.0,
    "completeness": 0.0,
    "conciseness": 0.0,
    "consistency": 0.0,
    "correctness": 0.0,
    "context": 0.0
  }},
  "overallScore": 0.0,
  "criticalIssues": ["List all critical issues that MUST be fixed. Judge appropriate quantity/depth based on project complexity."],
  "suggestions": ["List all relevant improvements to elevate the document. Adjust volume based on engineering judgment."]
}}
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
