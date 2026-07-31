import { BaseAgent } from './BaseAgent.js';
import logger from '../config/logger.js';
import { constructMasterPrompt } from '../utils/prompts.js';
import { SRSShellSchema, SRSFeaturesSchema, SRSRequirementsSchema, SRSAppendicesSchema } from '../utils/aiSchemas.js';
import { buildFormatSchema, buildFormatGuidelines } from '../formats/index.js';
import { TEMPERATURES } from '../utils/llmGenerationConfig.js';
import { stringifyForPrompt } from '../utils/promptCompaction.js';
import {
  NORMATIVE_LANGUAGE_RULES,
  REQUIREMENT_FORM,
  NFR_QUANTIFICATION_RULES,
  identifierRules,
  draftingConventionFor,
  qualityAttributeRulesFor
} from '../utils/prompt_templates/srs_drafting_standard.js';

const MERMAID_RULES = `
<diagram_rules>
These rules govern ALL Mermaid diagram generation. Violations will produce invalid, unrenderable output.

1. Flowcharts: Use 'flowchart TD'. Shapes: '([Start/End])', '[Process]', '{Decision}', '[/IO/]', '[(Database)]', '[[Subroutine]]'. Links: '-->', '-.->' (dotted), '==>' (thick).
2. Sequence Diagrams: Use 'sequenceDiagram'. Use 'actor User' for humans, 'participant' for systems.
3. Sequence Activations: FORBIDDEN. Do NOT use '+', '-', 'activate', or 'deactivate'. They crash renderers if unbalanced. Use only standard arrows ('A->>B:', 'B-->>A:').
4. Sequence Safety: Never quote alias IDs (use 'participant U as User', not 'participant U as "User"'). Avoid '{}' in messages.
5. ERDs: Use 'erDiagram'. Fields: 'ENTITY { type name PK,FK }' — NO COLONS in field lines.
6. ERD Relationships: '||--o{' (1:N), '||--||' (1:1). Label must always be quoted.
7. ERD Attributes: ONLY PK, FK, UK are valid key markers. FORBIDDEN: NN, NOT NULL, or any non-standard constraint.
8. Flowchart IDs: NEVER use 'end', 'subgraph', or 'class' as IDs. Use alphanumeric only. Labels with spaces must be double-quoted: 'id["My Label"]'.
9. NO PARENTHESES in node IDs. Use double quotes for labels with special characters.
10. Limit ERDs to top 10-12 core entities to prevent output truncation.
</diagram_rules>
`;

const REQUIRED_APPENDIX_DIAGRAMS = [
  'flowchartDiagram',
  'sequenceDiagram',
  'entityRelationshipDiagram'
];

export const hasCompleteAppendices = (candidate) => {
  const models = candidate?.appendices?.analysisModels;
  return Boolean(
    models &&
    REQUIRED_APPENDIX_DIAGRAMS.every((key) => typeof models[key]?.code === 'string' && models[key].code.trim())
  );
};

export class DeveloperAgent extends BaseAgent {
  constructor(providerConfig = {}) {
    super("Lead Developer", providerConfig);
  }

  async getSystemInstruction(settings = {}, overrides = {}) {
    const { projectName = "Project", version = "latest" } = settings;
    return constructMasterPrompt(null, {
      profile: overrides.profile || "default",
      projectName,
      ...(overrides.noSchema && { noSchema: true })
    }, version);
  }

  /**
   * SECTION 1: generateShell
   * Focuses on Project Metadata, Introduction, and Overall Description.
   */
  async generateShell(rawInput, requirements, architecture, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const systemInstruction = settings.systemInstruction || await this.getSystemInstruction({ projectName, version });

    const prompt = `
<role>
You are the Lead Requirements Engineer drafting the opening sections of an IEEE 830-1998 SRS. These sections establish what the document covers, who it is for, and the context the product sits in.
</role>

<task>
Generate the SRS shell: 'projectTitle', 'revisionHistory', 'introduction', and 'overallDescription'. This forms the document's identity and high-level product context.
</task>

<constraints>
1. The 'productFunctions' in overallDescription summarise capability at the level a stakeholder reads for orientation. Detailed behaviour belongs in the System Features section, not here.
2. Write in the register of a specification: declarative, third-person, present tense, no marketing language and no first-person voice. This is a reference document a reader consults, not an essay.
3. Scope states what the product does AND names what it explicitly excludes — an unbounded scope statement is the most common defect in these sections.
4. Record assumptions and dependencies as such. An assumption stated as fact becomes an undetected risk downstream.
5. Each paragraph covers exactly ONE concept, runs 3-6 sentences, and stays under 120 words.
6. Do NOT introduce features or constraints absent from the requirements or architecture inputs.
</constraints>

${identifierRules(projectName)}

<context>
<requirements>${stringifyForPrompt(requirements)}</requirements>
<architecture>${stringifyForPrompt(architecture)}</architecture>
<historical_patterns>${ragContext || "No historical context available."}</historical_patterns>
</context>

<input>
Original Raw Description:
${rawInput}
</input>
`;

    return this.callLLM(prompt, TEMPERATURES.developer, true, SRSShellSchema, 3, 5000, {
      systemInstruction,
      maxOutputTokens: this.tokenLimits.srsShell,
      onStream: settings.onStream
    });
  }

  /**
   * SECTION 2: generateFeatures
   * Focuses on a specific chunk of system features.
   */
  async generateFeatures(rawInput, section1, requirements, architecture, featuresChunk, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const systemInstruction = settings.systemInstruction || await this.getSystemInstruction({ projectName, version });

    const prompt = `
<role>
You are the Lead Requirements Engineer specifying IEEE 830-1998 Section 4.x System Features. This is the part of the document a delivery team builds from and a test team writes cases against, so every obligation in it has to be unambiguous enough to argue over.
</role>

<task>
Generate system features for ONLY the target features listed below. For each, produce: name, description (multi-paragraph), stimulusResponseSequences, and functionalRequirements.
</task>

<constraints>
1. The 'description' explains the feature's purpose, the behaviour a user observes, and how it fits the surrounding workflow — several paragraphs, written as specification prose rather than a summary line.
2. Specify the whole behaviour, not only the success path: input validation, boundary values, contention, and what the system does when a step fails. A specification that describes only the happy path leaves the failure behaviour to be invented during implementation.
3. State behaviour, never implementation. "What the system does" belongs here; "how it is built" belongs to design and is out of scope for this document.
4. Stimulus/Response sequences follow "Stimulus: [external event] Response: [observable system behaviour]" and describe events crossing the system boundary, not internal steps.
5. Cover exactly the target features listed below — no more, and none omitted.
</constraints>

${NORMATIVE_LANGUAGE_RULES}
${REQUIREMENT_FORM}
${identifierRules(projectName)}

<context>
<foundation>${stringifyForPrompt(section1)}</foundation>
<architecture>${stringifyForPrompt(architecture)}</architecture>
<historical_patterns>${ragContext || "None"}</historical_patterns>
</context>

<input>
Target Features to Document:
${stringifyForPrompt(featuresChunk)}

Original Raw Description:
${rawInput}
</input>
`;

    return this.callLLM(prompt, TEMPERATURES.developer, true, SRSFeaturesSchema, 3, 5000, {
      systemInstruction,
      maxOutputTokens: this.tokenLimits.srsFeatures,
      onStream: settings.onStream
    });
  }

  /**
   * SECTION 3: generateRequirements (NFRs & Interfaces)
   * Focuses on Interfaces, NFRs, Glossary, and high-fidelity Mermaid diagrams.
   */
  async generateRequirements(rawInput, sections1And2, requirements, architecture, settings = {}) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;
    const systemInstruction = settings.systemInstruction || await this.getSystemInstruction({ projectName, version });

    const prompt = `
<role>
You are the Lead Requirements Engineer specifying the quality attributes and external interfaces of an IEEE 830-1998 SRS. These sections decide whether the delivered system is acceptable, so vagueness here is what makes a specification unenforceable at handover.
</role>

<task>
Generate the NFRs, interface requirements, other requirements, and glossary sections. These complete the SRS's critical technical specifications.
</task>

<constraints>
1. Every quality attribute traces back to a stated need or an unavoidable consequence of one. Say which need, in the requirement's own wording.
2. Security requirements name what is being protected, what they are protected against, and the control applied — appropriate to this product's actual scope and data sensitivity.
3. Interface requirements describe the contract at the boundary: what crosses it, in what form, and under what conditions. They do not prescribe the technology on either side unless the input fixed it.
4. The glossary defines every domain term and acronym the document uses, and the document then uses those terms consistently. One concept, one name.
5. Do NOT introduce constraints the input does not support.
</constraints>

${NORMATIVE_LANGUAGE_RULES}
${NFR_QUANTIFICATION_RULES}
${identifierRules(projectName)}

${MERMAID_RULES}

<context>
<previous_sections>${stringifyForPrompt(sections1And2)}</previous_sections>
<requirements>${stringifyForPrompt(requirements)}</requirements>
<architecture>${stringifyForPrompt(architecture)}</architecture>
<historical_nfrs>${ragContext || "None"}</historical_nfrs>
</context>

<input>
Original Raw Description:
${rawInput}
</input>
`;

    return this.callLLM(prompt, TEMPERATURES.developerRequirements, true, SRSRequirementsSchema, 3, 5000, {
      systemInstruction,
      maxOutputTokens: this.tokenLimits.srsRequirements,
      onStream: settings.onStream
    });
  }

  /**
   * SECTION 4: generateAppendices
   * Generates only the Appendices (Mermaid Diagrams, TBD list).
   * Context: Requires Shell, Features, and Requirements.
   */
  async generateAppendices(rawInput, previousSections, poOutput, architecture, settings = {}) {
    const { projectName = "Project", version = "latest" } = settings;

    const systemInstruction = settings.appendicesSystemInstruction || await this.getSystemInstruction(
      { projectName, version },
      { profile: "developer", noSchema: true }
    );

    const prompt = `
<role>
You are the Lead Developer generating the Appendices section of an IEEE 830-1998 SRS. This section contains ONLY analysis models (Mermaid diagrams) and the TBD List.
</role>

<task>
Generate the appendices containing:
1. A flowchart diagram showing the primary system workflow.
2. A sequence diagram showing a core user interaction flow.
3. An entity relationship diagram showing the data model.
4. A TBD list collecting all unresolved items from the SRS.
Each diagram must include "syntaxExplanation", "code", and "caption".
</task>

<constraints>
1. Diagrams must accurately reflect the content of the previous SRS sections — do not invent new entities or flows.
2. Each diagram must have a concise caption (4-6 words max).
3. Output RAW Mermaid syntax only (no markdown code blocks).
4. The TBD list must reference all "TBD" or "To Be Determined" items found in earlier sections.
5. Return one JSON object in the exact schema above. The outer response is JSON; only each diagram's code field contains raw Mermaid syntax (without markdown fences).
</constraints>

${MERMAID_RULES}

<context>
<previous_srs_sections>${stringifyForPrompt(previousSections)}</previous_srs_sections>
<architecture>${stringifyForPrompt(architecture)}</architecture>
</context>

<input>
Original Raw Description:
${rawInput}
</input>
`;

    const call = (instruction) => this.callLLM(instruction, TEMPERATURES.developer, true, SRSAppendicesSchema, 3, 5000, {
      systemInstruction,
      maxOutputTokens: this.tokenLimits.srsAppendices,
      onStream: settings.onStream
    });

    const firstAttempt = await call(prompt);
    if (hasCompleteAppendices(firstAttempt)) return firstAttempt;

    // Non-Gemini providers receive the schema as prompt guidance rather than a provider-level
    // response constraint. Recover once from an incomplete object instead of silently persisting
    // an appendix section that renders no diagrams.
    logger.warn('[Lead Developer] Appendices response was missing one or more required diagrams; requesting a complete retry.');
    const recovery = await call(`${prompt}

<recovery>
The previous response was incomplete. It did not contain non-empty code for all three required
diagrams. Return a complete JSON object with appendices.analysisModels.flowchartDiagram,
appendices.analysisModels.sequenceDiagram, and appendices.analysisModels.entityRelationshipDiagram.
Each must contain non-empty syntaxExplanation, code, and caption fields. Do not omit any required
field and do not return Mermaid outside the JSON object's code fields.
</recovery>`);

    if (!hasCompleteAppendices(recovery)) {
      throw new Error('Appendices generation returned an incomplete required diagram set.');
    }
    return recovery;
  }

  async generateSRS(requirements, architecture, settings = {}) {
    // Legacy support or fallback. For SRA 4.0, direct orchestration in service is preferred.
    return this.generateShell(requirements, architecture, settings);
  }

  /**
   * Descriptor-driven generation. Produces one CHUNK of an arbitrary SRS format (ISO 29148,
   * Volere, Agile PRD, …) directly into the format's shape. The system instruction carries the
   * format's section guidelines (buildFormatGuidelines) and the response is constrained to the
   * format's schema for just this chunk's section ids (buildFormatSchema). Prior chunks are
   * passed as context so later sections stay consistent with earlier ones.
   *
   * @param {string} rawInput
   * @param {object} p
   * @param {object} p.spec - format descriptor
   * @param {string[]} p.sectionIds - section ids to generate in this pass
   * @param {object} p.poOutput
   * @param {object} p.architecture
   * @param {object} [p.priorSections] - already-generated sections (context)
   * @param {object} [p.settings] - { projectName, version, ragContext }
   */
  async generateFormatChunk(rawInput, { spec, sectionIds, poOutput, architecture, priorSections = {}, settings = {} }) {
    const { projectName = "Project", version = "latest", ragContext = "" } = settings;

    const guidelines = buildFormatGuidelines(spec, sectionIds);
    const schema = buildFormatSchema(spec, sectionIds);

    const systemInstruction = await constructMasterPrompt(null, {
      projectName,
      ragContext,
      formatGuidelines: guidelines,
      formatName: spec.name
    }, version);

    const sectionTitles = spec.sections
      .filter(s => sectionIds.includes(s.id))
      .map(s => `${s.number}. ${s.title}`)
      .join(', ');

    const prompt = `
<role>
You are the Lead Requirements Engineer authoring a ${spec.name} document. Write it the way a practitioner of THAT method writes it — the conventions below are the method's own, not a house style carried over from another standard. Produce ONLY the sections requested in this pass, in the exact JSON shape defined by the format guidelines in your system instruction.
</role>

<task>
Generate these sections: ${sectionTitles}.
Return a JSON object whose top-level keys are EXACTLY the corresponding section ids (plus "projectTitle" and "revisionHistory"). Do not add, rename, or omit keys.
</task>

<constraints>
1. Every requirement is singular, traceable to the input, and testable by the means this method provides for testability.
2. Do NOT invent features or constraints absent from the refined intent, architecture, or raw input.
3. Maintain consistency with any already-generated sections provided as context — terminology, identifiers and stated decisions carry forward unchanged.
4. Populate every field the section defines. A field the method treats as mandatory (a Volere fit criterion, a PRD acceptance criterion) is not optional because the input was thin — where the input is silent, record a TBD naming what must be decided.
</constraints>

${draftingConventionFor(spec.id)}
${qualityAttributeRulesFor(spec.id)}
${identifierRules(projectName)}

${MERMAID_RULES}

<context>
<refined_intent>${stringifyForPrompt(poOutput)}</refined_intent>
<architecture>${stringifyForPrompt(architecture)}</architecture>
<already_generated_sections>${stringifyForPrompt(priorSections)}</already_generated_sections>
<historical_patterns>${ragContext || "None"}</historical_patterns>
</context>

<input>
Original Raw Description:
${rawInput}
</input>
`;

    return this.callLLM(prompt, TEMPERATURES.developer, true, schema, 3, 5000, {
      systemInstruction,
      maxOutputTokens: this.tokenLimits.srsRequirements,
      onStream: settings.onStream
    });
  }

  /**
   * Pillar 1: Agentic Reflection
   * Refines a specific TARGET SECTION of an existing SRS draft based on feedback.
   */
  async refineSRS(rawInput, originalRequirements, originalArchitecture, targetSectionDraft, targetSectionName, feedback) {
    const prompt = `
<role>
You are the Lead Developer performing SURGICAL REFINEMENT on a specific section of an SRS document. You previously generated this section and are now correcting identified issues.
</role>

<task>
Apply all feedback items to the '${targetSectionName}' section. Produce a FULLY UPDATED version of this section that incorporates every feedback point while maintaining technical consistency with the rest of the SRS.
</task>

<constraints>
1. Modify ONLY the target section. Content outside its scope stays untouched.
2. Address every feedback item. If one cannot be applied without contradicting the input, say so in the affected text rather than silently ignoring it.
3. Keep the document's specification register — declarative, third-person, present tense.
4. If feedback references diagrams, adhere to the Mermaid 11.x syntax standards.
5. Identifiers are stable configuration items. Preserve the numbering of every requirement you keep; if a requirement is split, the original keeps its identifier and the new obligation takes the next unused one. Never renumber to close a gap.
</constraints>

${NORMATIVE_LANGUAGE_RULES}

${MERMAID_RULES}

<context>
<overall_architecture>${stringifyForPrompt(originalArchitecture)}</overall_architecture>
</context>

<input>
Issues to Fix:
${stringifyForPrompt(feedback)}

Current '${targetSectionName}' Draft:
${stringifyForPrompt(targetSectionDraft)}

Original Raw Description:
${rawInput}
</input>
`;
    // The schema is what keeps a surgical refinement surgical: whatever comes back is spread
    // straight over the draft, so a section refined under the whole-document schema returns a
    // whole document — assembled from the one section the model was shown — and overwrites
    // everything it did not rewrite.
    //
    // Appendices had no entry here and fell through to SRSSchema, which is exactly the case
    // that fires most often: the reflection loop picks this section whenever feedback mentions
    // a diagram, and the Critic's feedback usually does. The refinement dropped the Mermaid
    // models it was invoked to repair, so a finished document had no diagrams at all. It went
    // unnoticed while the run was being killed at the function time limit mid-loop, because
    // the failsafe then persisted the pre-reflection draft, which still had them.
    const REFINEMENT_SCHEMAS = {
      Shell: SRSShellSchema,
      Features: SRSFeaturesSchema,
      Requirements: SRSRequirementsSchema,
      Appendices: SRSAppendicesSchema
    };

    const schemaToUse = REFINEMENT_SCHEMAS[targetSectionName];
    if (!schemaToUse) {
      // Refusing beats falling back to SRSSchema. A section this method cannot constrain is a
      // section it cannot safely merge, and skipping the refinement costs a quality pass —
      // where guessing costs the document.
      throw new Error(`refineSRS: no schema for section "${targetSectionName}"`);
    }

    return this.callLLM(prompt, TEMPERATURES.developer, true, schemaToUse, 3, 5000, {
      maxOutputTokens: this.tokenLimits.srsRefinement
    });
  }
}
