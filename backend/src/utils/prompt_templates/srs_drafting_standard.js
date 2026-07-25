/**
 * The drafting conventions a real SRS is written to, expressed once and shared by the agents.
 *
 * These exist because each agent used to restate requirement rules in its own words, and the
 * restatements drifted — most visibly on identifiers, where the agents asked for a prefix the
 * master system prompt forbids. Anything an agent asserts about how a requirement is worded
 * belongs here, so the system turn and the user turn cannot contradict each other.
 *
 * Sources: ISO/IEC/IEEE 29148:2018 §5.2.4-5.2.7 (normative language, characteristics of
 * individual requirements) and IEEE 830-1998 §4.3 (unambiguity, verifiability, ranking).
 */

/**
 * The stable identifier prefix: an acronym of the project name, capped at three letters.
 * Duplicated in prompt version modules until v2_2_0; they now import this so a change to the
 * scheme cannot leave the system turn and the agents disagreeing about what an ID looks like.
 */
export const deriveProjectPrefix = (projectName = "") =>
    String(projectName)
        .split(/\s+/)
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 3) || "REQ";

/**
 * Normative language. The distinction between shall/should/may/will is the single convention
 * that makes an SRS contractually readable — it is what tells a reader which sentences are
 * binding obligations and which are advice.
 */
export const NORMATIVE_LANGUAGE_RULES = `
<normative_language>
1. "shall" states a binding requirement. It is the ONLY verb that creates an obligation.
2. "should" states a recommendation — non-binding, and never used for behaviour that must be delivered.
3. "may" states an option genuinely left to the implementer.
4. "will" states a fact about the environment or an external party, not an obligation on this system.
5. Do NOT use "must" — in specification practice it reads as an externally imposed legal or regulatory constraint rather than a system requirement.
6. Exactly one "shall" per requirement. A sentence needing two is two requirements.
7. Name the actor. "The system shall reject …", never "… shall be rejected" — passive voice hides who is obligated.
8. BANNED, because they specify a capability rather than an observable behaviour: "shall be able to", "shall have the ability to", "shall be capable of", "shall support", "shall provide for", "shall allow for".
   Write what the system does: not "The system shall support CSV export" but "The system shall export the selected report as a CSV file when the user selects Export".
9. BANNED as unverifiable: "user-friendly", "intuitive", "seamless", "robust", "flexible", "efficient", "fast", "state-of-the-art", "as appropriate", "if necessary", "where possible", "etc.", "and/or", "including but not limited to".
10. BANNED without a stated baseline: "improved", "faster", "minimise", "maximise", "optimise" — a comparative with nothing to compare against cannot be tested.
</normative_language>
`;

/**
 * The sentence pattern real requirements are written to. Stating the shape explicitly produces
 * far more consistent output than asking for "atomic, verifiable" in the abstract.
 */
export const REQUIREMENT_FORM = `
<requirement_form>
Write each functional requirement to this pattern:
  [<trigger or precondition>,] the <system> shall <observable action> <object> [<qualifying constraint>].

Worked examples:
  "Upon receiving a payment authorisation failure, the system shall retain the order in Pending state and notify the customer within 60 seconds."
  "The system shall lock an account for 30 minutes after five consecutive failed sign-in attempts within a 15-minute window."

Each requirement must be testable by a single objective pass/fail observation. If you cannot
describe how a tester would confirm it, the requirement is not yet specific enough — either
sharpen it or record the missing detail as a TBD.
</requirement_form>
`;

/**
 * Quality attributes are where specifications most often go soft. A number without the
 * condition it was measured under is not actually verifiable, so both are required.
 */
export const NFR_QUANTIFICATION_RULES = `
<quality_attribute_rules>
1. Every quality-attribute requirement states a metric, a value with units, and the condition the value holds under. A threshold with no load, percentile or environment attached is not verifiable.
   Weak:   "The system shall be highly available."
   Weak:   "The system shall respond quickly."
   Strong: "The system shall return search results within 800 ms at the 95th percentile while serving 500 concurrent sessions."
   Strong: "The system shall sustain 99.9% availability measured monthly, excluding scheduled maintenance windows."
2. Where the input genuinely does not support a threshold, still write the requirement and mark the value as a TBD naming what must be decided and who decides it. Never silently omit the attribute, and never invent a number the input cannot justify.
3. Security requirements state the asset, the threat, and the control — not just the control.
4. Cover only the attributes the product's domain actually implicates. An attribute listed with no bearing on this system is noise.
</quality_attribute_rules>
`;

/**
 * What a review actually looks for. Replaces the previous "don't be pedantic" framing, which
 * told the quality gate to overlook the defect class that matters most.
 */
export const REVIEW_DEFECT_CHECKLIST = `
<defect_checklist>
Judge the draft against these, in descending order of severity:
1. UNFAITHFUL — content with no origin in the stakeholder input, or stated intent that the draft dropped. Invented scope is the most serious defect a specification can carry.
2. CONTRADICTORY — two requirements that cannot both hold, or a quality attribute that defeats a feature.
3. UNVERIFIABLE — a requirement no tester could objectively pass or fail: unquantified thresholds, banned vague terms, capability phrasing ("shall support") instead of behaviour.
4. NON-ATOMIC — one requirement carrying several obligations, usually joined by "and" or "or".
5. MISPLACED — content in the wrong section, or a feature missing its description, stimulus/response, or functional requirements.
6. UNTRACKED UNKNOWN — a gap left implicit, or a "TBD" in the body that never reaches the TBD list.
7. TERMINOLOGY DRIFT — the same concept named differently across sections, or a domain term absent from the glossary.

Thin stakeholder input does not excuse an unverifiable requirement — the correct response to a
gap is a tracked TBD, not a vague sentence. Judge the draft on what it does with the input it
had, and do not penalise it for scope the input never implied.
</defect_checklist>
`;

/** Identifier rules, parameterised so agents state exactly what the system turn states. */
export const identifierRules = (projectName) => {
    const prefix = deriveProjectPrefix(projectName);
    return `
<identifiers>
1. Requirement identifiers use the stable prefix "${prefix}-", in the form ${prefix}-REQ-001. Derive it from the project name; never use the full project name as the prefix.
2. Numbering is sequential and permanent. An identifier is never renumbered or reused once assigned, and a retired requirement's identifier is not given to a new one.
3. Feature names carry no identifier — "User Authentication", not "${prefix}-SF-1 User Authentication".
4. Narrative sections (Introduction, Overall Description, External Interfaces) carry no identifiers; they are prose.
</identifiers>
`;
};

// ---------------------------------------------------------------------------
// Per-format drafting conventions
//
// The four supported formats are not stylistic variants of one document — they encode
// genuinely different requirements-engineering methods, and the wording discipline that makes
// an IEEE 830 specification rigorous makes a Volere shell or an Agile PRD wrong. "The system
// shall" belongs in the shall-based standards; in Volere the testability lives in the Fit
// Criterion, and in a PRD it lives in the acceptance criteria. Forcing one house style across
// all four produces documents that claim a standard they do not follow.
// ---------------------------------------------------------------------------

const ISO_29148_CONVENTION = `
<method_conventions>
This document follows ISO/IEC/IEEE 29148:2018, the successor to IEEE 830. Beyond the shared
normative language, that standard asks for more per requirement than IEEE 830 did:

1. Requirement construct (§5.2.5): [Condition] [Subject] [Action] [Object] [Constraint of action].
   "While the vehicle is stationary, the control unit shall complete a firmware update within 10 minutes."
2. Each requirement is SINGULAR (one capability), NECESSARY (removing it leaves a deficiency),
   APPROPRIATE (stated at the right level of abstraction for this document), and CONFORMING
   (uses the standard's language conventions).
3. State the rationale where a requirement's reason is not self-evident from its wording — a
   requirement whose purpose is unrecoverable cannot be safely changed later.
4. The requirement SET must also hold together: complete, internally consistent, feasible as a
   whole, and able to be validated by the stakeholders who supplied the need.
5. Distinguish stakeholder needs from system requirements. Do not restate a business goal as a
   system obligation without deriving the behaviour it implies.
</method_conventions>
`;

const VOLERE_CONVENTION = `
<method_conventions>
This document follows the Robertson Volere template. Volere's discipline is different from the
shall-based standards, and applying IEEE phrasing here would misrepresent the method:

1. Do NOT force "The system shall" phrasing. A Volere requirement is written as a plain,
   readable DESCRIPTION of what is wanted, in the stakeholder's own terms.
2. Testability lives in the FIT CRITERION, not in the description. The fit criterion restates
   the requirement in measurable terms so it can be objectively tested — this separation is the
   central idea of the method.
   Description:   "The product shall be easy for a new dispatcher to learn."
   Fit criterion: "A dispatcher with no prior exposure completes the standard booking task
                   unaided within 15 minutes on their first attempt, in 8 of 10 trials."
   Note that a word like "easy", unacceptable in an IEEE requirement, is legitimate in a Volere
   description precisely because the fit criterion is where it gets pinned down.
3. Give each requirement a RATIONALE (why it is wanted) and an ORIGINATOR (whose need it is).
   An unattributed requirement cannot be renegotiated later.
4. Classify non-functional requirements by Volere's own types — Look and Feel, Usability and
   Humanity, Performance, Operational and Environmental, Maintainability and Support, Security,
   Cultural, Legal — rather than a generic quality-attribute list.
5. Record conflicts between requirements explicitly where they exist; Volere expects tension to
   be surfaced, not silently resolved.
</method_conventions>
`;

const AGILE_PRD_CONVENTION = `
<method_conventions>
This is a Product Requirements Document, not a formal specification. Its register is different
and formal specification phrasing is actively wrong here:

1. Do NOT use "The system shall". A PRD is written in plain product language for a team that
   will refine the detail collaboratively.
2. Capability is expressed as user stories: "As a <persona>, I want <capability>, so that
   <outcome>." The persona must be one actually defined in the Personas section, not invented.
3. Testability lives in ACCEPTANCE CRITERIA. Write them as Given / When / Then:
   "Given a dispatcher with an unsaved booking, when they navigate away, then the system
    prompts them to confirm before discarding."
4. Goals are measurable outcomes, not activities. "Reduce median booking time from 6 to 3
   minutes", not "improve the booking flow".
5. State NON-GOALS explicitly. A PRD that never says what it is not doing invites the scope
   argument it exists to prevent.
6. Keep solution detail out. The PRD says what problem is being solved and for whom; how it is
   built is the delivery team's decision.
</method_conventions>
`;

/**
 * The drafting convention for a target format. IEEE 830 and ISO 29148 are shall-based and share
 * the normative-language and requirement-form rules; Volere and Agile PRD deliberately do not.
 */
export const draftingConventionFor = (formatId) => {
    switch (formatId) {
        case 'volere':
            return VOLERE_CONVENTION;
        case 'agile-prd':
            return AGILE_PRD_CONVENTION;
        case 'iso29148':
            return `${NORMATIVE_LANGUAGE_RULES}${REQUIREMENT_FORM}${ISO_29148_CONVENTION}`;
        default:
            return `${NORMATIVE_LANGUAGE_RULES}${REQUIREMENT_FORM}`;
    }
};

/**
 * Quality-attribute wording differs by method too: the shall-based standards quantify in the
 * requirement itself, Volere quantifies in the fit criterion, and a PRD quantifies in its
 * success metrics. Only the first case wants the generic quantification block.
 */
export const qualityAttributeRulesFor = (formatId) =>
    (formatId === 'volere' || formatId === 'agile-prd') ? '' : NFR_QUANTIFICATION_RULES;

/** Method-specific completeness tests a reviewer applies on top of the shared defect checklist. */
const METHOD_CHECKS = {
    volere: `8. SHELL INCOMPLETE — a requirement with no fit criterion, no rationale, or no originator. In Volere these are not optional extras; a description without a fit criterion is untestable by construction.
9. MISCLASSIFIED — a non-functional requirement not placed under one of Volere's own types (Look and Feel, Usability and Humanity, Performance, Operational and Environmental, Maintainability and Support, Security, Cultural, Legal).`,
    'agile-prd': `8. STORY DEFECTS — a user story whose persona is not defined in the Personas section, a story with no acceptance criteria, or acceptance criteria not expressed as an observable Given/When/Then.
9. UNMEASURED GOAL — an objective stated as an activity rather than a measurable outcome, or a PRD with no stated non-goals.`,
    iso29148: `8. MISSING RATIONALE — a requirement whose reason for existing cannot be recovered from the document.
9. LEVEL CONFUSION — a stakeholder need restated as a system requirement without deriving the behaviour it implies.`
};

/**
 * Tells a reviewer which document it is actually looking at. Derived from the descriptor rather
 * than hardcoded, because the Reviewer and Critic run against all four formats — scoring a
 * Volere shell or a PRD against IEEE 830's section numbering marks down a correct document for
 * following its own method.
 */
export const structuralExpectationsFor = (spec) => {
    const sections = (spec?.sections || [])
        .map(s => `  ${s.number}. ${s.title}`)
        .join('\n');

    return `
<target_document>
The document under review is a ${spec?.name || 'IEEE 830-1998'} document. Judge it against that
method's conventions and against its own section structure:
${sections || '  (structure not supplied — apply IEEE 830-1998)'}

Do NOT penalise the document for lacking a section, an identifier scheme, or a phrasing
convention belonging to a different format. A Volere shell is not defective for omitting IEEE
section numbering; a Product Requirements Document is not defective for using user stories
rather than "The system shall". Judge each against what its own method requires.
</target_document>
`;
};

/** The shared defect checklist, extended with whatever the target method additionally demands. */
export const defectChecklistFor = (formatId) => {
    const extra = METHOD_CHECKS[formatId];
    if (!extra) return REVIEW_DEFECT_CHECKLIST;
    return REVIEW_DEFECT_CHECKLIST.replace(
        '</defect_checklist>',
        `${extra}\n</defect_checklist>`
    );
};
