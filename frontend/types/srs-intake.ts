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
    purpose: IntakeField; // 1.1
    scope: IntakeField; // 1.2
    definitions: IntakeField; // 1.3 (Commonly included, though prompt listed specific ones, aiming for standard IEEE)
    references: IntakeField; // 1.4
    overview: IntakeField; // 1.5
}

// 2. Overall Description
export interface OverallDescriptionSection {
    productPerspective: IntakeField; // 2.1
    productFunctions: IntakeField; // 2.2
    userClasses: IntakeField; // 2.3
    operatingEnvironment: IntakeField; // 2.4
    constraints: IntakeField; // 2.5
    userDocumentation: IntakeField; // 2.6
    assumptionsDependencies: IntakeField; // 2.7
}

// 3. External Interface Requirements
export interface ExternalInterfaceSection {
    userInterfaces: IntakeField; // 3.1
    hardwareInterfaces: IntakeField; // 3.2
    softwareInterfaces: IntakeField; // 3.3
    communicationInterfaces: IntakeField; // 3.4
}

// 4. System Features
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
    performance: IntakeField; // 5.1
    safety: IntakeField; // 5.2
    security: IntakeField; // 5.3
    quality: IntakeField; // 5.4
    businessRules: IntakeField; // 5.5 (Common addition)
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
