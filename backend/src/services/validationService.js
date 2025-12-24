import { analyzeText } from "./aiService.js";

const VALIDATION_PROMPT_TEMPLATE = `
You are a strict Requirements Engineering Validation System.
Your job is to VALIDATE the provided raw input data for a Software Requirements Specification (SRS).

**CORE PRINCIPLE: The Introduction is the Semantic Anchor.**
- The "Introduction" section (specifically Purpose/Scope) defines the absolute product domain and identity.
- ALL other sections must strictly align with this domain.
- Any requirement that drifts into an unrelated domain is a CRITICAL ERROR.

**Intake Data Structure:**
__SRS_DATA__

**Validation Tasks:**
1. **Extract Context**: Analyze Section 1 (Introduction) to determine the "Product Domain" (e.g., FinTech, Healthcare, Logistics).
2. **Scan for Conflicts**: Check every other requirement against this domain.
   - *Example Mismatch*: Intro says "Banking App", but a feature asks for "Pizza Delivery".
3. **Quality Check**: Check for Vague or Untestable requirements (e.g., "fast", "user-friendly").

**Output Schema (Strict JSON):**
{
  "validation_status": "PASS" | "FAIL",
  "issues": [
    {
      "section_id": "string",
      "subsection_id": "string",
      "title": "string (Short summary of issue)",
      "issue_type": "SEMANTIC_MISMATCH" | "SCOPE_CREEP" | "AMBIGUITY" | "INCOMPLETE" | "OTHER",
      "conflict_type": "HARD_CONFLICT" | "SOFT_DRIFT" | "NONE",
      "severity": "BLOCKER" | "WARNING",
      "description": "string (Explain WHY it matches/drifts)",
      "suggested_fix": "string (Actionable advice)"
    }
  ]
}

**Classification Rules:**
- **SEMANTIC_MISMATCH (Hard Conflict)**: Requirement belongs to a completely different industry/domain than Section 1. -> severity: BLOCKER.
- **SCOPE_CREEP (Soft Drift)**: Requirement is related but expands scope significantly beyond Section 1's definition. -> severity: WARNING (or BLOCKER if extreme).
- **AMBIGUITY**: "Fast", "Easy", "Robust". -> severity: WARNING.
- **INCOMPLETE**: Missing core fields in a feature. -> severity: BLOCKER.

**Final Decision Logic:**
- If any "BLOCKER" exists -> validation_status: "FAIL".
- If only "WARNING" exist -> validation_status: "PASS" (but return warnings).
- If clean -> validation_status: "PASS".
`;

export async function validateRequirements(srsData) {
  // 1. Pre-processing: Minimize JSON size if needed usually not needed for modern LLMs context window
  const jsonString = JSON.stringify(srsData, null, 2);

  // 2. Construct Prompt
  const prompt = VALIDATION_PROMPT_TEMPLATE.replace('__SRS_DATA__', jsonString);

  // 3. Call AI Service
  // Using a model capable of reasoning and valid JSON output (e.g. Gemini 1.5 Pro or generic large model)
  const result = await analyzeText(prompt, {
    modelName: 'gemini-2.5-flash', // Using strictly higher model for validation logic
    temperature: 0.1 // Deterministic
  });

  // 4. Fallback Validation
  // If AI fails completely, we might return a system error, but analyzeText handles retries.
  // We trust analyzeText returns an object or error structure.

  if (!result || result.success === false) {
    throw new Error(result.error || "AI Validation Failed");
  }

  return result;
}
