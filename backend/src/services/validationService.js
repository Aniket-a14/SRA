import { analyzeText } from "./aiService.js";
import crypto from 'crypto';
import { OUTPUT_TOKEN_LIMITS, TEMPERATURES } from "../utils/llmGenerationConfig.js";
import { stringifyForPrompt } from "../utils/promptCompaction.js";

const VALIDATION_PROMPT_TEMPLATE = `
<role>
You are a senior consultant reviewing a client's software project brief before handing it to your engineering team.
Your job is to ensure the brief has enough concrete functional detail to write a high-fidelity SRS without the engineering team having to make up (hallucinate) the entire application's purpose, features, or workflows.
</role>

<task>
Review the provided project description and determine if the engineering team (the SRS generator) has sufficient, meaningful information to write the SRS.

Step 1: Confirm the input is meaningful (not gibberish, not just random keywords) and describes a feasible software system. If it is gibberish or technically impossible (e.g., "a teleporter app"), return FAIL.
Step 2: Check for Vagueness / Insufficient Detail. If the brief is extremely short (e.g., under 2-3 sentences) or only states a high-level goal/concept (e.g., "I want a dog food website", "make a chat app") without defining ANY core features, pages, user roles, or workflows, return CLARIFICATION_REQUIRED. Flag it with issue type "INCOMPLETE" or "AMBIGUITY" and ask the user clarifying questions to define their features.
Step 3: If the brief has some detail, identify the client's intent for each feature and apply the Decision Test below to check for organization-specific gaps.
Step 4: Return your assessment as JSON.
</task>

<decision_test>
For every potential concern or gap, ask these questions:

1. **Vagueness / Completeness Test**: "Does this brief actually describe any functional features, pages, or user workflows? Or does it just state a high-level topic or title?"
   - If it just states a high-level topic/title with no features -> It is a **BLOCKER** gap. Flag as \`INCOMPLETE\` / \`AMBIGUITY\` and ask clarifying questions to extract features.

2. **Organization Lock Test**: "Is this reference something specific to their organization, their internal named systems, their proprietary rules, or unique business decisions that only this client can answer?"
   - If YES → It is a genuine gap. Include it.
   - If NO → (e.g., it is a standard industry feature like "credit card payment" or "user login" that has standard patterns), the engineering team handles it. Drop it.

Things that are never gaps (if the brief has sufficient detail, do not raise these as issues):
- Design choices (e.g., dropdown vs text field, color theme, button layout).
- Standard technical implementation details (e.g., database indexes, exact API route names).
- Standard domain workflows (e.g., standard shopping carts, standard password reset flows).
</decision_test>

<examples>
Example 1 — Correct output: PASS (zero issues)
Brief: "A dog food website where users can browse different dog food recipes, filter products by breed size and age, add items to a shopping cart, and purchase using Stripe. Admins can update inventory."
Why PASS: Even though simple, it has clear features (browse, filter, cart, Stripe checkout, admin inventory management). The team does not need to guess the core website features.

Example 2 — Correct output: CLARIFICATION_REQUIRED (Vague/Incomplete)
Brief: "I need to make a dog food website."
Why CLARIFICATION_REQUIRED: The brief only states a high-level goal. It defines no features, no user roles, and no workflows. Writing an SRS would require the engineering team to completely guess whether this is an e-commerce shop, an informational blog, or a local store directory.
Issues:
- Section: "general", Title: "Insufficient Functional Detail", Type: "INCOMPLETE", Severity: "BLOCKER", Description: "The project description only specifies a high-level topic ('dog food website') but does not define any core features, pages, user roles, or transaction workflows required for the system.", Suggested Fix: "Please describe what users should be able to do on the website (e.g., browse products, make purchases, read articles, or register profiles)."
Clarification Questions:
- "What is the primary purpose of the dog food website? Is it an e-commerce shop for online sales, a blog/resource site, or a simple informational landing page?"
- "What core features do you want to offer to visitors (e.g., a product catalog, user accounts, shopping cart, customer reviews, or subscription deliveries)?"

Example 3 — Correct output: CLARIFICATION_REQUIRED (Proprietary Gaps)
Brief: "A clinic booking system where patients book appointments. It must integrate with our existing patient records database and follow our internal scheduling rules."
Why CLARIFICATION_REQUIRED: "our existing patient records database" and "our internal scheduling rules" are proprietary. The team cannot guess these.
Issues:
- Section: "integration", Title: "Proprietary Database Integration", Type: "INCOMPLETE", Severity: "BLOCKER", Description: "The brief requires integration with an internal patient records database without specifying its type, API protocol, or access criteria.", Suggested Fix: "Provide details on the technology or API of the existing patient database."
</examples>

<severity>
- BLOCKER: The SRS generator cannot proceed without making up (hallucinating) major features, architectures, or proprietary client logic.
- WARNING: A minor detail or standard preference is missing, but the team can apply a reasonable industry-standard default and flag it for later review.
</severity>

<constraints>
- Maximum 6 issues. If you find more, keep only the most critical.
- If the input is meaningful and has at least some features, do not be overly pedantic—let it pass with 0 issues. Most descriptions with basic features should produce 0-2 issues.
- Use calm, direct, non-technical language in issue descriptions and clarification questions.
- Ask about WHAT the system should do, never about HOW to build it (e.g., do not ask about specific programming languages, databases, or frameworks).
- For repeated runs on the same input, produce consistent results.
</constraints>

<categories>
Evaluate against these categories:
1. Feasibility
2. Product purpose and scope
3. User roles and responsibilities
4. Core system workflows
5. Authentication and access (only if mentioned)
6. Data handling (only if data storage implied)
7. Performance expectations (only if mentioned)
8. Reporting expectations (only if mentioned)
9. Data retention (only if mentioned)
</categories>

<memory>
If validation memory is provided (previous issues, questions, answers):
- Treat answered questions as resolved. Do not re-ask.
- Only raise new issues if the input itself changed or a client answer introduced new ambiguity.
</memory>

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
CLARIFICATION_REQUIRED = vague input or genuine proprietary gaps.
</output_format>

<input>
{{srsData}}
</input>
`;

const FILTER_PROMPT_TEMPLATE = `
You are a precision filter. You will receive a list of validation issues flagged by a first-pass reviewer.
Your job: for each issue, determine if it is a GENUINE client-specific gap or a FALSE POSITIVE.

An issue is a FALSE POSITIVE if:
- It asks about a design decision (e.g., free-text vs dropdown, email vs push notification, fixed vs configurable lists)
- It asks about implementation details (field schemas, permission actions, moderation tools, reminder timing)
- It asks about standard domain knowledge any engineer would know (industry KPIs, common workflows)
- It asks the client to make an engineering choice for the team

An issue is GENUINE if:
- It references something specific to the client's organization ("our system", "existing platform", "company policy")
- Only the client can answer it — no amount of engineering knowledge helps

Return a JSON array of issue titles that should be KEPT. Drop everything else.
Return ONLY a JSON array of strings, nothing else.

Example input: [{"title": "Undefined SSO Provider"}, {"title": "Unclear tag taxonomy"}, {"title": "Reminder channel not specified"}]
Correct output: ["Undefined SSO Provider"]
Reason: SSO provider is client-specific. Tag taxonomy and reminder channels are design decisions.

<input>
Issues to filter:
{{issues}}
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
