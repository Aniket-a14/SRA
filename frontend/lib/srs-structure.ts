import { type SRSIntakeModel, type IntakeField } from '../types/srs-intake';

export interface SubsectionConfig {
    id: string; // e.g., "1.1"
    key: string; // key in the SRSIntakeModel interface e.g. "purpose"
    title: string;
    description?: string;
    placeholder?: string;
    hints: string[];
    isRequired: boolean;
    inputType: 'textarea' | 'dynamic-list'; // For simple fields vs arrays
}

export interface SectionConfig {
    id: string; // "1"
    key: keyof SRSIntakeModel; // "introduction"
    title: string;
    subsections: SubsectionConfig[];
}

export const SRS_STRUCTURE: SectionConfig[] = [
    {
        id: '1',
        key: 'details',
        title: 'Project Details',
        subsections: [
            {
                id: '1.1',
                key: 'projectName',
                title: 'Project Name',
                description: 'The official name of the project or product.',
                placeholder: 'e.g., Smart Requirements Analyzer',
                hints: ['Acronyms will be generated from this name'],
                isRequired: true,
                inputType: 'textarea'
            },
            {
                id: '1.2',
                key: 'fullDescription',
                title: 'Full Software Requirements',
                description: 'Describe the entire project: Purpose, Scope, Features, User Types, and any Constraints. Write everything here.',
                placeholder: 'Start describing your project in detail...',
                hints: ['Describe Features', 'Identify Users', 'Set Constraints'],
                isRequired: true,
                inputType: 'textarea'
            }
        ]
    }
];

// Initial State Factory
export const createInitialIntakeState = (): SRSIntakeModel => {
    // Helper to create empty field
    const field = (sec: string, sub: string, req: boolean): IntakeField => ({
        content: '',
        metadata: {
            section_id: sec,
            subsection_id: sub,
            domain_type: 'web', // Default
            is_required: req,
            completion_status: 'empty'
        }
    });

    return {
        details: {
            projectName: field('1', '1.1', true),
            fullDescription: field('1', '1.2', true)
        }
    }
}
