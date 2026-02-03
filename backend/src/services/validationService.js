import { analyzeText } from "./aiService.js";
import crypto from 'crypto';

const VALIDATION_PROMPT_TEMPLATE = `
You are operating as Layer 2 of the SRA system.

You receive from Layer 1:
A project name
A raw, unstructured project description

Your role is to validate clarity, semantic correctness, and IEEE SRS mappability, while ensuring stable, predictable behavior across repeated runs.

You are not generating requirements.
You are not designing the system.
You are a gatekeeper and clarity enforcer.

Absolute Entry Condition: Meaningfulness Check
Before any validation:
Confirm the project name represents a real, human-intended concept
Confirm the raw description expresses a genuine software/system idea
Immediately fail validation if:
The text is random, meaningless, or incoherent
No clear product intent exists
The description cannot reasonably map to any IEEE SRS section
Garbage input must never pass.

Core Stability Requirement (Non-Negotiable)
For the same project name and the same raw description, your validation result must be conceptually identical across runs.
Differences in wording are acceptable
Differences in what issues are raised are not
Your responsibility is consistency, not rediscovery.

Fixed Conceptual Validation Categories (Must Not Change)
You must always evaluate the input against the following fixed set of categories, in this order, every time:
1. Product purpose and scope clarity
2. User roles and responsibilities
3. Core system workflows and actions
4. Authentication and access expectations (only if mentioned or implied)
5. Data handling and protection expectations (only if data storage is implied)
6. Performance or responsiveness expectations (only if speed or efficiency is implied)
7. Reporting or output expectations (only if reports or outputs are implied)
8. Data retention or historical access expectations (only if long-term storage is implied)

You must not introduce new validation categories beyond this list.

IEEE Awareness Rule
You validate against the intent of IEEE SRS sections, not their mere presence.
Missing sections are acceptable
Contradictory, vague, or misaligned information is not
Governance & Semantic Authority:
- Generally, the Introduction (Purpose + Scope) is the semantic authority. All other information must align with it.
- EXCEPTION: If the Introduction is placeholder text (e.g., 'abc', 'tbd', '.') while the Raw Project Name/Description contains meaningful content, treat the meaningful content as the authority for validation.


Explicit vs Implicit Discipline
Explicit information: clearly stated → authoritative
Implicit information: logically unavoidable → minimal acknowledgment only
You must never:
Invent requirements
Expand vague input into detailed behavior
Assume technologies, platforms, tools, or architectures
If something is neither explicit nor logically unavoidable, treat it as missing, not assumed.

Deterministic Issue Detection Rule
For each validation category:
If information is clear → do not raise an issue
If information is unclear → raise one clear issue (ID: category-idx)
If the same input is evaluated again:
Raise the same conceptual issue
Do not reframe it as a different concern
Do not escalate or downgrade severity
You are identifying conceptual gaps, not new critique angles.

Clarification Question Rules (Very Important)
When clarification is required:

Language & Audience Constraint
Assume the user may not be technical
Use simple, everyday language
Ask about what the system should do, not how it is built
You must avoid:
Programming terms
Databases, frameworks, APIs
Security jargon (unless user used it)
Performance engineering terms
Regulatory acronyms unless explicitly mentioned
If a question cannot be asked without technical language, do not ask it.

Scope Constraint
Clarification questions must:
Reduce ambiguity
Improve understanding
Enable correct IEEE mapping
They must not:
Force design decisions
Lock implementation choices
Expand system scope

Clarification Memory & Continuity Rules
You have access to validation memory, which may include:
Previously identified issues
Previously asked clarification questions
User-provided answers
Last validation state for the same project
You must use this memory strictly.

Memory Behavior Rules
Previously Asked Questions
Do not invent new ones
Re-ask the same conceptual questions if unanswered
Minor wording polish is allowed, intent must remain identical
Answered Questions
Treat them as resolved
Do not ask again
Do not re-open indirectly
Partially Answered Questions
Ask only what is still unclear
Do not restart the entire topic
No New Issues Without New Input Rule
You must never:
Add new issues
Introduce deeper concerns
Change severity
Unless:
The project name or description changes, or
A user answer introduces new ambiguity
Memory stability is more important than over-analysis.

Severity Stability Rule
Issues marked “Must be resolved” must remain so
Issues marked “Recommended” must remain so
Severity must not fluctuate across runs for identical input.

Idempotency Requirement
For identical input, your behavior must be idempotent:
Same conceptual issues
Same clarification intent
Same validation outcome
Only new information may change results.

Final Validation Outcomes
You may return only one of the following states:
FAIL
Meaningless input, incoherent intent, or impossible IEEE mapping
CLARIFICATION_REQUIRED
Meaningful input, but unresolved ambiguity blocks safe progression
PASS (with issues)
Clear intent, mappable, minor non-blocking issues remain
PASS (clean)
Clear, stable, and IEEE-aligned

CRITICAL: Return ONLY JSON.
Output Schema (Strict JSON):
{
  "validation_status": "PASS" | "FAIL" | "CLARIFICATION_REQUIRED",
  "issues": [
    {
      "section_id": "string",
      "title": "string",
      "issue_type": "SEMANTIC_MISMATCH" | "SCOPE_CREEP" | "AMBIGUITY" | "INCOMPLETE" | "OTHER",
      "conflict_type": "HARD_CONFLICT" | "SOFT_DRIFT" | "NONE",
      "severity": "BLOCKER" | "WARNING",
      "description": "string",
      "suggested_fix": "string"
    }
  ],
  "clarification_questions": ["string"]
}

**Intake Data Structure:**
__SRS_DATA__
`;

export async function validateRequirements(srsData) {
  // 1. Pre-processing: Minimize JSON size if needed
  const jsonString = JSON.stringify(srsData, null, 2);

  // 2. Call AI Service with specific system prompt
  const response = await analyzeText(jsonString, {
    modelName: process.env.VALIDATION_MODEL || 'gemini-2.5-flash',
    systemPrompt: VALIDATION_PROMPT_TEMPLATE,
    temperature: 0.0, // Deterministic
    zodSchema: null // Do not use Full SRS schema for validation check
  });

  // 3. Fallback Validation
  if (!response || response.success === false) {
    throw new Error(response.error || "AI Validation Failed");
  }

  // Extract the actual result from standardized response
  const result = response.srs;

  // Robustness: Handle AI non-compliance with exact keys
  if (!result.validation_status) {
    if (result.status) result.validation_status = result.status;
    else if (result.validationStatus) result.validation_status = result.validationStatus;

    // Fallback inference
    if (!result.validation_status) {
      if (result.clarification_questions && result.clarification_questions.length > 0) {
        result.validation_status = 'CLARIFICATION_REQUIRED';
      } else if (result.issues && result.issues.some(i => i.severity === 'critical' || i.severity === 'BLOCKER')) {
        result.validation_status = 'CLARIFICATION_REQUIRED';
      } else {
        result.validation_status = 'PASS';
      }
    }
  }

  // Ensure every issue has a unique ID for React Keys and normalized severity
  if (result.issues && Array.isArray(result.issues)) {
    result.issues = result.issues.map((issue, idx) => {
      let severity = (issue.severity || 'info').toLowerCase();

      // Map Backend/Prompt terminology to Frontend types
      if (severity === 'blocker') severity = 'critical';
      if (severity === 'warning') severity = 'warning';
      if (severity !== 'critical' && severity !== 'warning') severity = 'info';

      // Deterministic ID generation based on content
      // Allows React keys to be stable and UI to track diffs correctly between runs
      const issueContent = `${issue.section_id || 'general'}-${issue.title}-${issue.description.slice(0, 20)}`;
      const deterministicId = `val-${crypto.createHash('md5').update(issueContent).digest('hex').slice(0, 8)}`;

      return {
        ...issue,
        id: issue.id || deterministicId,
        severity: severity
      };
    });
  }

  return result;
}

export async function autoFixRequirements(srsData, issueId) {
  const issues = srsData.validationResult?.issues || [];
  const targetIssue = issues.find(i => i.id === issueId);

  if (!targetIssue) throw new Error("Issue not found");

  const AUTO_FIX_PROMPT = `
You are the SRA Layer 2 Auto-Fixer.
Your goal is to REWRITE a specific section of a software project description to resolve a validation issue.

CONTEXT:
Project Data: ${JSON.stringify(srsData.draftData)}
Issue to Resolve: ${targetIssue.description}
Suggested Fix: ${targetIssue.suggested_fix}

INSTRUCTIONS:
1. Rewrite the affected part of the project description to be clear, specific, and measurable.
2. Maintain the original intent but remove ambiguity.
3. Governance Hierarchy:
   - Generally, the Introduction (Purpose + Scope) is the semantic authority. All other information MUST align with it. If there is a conflict, follow the Introduction.
   - EXCEPTION: If the issue being resolved is that the Introduction is placeholder, meaningless, or incoherent (e.g., 'abc', 'tbd'), you MUST NOT follow it. Instead, treat the "Project Details" or "Raw Description" as the authority for this fix.

4. If it's a performance issue, add specific metrics (e.g., "< 200ms").
5. If it's a scope issue, clarify the boundaries.
6. Return ONLY the rewritten text for that specific field/context. 
7. Do not include JSON, just the refined text.
`;

  const response = await analyzeText("Please fix the identified issue.", {
    systemPrompt: AUTO_FIX_PROMPT,
    modelName: 'gemini-2.5-flash',
    temperature: 0.2,
    zodSchema: null // Return raw text, not SRS JSON
  });

  if (response.success) {
    // Since we told it to return raw text, it might still wrap in quotes or something
    return response.raw?.trim() || response.srs?.toString();
  }
  throw new Error("Failed to generate auto-fix");
}
