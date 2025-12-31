export type DomainType = 'web' | 'mobile' | 'system' | 'hybrid';

export interface IntakeFieldMetadata {
    section_id: string; // e.g., "1"
    subsection_id: string; // e.g., "1.1"
    domain_type: DomainType;
    is_required: boolean;
    completion_status: 'empty' | 'partial' | 'complete';
}

export interface IntakeField {
    metadata: IntakeFieldMetadata;
    content: string;
}

// 1. Introduction
export interface IntroductionSection {
    projectName: IntakeField; // 1.1
    content: IntakeField; // 1.2 (Merged Purpose, Scope, Definitions, References, Overview)
}

// 2. Overall Description
export interface OverallDescriptionSection {
    content: IntakeField; // 2.1 (Merged Perspective, Functions, Users, etc.)
}

// 3. External Interface Requirements
export interface ExternalInterfaceSection {
    content: IntakeField; // 3.1 (Merged User, Hardware, Software, Communication)
}

// 4. System Features (Unchanged)
// This is structurally different as it's a list. 
// For strict schema, we might model it as an array of structured feature objects.
export interface SystemFeatureItem {
    id: string; // Auto-generated UUID
    name: string;
    description: IntakeField; // 4.1.1
    stimulusResponse: IntakeField; // 4.1.2
    functionalRequirements: IntakeField; // 4.1.3
    rawInput?: string; // Simplification prompt
}
export interface SystemFeaturesSection {
    features: SystemFeatureItem[];
}

// 5. Nonfunctional Requirements
export interface NonFunctionalSection {
    content: IntakeField; // 5.1 (Merged Performance, Safety, Security, Quality, Business Rules)
}

// 6. Other Requirements
export interface OtherSection {
    appendix: IntakeField;
}

export type ValidationIssueType = 'VAGUE' | 'INCOMPLETE' | 'INCONSISTENT' | 'UNVERIFIABLE' | 'SEMANTIC_MISMATCH' | 'SCOPE_CREEP' | 'AMBIGUITY' | 'OTHER';
export type ValidationSeverity = 'BLOCKER' | 'WARNING';
export type ConflictType = 'HARD_CONFLICT' | 'SOFT_DRIFT' | 'NONE';

export interface ValidationIssue {
    section_id: string;
    subsection_id: string;
    title: string;
    issue_type: ValidationIssueType;
    conflict_type?: ConflictType;
    severity: ValidationSeverity;
    description: string;
    suggested_fix: string;
}

export interface ValidationResult {
    validation_status: 'PASS' | 'FAIL';
    issues: ValidationIssue[];
}

export interface SRSIntakeModel {
    introduction: IntroductionSection;
    overallDescription: OverallDescriptionSection;
    externalInterfaces: ExternalInterfaceSection;
    systemFeatures: SystemFeaturesSection;
    nonFunctional: NonFunctionalSection;
    other: OtherSection;
}
