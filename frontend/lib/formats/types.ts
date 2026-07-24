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

export type RequirementModel = 'ieee' | 'volere-shell' | 'story';

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

/** A Volere requirement "shell". */
export interface RequirementShell {
    id?: string;
    description: string;
    rationale?: string;
    fitCriterion?: string;
    source?: string;
}
