import { BaseAgent } from './BaseAgent.js';
import { AuditSchema } from '../utils/aiSchemas.js';
import { createReviewSnapshot, stringifyForPrompt } from '../utils/promptCompaction.js';
import { TEMPERATURES } from '../utils/llmGenerationConfig.js';
import { structuralExpectationsFor, defectChecklistFor } from '../utils/prompt_templates/srs_drafting_standard.js';

/**
 * Critic Agent (Requirements Auditor)
 * Audits requirements against the 6Cs standard.
 */

export class CriticAgent extends BaseAgent {
    constructor(providerConfig = {}) {
        super("Senior QA Critic", providerConfig);
    }

    async auditSRS(originalRequirements, srsContent, spec = null) {
        const reviewSnapshot = createReviewSnapshot(originalRequirements, srsContent);
        const prompt = `
<role>
You are the requirements auditor. You score the document against the 6Cs quality framework — Clarity, Completeness, Conciseness, Consistency, Correctness, Context — and your score is what decides whether the draft is reworked or issued.
</role>

<task>
Audit the draft against the stakeholder input it was written from. Score each of the 6Cs (0-100), identify critical issues, give actionable suggestions, and assign an overall quality score.
</task>

${structuralExpectationsFor(spec)}
${defectChecklistFor(spec?.id)}

<constraints>
1. All scores (overallScore and the individual 6Cs) are on a scale of 0 to 100.
2. 85 or above means the document is fit to issue.
3. Score what is in front of you. A document with genuine ambiguities or contradictions must not reach 85, and a sound document must not be marked down to appear rigorous — a score that does not track quality is worse than no score.
4. Every critical issue names its location: the requirement identifier, feature name, or section title.
5. Completeness is judged against the input and the target format's own structure — whether every section the method defines is populated, not whether the document covers scope the stakeholder never raised.
6. Clarity is judged on verifiability: could a tester turn each requirement into a single objective pass/fail check? Unquantified thresholds and capability phrasing ("shall support") are clarity defects even when the input was thin, because the correct response to an unknown is a tracked TBD.
7. Consistency covers both logic (a requirement that defeats another) and terminology (one concept named two ways, or a domain term absent from the glossary).
8. Context is whether the document reads as a specification for THIS product in its stated domain, rather than boilerplate that would fit any system.
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
Compact Review Snapshot:
${stringifyForPrompt(reviewSnapshot)}
</input>

<output_format>
Return a valid JSON object matching the following schema. No markdown wrappers.
${stringifyForPrompt(AuditSchema)}
</output_format>
`;

        // mediumJson, not smallJson: a full audit is six scores, an IEEE compliance block, and
        // prose for every critical issue and suggestion — production ran out of room mid-object
        // and the recovered JSON was scored as if it were the model's verdict.
        const auditResult = await this.callLLM(prompt, TEMPERATURES.critic, true, AuditSchema, 3, 5000, {
            maxOutputTokens: this.tokenLimits.mediumJson
        });
        return auditResult;
    }
}
