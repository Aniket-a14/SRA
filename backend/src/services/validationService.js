import { analyzeText } from "./aiService.js";
import crypto from 'crypto';

const VALIDATION_PROMPT_TEMPLATE = `
<role>
You are a senior consultant reviewing a client's software project brief before handing it to your engineering team.
Your default recommendation is PASS. You only raise concerns when the brief references something your team genuinely cannot know — information locked inside the client's organization.
</role>

<task>
Review the provided project description and determine if the engineering team (the SRS generator) has enough information to write the SRS without inventing client-specific details.

Step 1: Confirm the input is meaningful (not gibberish) and describes a feasible software system. If not, return FAIL.
Step 2: Read the entire description and identify the client's intent for each feature.
Step 3: For each potential concern, apply the Decision Test below. Only concerns that survive the test become issues.
Step 4: Return your assessment as JSON.
</task>

<decision_test>
For every potential concern, ask this single question:

"Is this something only THIS CLIENT can answer — something specific to their organization, their named systems, their proprietary rules, or their unique business decisions?"

- If YES → It is a genuine gap. Include it.
- If NO → The engineering team handles it. Drop it entirely. Do not include it as a WARNING.

Key signals of a genuine gap:
- Possessive/internal language: "our system", "our rules", "existing platform", "company policy", "internal process"
- Named but undefined entities: references to specific systems, teams, or standards the client assumes you know
- Business intent that could mean fundamentally different products (not different implementations of the same product)

Things that are never gaps (drop these immediately):
- Design decisions (free-text vs dropdown, email vs push notification, fixed vs configurable lists)
- Implementation details (field schemas, permission matrices, moderation tools, reminder timing)
- Standard domain knowledge (industry KPIs, common workflows, standard roles)
- Feature elaboration (the engineering team defines the sub-steps, formats, and mechanics)
</decision_test>

<examples>
Example 1 — Correct output: PASS (zero issues)
Brief: "A task management app where users create projects, add tasks with due dates, assign tasks to team members, and track progress via a kanban board. Users sign up with email. Admins manage workspaces."
Why PASS: Every feature has clear intent. Board layout, notifications, and permissions are standard patterns.

Example 2 — Correct output: PASS (zero issues)
Brief: "An e-commerce platform for handmade crafts. Sellers list products with photos and prices. Buyers browse, add to cart, and checkout. The platform takes a commission. Sellers track orders and manage inventory."
Why PASS: Commission rate, payment flow, and inventory management are standard e-commerce patterns. No organization-specific unknowns.

Example 3 — Correct output: CLARIFICATION_REQUIRED
Brief: "A booking system for our clinic. Patients book appointments. The system integrates with our existing patient records system and follows our scheduling rules."
Issue: "our existing patient records system" and "our scheduling rules" — organization-specific references the team has no visibility into.

Example 4 — Correct output: CLARIFICATION_REQUIRED
Brief: "A supply chain platform. Users manage inventory, track supplier performance, and create purchase orders. Authentication uses the organization's identity system."
Issue: "the organization's identity system" — genuine gap. NOT issues: supplier metrics, approval workflows — standard patterns.
</examples>

<severity>
- BLOCKER: Two different answers from the client would produce structurally different products.
- WARNING: A standard default exists but the client might prefer something different. The engineering team can apply a reasonable default and mark it for client review.
</severity>

<constraints>
- Maximum 6 issues. If you find more, keep only the most critical.
- If you are about to include 3 or more issues, pause and reconsider — you are likely being too aggressive. Most well-written descriptions should produce 0-2 issues.
- Use calm, direct language in issue descriptions. Explain what client-specific information is missing and why.
- Clarification questions should use plain language a non-technical stakeholder would understand.
- Ask about WHAT the system should do, never about HOW to build it.
- For repeated runs on the same input, produce consistent results.
</constraints>

<categories>
Evaluate against these categories (skip any not mentioned or implied):
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
FAIL = meaningless or infeasible input.
CLARIFICATION_REQUIRED = at least one genuine gap that only the client can answer.
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
    const issuesJson = JSON.stringify(issues.map(i => ({ title: i.title, description: i.description })), null, 2);
    const response = await analyzeText(issuesJson, {
      modelName: process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash',
      systemPrompt: FILTER_PROMPT_TEMPLATE.replace('{{issues}}', issuesJson),
      temperature: 0.0,
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
  const jsonString = JSON.stringify(srsData, null, 2);

  const response = await analyzeText(jsonString, {
    modelName: process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash',
    systemPrompt: VALIDATION_PROMPT_TEMPLATE.replace('{{srsData}}', jsonString),
    temperature: 0.0,
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

  // Pass 2: Filter false positives
  if (result.issues && result.issues.length > 0) {
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

      const issueContent = `${issue.section_id || 'general'}-${issue.title}-${issue.description.slice(0, 50)}`;
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
Project Data: ${JSON.stringify(srsData.draftData)}
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
    temperature: 0.2,
    zodSchema: null
  });

  if (response.success) {
    return response.raw?.trim() || response.srs?.toString();
  }
  throw new Error("Failed to generate auto-fix");
}
