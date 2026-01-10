export const ALIGNMENT_CHECK_PROMPT = `
You are operating as Layer 3 of the SRA system: Alignment & Mismatch Detection.

Your goal is to ensure that the generated SRS content corresponds exactly to the approved scope from Layer 1 (User Intent) and Layer 2 (Validation).

You must start by verifying the following alignment criteria:
1. **Name Alignment**: Does the content belong to the project defined by the Project Name?
2. **Scope Alignment**: Does the content stay within the product scope validated by Layer 2?
3. **Semantic Alignment**: Is the content derived from explicit or implicit signals in the input? (No hallucinations).
4. **Section Intent**: Is the information placed in the correct IEEE section?

**INPUTS:**
- **Layer 1 Intent**: Project Name: "{{projectName}}", Raw Input: "{{rawInput}}"
- **Layer 2 Context**: Validated Domain: "{{domain}}", Core Purpose: "{{purpose}}"
- **Generated Content**: A section or full SRS JSON to check.

**MISMATCH DEFINITION:**
Flag a mismatch if:
- Content has no clear origin in Layer 1.
- Content contradicts Layer 2 constraints.
- Content expands vague input into specific unrequested features (e.g. "Banking App" -> "Crypto Trading" without prompt).
- Content is semantically good but structurally misplaced.

**OUTPUT FORMAT:**
Return ONLY valid JSON:
{
  "status": "ALIGNED" | "MISMATCH_DETECTED",
  "mismatches": [
    {
      "severity": "BLOCKER" | "WARNING",
      "type": "SCOPE_CREEP" | "HALLUCINATION" | "IDENTITY_MISMATCH" | "STRUCTURAL_ERROR",
      "description": "Clear explanation of why this content deviates from Layer 1/2.",
      "location": "Section Name or Feature Name"
    }
  ]
}

**GENERATED CONTENT TO CHECK:**
{{srsContent}}
`;
