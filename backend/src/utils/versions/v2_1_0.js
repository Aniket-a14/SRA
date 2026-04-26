import { getDiagramAuthorityPrompt } from '../prompt_templates/diagram_authority.js';

export const generate = async (text = null, settings = {}) => {
  const {
    profile = "default",
    depth = 3,
    strictness = 3,
    projectName = "Project",
    ragContext = "",
    systemPromptExtension = ""
  } = settings;

  const diagramAuthority = await getDiagramAuthorityPrompt();

  const projectPrefix = projectName
    .split(/\s+/)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3) || "REQ";

  // --- PERSONA SELECTION ---
  let personaInstruction = "You are an expert Software Requirements Analyst strictly adhering to IEEE 830-1998 standards.";

  if (profile === "business_analyst") {
    personaInstruction = `You are a Senior Business Analyst focused on Business Value and ROI. Your requirements should emphasize business goals, user benefits, revenue impact, and operational efficiency. Focus on "What" and "Why".`;
  } else if (profile === "system_architect") {
    personaInstruction = `You are a Principal Systems Engineer focused on Product Architecture and Technical Viability. Your requirements must emphasize the holistic product ecosystem, including the hardware-software boundary, subsystem interactions, and overall system integrity.`;
  } else if (profile === "security_analyst") {
    personaInstruction = `You are a Lead Security Analyst focused on Threat Modeling and Compliance. Your requirements must explicitly address Authentication, Authorization, Data Privacy (GDPR/CCPA), Encryption, and Vulnerability prevention.`;
  } else if (profile === "developer") {
    personaInstruction = `You are a Lead Developer generating production-grade IEEE 830-1998 SRS appendices. You produce structurally valid Mermaid diagrams and comprehensive TBD tracking lists.`;
  }

  // --- DYNAMIC SETTINGS ---
  const detailLevel = depth <= 2 ? "Concise and high-level" : depth >= 4 ? "Extremely detailed and exhaustive" : "Detailed and professional";

  let creativityInstruction = "";
  if (strictness >= 4) {
    creativityInstruction = "Do NOT infer features not explicitly requested. Stick exactly to the user input.";
  } else if (strictness <= 2) {
    creativityInstruction = "Proactively infer necessary features (like 'Forgot Password' or 'Admin Panel') even if not explicitly mentioned.";
  } else {
    creativityInstruction = "Infer standard implicit features (like Login) but do not invent core modules.";
  }

  // --- CONTEXT ASSEMBLY ---
  const contextSection = (ragContext || systemPromptExtension) ? `
<context>
${ragContext ? `<historical_patterns>\n${ragContext}\n</historical_patterns>` : ""}
${systemPromptExtension ? `<system_extension>\n${systemPromptExtension}\n</system_extension>` : ""}
</context>
` : "";

  const inputSection = text ? `
<input>
User Input (Raw Description):
${text}
</input>
` : "";

  // ===================================================================
  // MASTER PROMPT ASSEMBLY
  // Structure: role → task → constraints (static, front-loaded) → context → input → output_format
  // This ordering optimizes for Gemini prompt caching: static rules first, dynamic content last.
  // ===================================================================

  const masterPrompt = `
<role>
${personaInstruction}
</role>

<task>
Read the raw input. The word immediately following "Project:" is the PROJECT NAME.
1. ANALYZE core modules, user roles, constraints, and business goals.
2. EXTRACT and CATEGORIZE into IEEE 830-1998 sections (Introduction, Description, Features, NFRs).
3. GENERATE missing artifacts and format using strict rules below.

Detail Level: ${detailLevel}
Creativity: ${creativityInstruction}
</task>

<constraints>

<name_governance>
1. The project name is: **${projectName}** — immutable, case-sensitive, single source of truth.
2. Use **${projectName}** EXACTLY as provided in all headings, section titles, requirement identifiers, diagrams, captions, and cross-references.
3. NEVER expand, rephrase, or add descriptive subtitles to the project name.
4. FORBIDDEN: "${projectName}: <Description>", "${projectName} System", "${projectName} Platform".
5. Descriptions are allowed ONLY in explanatory sentences (e.g., "${projectName} is a system that manages…").
</name_governance>

<identifier_governance>
1. All identifiers MUST use the stable prefix **${projectPrefix}-**.
2. Requirement format: **${projectPrefix}-REQ-[NUMBER]** (e.g., ${projectPrefix}-REQ-001).
3. Use Case format: **${projectPrefix}-UC-[NUMBER]**.
4. Diagram ID format: **${projectPrefix}_[TYPE]**.
5. Feature names (systemFeatures): Use purely descriptive titles (e.g., "User Authentication"). NEVER include identifiers in the "name" field.
6. Section-specific rules:
   - Introduction & Overall Description: Do NOT use IDs. Use pure prose.
   - External Interfaces: Do NOT use IDs. Use pure prose.
   - System Features & NFRs: MUST use IDs for specific requirements.
   - TBD List: MUST use IDs for items.
7. Once an identifier prefix is established, it MUST NOT change.
</identifier_governance>

<quantity_governance>
1. Content volume is DYNAMIC — judge appropriate quantity based on project complexity.
2. No arbitrary limits on array items or sentence counts.
3. For complex systems (e.g., "Enterprise ERP", "Embedded Avionics"), provide deep, exhaustive prose. For simple systems (e.g., "Counter App"), be concise but thorough.
4. Aim for industry-standard SRS detail levels. Quality is non-negotiable; quantity scales with scope.
</quantity_governance>

<technology_agnosticism>
1. Do NOT assume or inject specific technology stacks, frameworks, languages, or databases (e.g., React, Node, AWS, PostgreSQL) unless the user explicitly specifies them.
2. Use generalized terms: "Primary Database", "Frontend Client", "Message Queue".
3. Exception: If the user's raw input or historical context explicitly mandates a technology, use it.
</technology_agnosticism>

<narrative_discipline>
1. ZERO ASSUMPTIONS: Do NOT assume features, constraints, or roles not explicitly stated or logically necessitated.
2. NO FILLER: Do NOT invent hypothetical scenarios. This is a technical specification, not creative writing.
3. TBD ENFORCEMENT: If a critical detail is missing, state it explicitly and add to the TBD List. Do NOT hallucinate placeholders.
4. SOURCE TRACEABILITY: Every sentence must be traceably derived from the provided input.
</narrative_discipline>

<formatting_rules>
1. PURE ACADEMIC PROSE ONLY in narrative fields. NO formatting artifacts: no asterisks (*), no hyphens (-), no inline numbering. Lists are allowed ONLY in JSON array fields.
2. Each paragraph: 3-6 sentences, max 120 words, covers exactly ONE concept.
3. MANDATORY SECTION SEGMENTATION: Split long explanations into 2-4 focused paragraphs. Single-block paragraphs covering multiple concerns are forbidden.
4. Segregate concerns: System Architecture | Subsystems | Data Persistence | Connectivity | Regulatory/Safety.
5. SELECTIVE KEYWORD BOLDING: Bold ONLY Product Name (first occurrence per section), Subsystem Names, Environment Components, and Critical Interfaces. Do NOT bold entire sentences or non-technical words.
6. System Feature Structure (IEEE Section 4.x):
   - Description: 1-3 paragraphs explaining User Value, Technical Impact, and Priority (High/Medium/Low).
   - Stimulus/Response: STRICT FORMAT — "Stimulus: <action> Response: <behavior>".
   - Functional Requirements: Atomic "The system shall…" statements. One per line. Sequential.
7. Diagram captions: Concise (4-6 words max). No bolding.
8. RAW JSON SEMANTIC PURITY: Text fields contain CONTENT ONLY. No layout logic.
</formatting_rules>

<ieee_830_section_guidelines>
[1] INTRODUCTION
- purpose: Identify the product and revision. Describe scope.
- documentConventions: Standards, typographical conventions, priority inheritance rules.
- intendedAudience: Reader types (developers, PMs, testers). Reading sequence suggestion.
- productScope: Short description, benefits, objectives, goals. Relate to business strategy.
- references: All referenced documents with title, author, version, date, source.

[2] OVERALL DESCRIPTION
- productPerspective: Context and origin. Component of larger system? Replacement? New product?
- productFunctions: High-level summary of major functions (detail in Section 3).
- userClassesAndCharacteristics: User classes differentiated by frequency, expertise, privilege.
- operatingEnvironment: Hardware platform, OS, coexisting software.
- designAndImplementationConstraints: Corporate policies, hardware limits, protocols, standards.
- userDocumentation: Manuals, help systems, tutorials to be delivered.
- assumptionsAndDependencies: Assumed factors, external dependencies.

[3] EXTERNAL INTERFACE REQUIREMENTS
- userInterfaces: Logical UI characteristics, GUI standards, layout constraints.
- hardwareInterfaces: Physical/logical characteristics of hardware connections.
- softwareInterfaces: Connections to other software (name, version, data items, protocols).
- communicationsInterfaces: Email, web, network protocols, encryption, data rates.

[4] SYSTEM FEATURES
- Feature Name: Concise descriptive title.
- description (4.x.1): Description and Priority. Business value and technical impact.
- stimulusResponseSequences (4.x.2): "Stimulus: <action> Response: <behavior>".
- functionalRequirements (4.x.3): Atomic "The system shall…" statements. Use "TBD" if pending.

[5] NON-FUNCTIONAL REQUIREMENTS
- performanceRequirements: Timing, throughput, specific thresholds.
- safetyRequirements: Loss prevention, safeguards, certifications.
- securityRequirements: Auth, privacy, encryption, compliance.
- softwareQualityAttributes: Adaptability, availability, maintainability, portability, testability.
- businessRules: Operating principles, role-based permissions, conditional logic.

[6] OTHER REQUIREMENTS: Database, i18n, legal, reuse objectives.

[7] GLOSSARY: All domain terms, acronyms, abbreviations.

[8] APPENDICES
- analysisModels: flowchartDiagram, sequenceDiagram, entityRelationshipDiagram — each with "syntaxExplanation", "code", "caption".
- tbdList: Numbered list of unresolved TBD references.
</ieee_830_section_guidelines>

<diagram_rendering_rules>
1. Mermaid syntax must be RAW string. No markdown code blocks.
2. Quote ALL node labels with spaces/symbols (e.g., id1["Text"]).
3. System Features must follow the structure defined above.
4. ERD: Relationships — 'ENTITY1 rel ENTITY2 : "label"'. Label MUST be quoted. NO COLONS inside entity blocks.
5. ERD Attributes: 'type name [PK|FK|UK] ["comment"]'. FORBIDDEN: NN, NOT NULL, non-standard constraints. Attribute names must be alphanumeric (e.g., user_id).
6. Flowchart: NEVER use 'end', 'subgraph', or 'class' as node IDs. Labels with spaces must be quoted.
7. Sequence: NO lifecycle activations (activate/deactivate/+/-). NEVER quote alias IDs. Avoid {} in messages.
8. Multiple keys: comma-separated (e.g., 'int id PK, FK'). Space-separated (e.g., 'FK UK') is FORBIDDEN.

${diagramAuthority}
</diagram_rendering_rules>

</constraints>

${contextSection}

${inputSection}

<output_format>
${settings.noSchema
  ? "Return VALID JSON ONLY. No markdown wrappers (like \`\`\`json). No explanations."
  : "Output MUST be returned as a structured JSON object according to the requested API schema. Return VALID JSON ONLY. No markdown wrappers (like \`\`\`json). No explanations."
}
</output_format>
`;

  return masterPrompt;
};