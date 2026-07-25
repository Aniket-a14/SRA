import { BaseAgent } from './BaseAgent.js';
import { ReviewSchema } from '../utils/aiSchemas.js';
import { createReviewSnapshot, stringifyForPrompt } from '../utils/promptCompaction.js';
import { TEMPERATURES } from '../utils/llmGenerationConfig.js';
import { structuralExpectationsFor, defectChecklistFor } from '../utils/prompt_templates/srs_drafting_standard.js';

export class ReviewerAgent extends BaseAgent {
  constructor(providerConfig = {}) {
    super("QA Reviewer", providerConfig);
  }

  async reviewSRS(originalRequirements, srsJson, spec = null) {
    const reviewSnapshot = createReviewSnapshot(originalRequirements, srsJson);
    const prompt = `
<role>
You are the reviewer on a requirements inspection. Your job is to decide whether this document could be handed to a delivery team and a test team without them having to come back and ask what was meant.
</role>

<task>
Review the draft against the stakeholder input it was written from. Assign a status (APPROVED or REJECTED) and a score (0-100).
</task>

${structuralExpectationsFor(spec)}
${defectChecklistFor(spec?.id)}

<constraints>
1. Score on a scale of 0 to 100. 85 or above means the document is fit to issue.
2. For the status field, use ONLY "APPROVED" or "REJECTED" (all caps).
3. Cite the specific location of every defect — the requirement identifier, feature name, or section title. A finding a reader cannot locate cannot be fixed.
4. Judge the document against the input it was given. Missing scope the stakeholder never raised is not a defect; a vague requirement is a defect regardless of how thin the input was, because the correct response to an unknown is a tracked TBD, not an unverifiable sentence.
5. Distinguish what is wrong from what you would have written differently. Report defects, not preferences.
6. Report at most the 3 most severe findings, in plain text, without code fences or quoted examples.
7. Avoid double quotes inside string fields unless technically necessary.
8. Mermaid syntax: no activation bars (+/-) in sequence diagrams; no colons in ERD field blocks.
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
Compact Review Snapshot:
${stringifyForPrompt(reviewSnapshot)}
</input>

<output_format>
Return a valid JSON object matching the following schema. No markdown wrappers.
${stringifyForPrompt(ReviewSchema)}
</output_format>
`;

    return this.callLLM(prompt, TEMPERATURES.critic, true, ReviewSchema, 3, 5000, {
      maxOutputTokens: this.tokenLimits.mediumJson
    });
  }
}
