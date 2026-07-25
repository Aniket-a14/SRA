/**
 * Frontend mirror of the backend format descriptors (backend/src/formats). One shared shape
 * drives both the results renderer and the DOCX export, so a format is defined once (per side)
 * and every layer stays consistent. Keep in sync with the backend specs.
 */

export type SectionKind =
    | 'prose'
    | 'list'
    | 'group'
    | 'feature-list'
    | 'requirement-group'
    | 'user-classes'
    | 'stakeholders'
    | 'personas'
    | 'user-stories'
    | 'issues'
    | 'glossary'
    | 'diagrams';

export type FieldKind = 'prose' | 'list' | 'shell-list' | 'user-classes';

/**
 * Mirrors `backend/src/formats/schemaBuilder.js`. `ieee` requirements are plain strings; the
 * other three are objects and are rendered by the `isShell` branch in format-results.tsx.
 */
export type RequirementModel = 'ieee' | 'iso-29148' | 'volere-shell' | 'story';

export interface FormatField {
    id: string;
    label: string;
    kind: FieldKind;
    guideline?: string;
}

export interface FormatSection {
    id: string;
    number: string;
    title: string;
    kind: SectionKind;
    guideline?: string;
    fields?: FormatField[];
    requirementModel?: RequirementModel;
    appendix?: boolean;
}

export interface FormatSpec {
    id: string;
    name: string;
    description: string;
    tier: 'detailed' | 'light';
    legacyPipeline?: boolean;
    coverSubtitle: string;
    requirementModel: RequirementModel;
    sections: FormatSection[];
}

export interface FormatMeta {
    id: string;
    name: string;
    description: string;
    tier: 'detailed' | 'light';
}

/**
 * A structured requirement item. Covers both the Volere shell (rationale + fitCriterion) and
 * the ISO 29148 attribute set (rationale + verificationMethod + source); `description` is the
 * requirement text in both, which is what the renderers key on.
 */
export interface RequirementShell {
    id?: string;
    description: string;
    rationale?: string;
    fitCriterion?: string;
    /** ISO 29148 only: Inspection | Analysis | Demonstration | Test, or TBD when unassigned. */
    verificationMethod?: string;
    source?: string;
}
