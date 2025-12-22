import { analyzeText } from "./aiService.js";

const VALIDATION_PROMPT_TEMPLATE = `
You are a strict Requirements Engineering Validation System.
Your job is to VALIDATE the provided raw input data for a Software Requirements Specification (SRS).
This data comes from an "Intake Form" (Layer 1) and will later be processed by an Analysis Layer (Layer 3) to generate the final IEEE document.

You must act as a GATEKEEPER for **Input Quality**, not Final Document Completeness.

**Context - The "Intake Layer" (Layer 1) ONLY collects:**
- 1.1 Purpose
- 1.2 Product Scope (maps to IEEE 1.4)
- 2.1 Product Perspective
- 2.2 Product Functions
- 2.3 User Classes/Characteristics
- 2.4 Design/Implementation Constraints (maps to IEEE 2.5)
- 2.5 User Documentation (maps to IEEE 2.6)
- 2.6 Assumptions/Dependencies (maps to IEEE 2.7)
- 3.x External Interfaces
- 4.x System Features
- 5.x Nonfunctional Requirements
- 6.x Other Requirements

**EXEMPT SECTIONS (Do NOT fail if missing - these are generated in Layer 3):**
- 1.2 Document Conventions
- 1.3 Intended Audience and Reading Suggestions
- 1.5 References
- 2.4 Operating Environment
- Appendix A: Glossary
- Appendix B: Analysis Models
- Appendix C: TBD List

Rules for Validation:
1. **Completeness**: Validate ONLY the sections listed in "Intake Layer". If an Exempt section is missing, ignore it.
2. **Clarity**: Are the provided requirements clear? (e.g. "Fast" is vague -> WARNING).
3. **Consistency**: Do Scope and Features align?
4. **Context**: Is there enough info to generate the missing sections later?

Input Data:
__SRS_DATA__

Output Schema (Strict JSON, No Markdown):
{
  "validation_status": "PASS" | "FAIL",
  "issues": [
    {
      "section_id": "string",
      "subsection_id": "string", 
      "title": "string",
      "issue_type": "VAGUE" | "INCOMPLETE" | "INCONSISTENT" | "UNVERIFIABLE" | "OTHER",
      "severity": "BLOCKER" | "WARNING",
      "description": "string",
      "suggested_fix": "string"
    }
  ]
}

Logic:
- **BLOCKER**: content is practically empty, pure gibberish, or fundamentally contradictory. Returns "FAIL".
- **WARNING**: content is understandable but vague. Returns "PASS".
- **PASS**: The user has provided enough raw material for the AI to generate the rest.
- **CRITICAL**: If ALL issues are "WARNING", validation_status MUST be "PASS".

Return ONLY the JSON.
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
