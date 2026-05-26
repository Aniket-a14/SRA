import { analyzeText } from "./aiService.js";
import crypto from 'crypto';
import { OUTPUT_TOKEN_LIMITS, TEMPERATURES } from "../utils/llmGenerationConfig.js";
import { stringifyForPrompt } from "../utils/promptCompaction.js";

const VALIDATION_PROMPT_TEMPLATE = `
<role>
You are an elite Technical Writer and Senior Requirements Engineer. Your job is to audit a client's software project brief/requirements before generating a Software Requirements Specification (SRS).
Your goal is to identify discrepancies, ambiguities, gaps, unfeasible constraints, and semantic errors in the client's input to ensure the downstream generator never has to make assumptions or hallucinate any core functionality, custom rules, or client systems.
</role>

<task>
Analyze the provided project description and features against the **6 Golden Dimensions of SRS Validation**:

1. **Completeness & Scope Boundaries (Topic-Only vs. Functional)**:
   - Identify "Topic-Only" or "Empty Shell" prompts (e.g., "I want a dog food website", "make a chat app") that define zero core functional features, pages, or user journeys. These are **BLOCKER** gaps. Flag as type \`INCOMPLETE\` or \`AMBIGUITY\` and require clarification.
   - Detect "Logical Dead-Ends" where a workflow is initiated but never finished (e.g., "Users can upload a ticket for approval," but no role, action, or path defines who reviews/approves it or what happens next). Flag as a **WARNING** or **BLOCKER** depending on critical impact.

2. **Lexical Ambiguity & Subjective Language (Subjective Claims)**:
   - Detect subjective, non-quantifiable adjectives (e.g., *fast*, *secure*, *scalable*, *efficient*, *modern*, *easy-to-use*, *optimal*) when used without measurable constraints or specific frameworks.
   - For generic statements (e.g., "make it secure", "make it fast"), the system can apply industry-standard defaults (e.g., response time under 1.5s, bcrypt hashing, TLS 1.3). Raise a **WARNING** to state the assumed industry-standard default and ask the user if they wish to override or specify further.

3. **Semantic Drift & Logical Conflicts (Inconsistency)**:
   - Detect domain drift (e.g., ordering pepperonis from a mobile banking dashboard) or direct logical conflicts in the requirements (e.g., Line A says "only admins can modify accounts," while Line B says "any manager can modify accounts"). Flag as a **BLOCKER** under type \`SEMANTIC_MISMATCH\` with conflict type \`HARD_CONFLICT\`.

4. **Organizational Lock & Custom Rules**:
   - Detect any reference to proprietary rules, undocumented company policies, internal systems, legacy databases, or custom frameworks (e.g., *"follow our scheduling rules"*, *"integrate with our patient database"*, *"must comply with company security policies"*).
   - If mentioned but not fully specified, this is a **BLOCKER**. You **MUST** flag it as type \`INCOMPLETE\` or \`AMBIGUITY\` with severity \`BLOCKER\`.
   - **Formulate a highly specific clarification question**: *"You mentioned [rule/policy/system name] but did not specify it. Can you please specify these details so our system does not have to guess or assume them?"* (Do not invent the rules).

5. **Technical Feasibility & Boundary Limits**:
   - Identify requirements that violate physical constraints, are technically impossible, or are mathematically/systemically absurd (e.g., "instant zero-latency database sync across global nodes", "a teleporter app"). Flag as **FAIL** with severity \`BLOCKER\`.

6. **Actor & Role Ambiguity (Unassigned Actions)**:
   - Detect passive-voice requirements that describe system actions without identifying *who* or *what role* is responsible for performing them (e.g., "the profile must be approved weekly" without specifying if an Admin, Moderator, or automated cron job does it). Flag as a **WARNING** under type \`AMBIGUITY\`.

Step-by-step:
1. Parse the input.
2. If it is gibberish or physically impossible (e.g., "teleporter"), return status FAIL.
3. If it is a topic-only prompt ("make a booking website") or has blocker-level organization rule gaps, return status CLARIFICATION_REQUIRED.
4. If it has minor lexical ambiguity or passive role warnings but otherwise has enough detail to proceed, return CLARIFICATION_REQUIRED (if warnings are blockers) or PASS (if warnings can be handled via standard defaults) but list the warnings. Note: If there are ANY blocker issues (severity BLOCKER), status must be CLARIFICATION_REQUIRED.
</task>

<hallucination_prevention>
## ZERO-TOLERANCE FOR AI ASSUMPTIONS
- **Never assume proprietary context**: If the client references any internal databases, APIs, custom rules, or third-party legacy integrations without details, do NOT let it pass. If you let it pass, the subsequent generation layer will be forced to hallucinate (invent) the client's internal reality. 
- **Exact question match**: Formulate clarification questions that target the specific unspecified system or rule. e.g. "You mentioned that we must follow your internal scheduling rules, but those rules were not provided. Could you specify what those scheduling rules are?"
</hallucination_prevention>

<severity>
- BLOCKER: The SRS generator cannot proceed without making up (hallucinating) major features, architectures, or proprietary client logic.
- WARNING: A minor detail or standard preference is missing/subjective, but the team can apply a reasonable industry-standard default and flag it for later review.
</severity>

<constraints>
- Maximum 6 issues. If you find more, keep only the most critical.
- Use calm, direct, non-technical language in issue descriptions and clarification questions.
- Ask about WHAT the system should do, never about HOW to build it (e.g., do not ask about specific programming languages, databases, or frameworks).
- For repeated runs on the same input, produce consistent results.
</constraints>

<output_format>
Return ONLY valid JSON:
{
  "validation_status": "PASS" | "FAIL" | "CLARIFICATION_REQUIRED",
  "issues": [
    {
      "section_id": "string",
      "title": "string",
      "issue_type": "SEMANTIC_MISMATCH" | "SCOPE_CREEP" | "AMBIGUITY" | "INCOMPLETE" | "NOT_FEASIBLE" | "OTHER",
      "conflict_type": "HARD_CONFLICT" | "SOFT_DRIFT" | "NONE",
      "severity": "BLOCKER" | "WARNING",
      "description": "string",
      "suggested_fix": "string"
    }
  ],
  "clarification_questions": ["string"]
}

PASS = empty issues array and empty clarification_questions array.
FAIL = meaningless, gibberish, or technically impossible input.
CLARIFICATION_REQUIRED = vague input, logical dead-ends, actor ambiguity blocker, or genuine proprietary gaps.
</output_format>

<input>
{{srsData}}
</input>
`;

const FILTER_PROMPT_TEMPLATE = `
You are a precision filter. You will receive a list of validation issues flagged by a first-pass reviewer.
Your job: for each issue, determine if it is a GENUINE client-specific gap or a FALSE POSITIVE.

An issue is a FALSE POSITIVE if:
- It asks about a pedantic design decision (e.g., free-text vs dropdown, email vs push notification, calendar date picker vs text input).
- It asks about standard technical implementation details (e.g., field database schemas, exact API route names, database indexing).
- It asks standard domain knowledge any engineer would know (e.g., standard e-commerce flows, standard user registration fields).
- It asks the client to make a pure engineering choice for the team.

An issue is GENUINE if:
- It flags a vague/incomplete project description (e.g., topic-only prompts, lack of core features or pages like "I need to make a dog food website").
- It flags logical dead-ends or incomplete workflows (e.g., users submit a ticket, but no role can approve/deny it).
- It references unspecified custom rules, legacy systems, databases, APIs, or organizational standards (e.g., "follow our scheduling rules", "our security framework").
- Only the client can answer it — no amount of engineering knowledge helps.

Return a JSON array of issue titles that should be KEPT. Drop everything else.
Return ONLY a JSON array of strings, nothing else.

Example input: [{"title": "Undefined SSO Provider"}, {"title": "Unclear tag taxonomy"}, {"title": "Reminder channel not specified"}]
Correct output: ["Undefined SSO Provider"]

</input>
`;

async function filterFalsePositives(issues) {
  if (!issues || issues.length === 0) return issues;

  try {
    const issuesJson = stringifyForPrompt(issues.map(i => ({ title: i.title, description: i.description })));
    const response = await analyzeText(issuesJson, {
      modelName: process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash',
      systemPrompt: FILTER_PROMPT_TEMPLATE.replace('{{issues}}', 'Issues are provided in the user input.'),
      temperature: TEMPERATURES.logic,
      maxOutputTokens: OUTPUT_TOKEN_LIMITS.smallJson,
      zodSchema: null
    });

    if (!response || response.success === false) return issues;

    let keepTitles = response.srs || response.raw;
    if (typeof keepTitles === 'string') {
      try { keepTitles = JSON.parse(keepTitles); } catch { return issues; }
    }

    if (!Array.isArray(keepTitles)) return issues;

    return issues.filter(issue =>
      keepTitles.some(title =>
        typeof title === 'string' && issue.title.toLowerCase().includes(title.toLowerCase())
      )
    );
  } catch (err) {
    // If filter fails, return original issues (safe fallback)
    return issues;
  }
}

export async function validateRequirements(srsData) {
  const jsonString = stringifyForPrompt(srsData);

  const response = await analyzeText(jsonString, {
    modelName: process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash',
    systemPrompt: VALIDATION_PROMPT_TEMPLATE.replace('{{srsData}}', 'Project description data is provided in the user input.'),
    temperature: TEMPERATURES.logic,
    maxOutputTokens: OUTPUT_TOKEN_LIMITS.smallJson,
    zodSchema: null
  });

  if (!response || response.success === false) {
    throw new Error(response.error || "AI Validation Failed");
  }

  const result = response.srs;

  if (!result.validation_status) {
    if (result.status) result.validation_status = result.status;
    else if (result.validationStatus) result.validation_status = result.validationStatus;

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

  // Normalize status case to ensure reliable comparison in controllers
  if (result.validation_status && typeof result.validation_status === 'string') {
    result.validation_status = result.validation_status.toUpperCase();
  }

  // Pass 2: Filter false positives
  if (result.issues && Array.isArray(result.issues) && result.issues.length > 0) {
    result.issues = await filterFalsePositives(result.issues);

    // If all issues were filtered out, upgrade to PASS
    if (result.issues.length === 0 && result.validation_status === 'CLARIFICATION_REQUIRED') {
      result.validation_status = 'PASS';
    }
  }

  if (result.issues && Array.isArray(result.issues)) {
    result.issues = result.issues.map((issue, idx) => {
      let severity = (issue.severity || 'info').toLowerCase();

      if (severity === 'blocker') severity = 'critical';
      if (severity === 'warning') severity = 'warning';
      if (severity !== 'critical' && severity !== 'warning') severity = 'info';

      const issueContent = `${issue.section_id || 'general'}-${issue.title || 'issue'}-${(issue.description || '').slice(0, 50)}`;
      const deterministicId = `val-${crypto.createHash('md5').update(issueContent).digest('hex').slice(0, 12)}`;

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
You are the Validation Gate Auto-Fixer.

A gap was identified in the client's project description that would force the SRS generator to hallucinate. Your job is to rewrite the affected part of the description to CLOSE that gap — adding just enough specificity so the SRS generator can proceed without guessing.

## CONTEXT:
Project Data: ${stringifyForPrompt(srsData.draftData)}
Issue to Resolve: ${targetIssue.description}
Suggested Fix: ${targetIssue.suggested_fix}

## RULES:
1. Add JUST ENOUGH detail to resolve the identified gap. Do not over-engineer or pad with unnecessary specifics.
2. Use reasonable industry-standard defaults where the client's intent is clear but detail is missing.
3. Maintain the original intent and tone of the description. Do not change what the client asked for — only clarify HOW it should work where it was ambiguous.
4. Do NOT invent client-specific business logic, proprietary rules, or organizational details. If the gap is about something only the client can answer (e.g., their specific business rules, their internal systems), write a clear placeholder that makes the requirement explicit without fabricating details.
5. Do NOT expand scope. The fix should resolve the flagged issue, nothing more.
6. Do NOT add technical implementation details (databases, frameworks, APIs). Keep the language at the same level as the original description.
7. Return ONLY the rewritten text for the affected section. No JSON, no explanations, just the refined text.
`;

  const response = await analyzeText("Please fix the identified issue.", {
    systemPrompt: AUTO_FIX_PROMPT,
    modelName: process.env.GEMINI_MODEL_NAME || 'gemini-3-flash-preview',
    temperature: TEMPERATURES.evaluator,
    maxOutputTokens: OUTPUT_TOKEN_LIMITS.smallJson,
    zodSchema: null
  });

  if (response.success) {
    return response.raw?.trim() || response.srs?.toString();
  }
  throw new Error("Failed to generate auto-fix");
}
