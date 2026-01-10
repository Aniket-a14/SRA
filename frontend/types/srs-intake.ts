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

// Unified Intake Model
export interface UnifiedIntakeSection {
    projectName: IntakeField;
    fullDescription: IntakeField;
}

export interface SRSIntakeModel {
    details: UnifiedIntakeSection;
}

// Validation Types
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
    validation_status: 'PASS' | 'FAIL' | 'CLARIFICATION_REQUIRED';
    issues: ValidationIssue[];
    clarification_questions?: string[];
}
