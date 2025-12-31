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
    // 1. Introduction
    {
        id: '1',
        key: 'introduction',
        title: 'Introduction',
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
                key: 'content',
                title: 'Introduction Details',
                description: 'Provide the Purpose, Scope, Definitions, References, and Overview of the project.',
                placeholder: 'Describe the purpose, scope, and key terms...',
                hints: ['Purpose & Scope', 'Definitions & Acronyms', 'References'],
                isRequired: true,
                inputType: 'textarea'
            }
        ]
    },
    {
        id: '2',
        key: 'overallDescription',
        title: 'Overall Description',
        subsections: [
            {
                id: '2.1',
                key: 'content',
                title: 'Full Description',
                description: 'Describe the product perspective, functions, user classes, operating environment, and constraints.',
                hints: ['Product Perspective', 'User Classes', 'Constraints', 'Dependencies'],
                isRequired: true,
                inputType: 'textarea'
            }
        ]
    },
    {
        id: '3',
        key: 'externalInterfaces',
        title: 'External Interface Requirements',
        subsections: [
            {
                id: '3.1',
                key: 'content',
                title: 'Interface Requirements',
                description: 'Describe user, hardware, software, and communication interfaces.',
                hints: ['GUI Layouts', 'API Integrations', 'Hardware Connections'],
                isRequired: true,
                inputType: 'textarea'
            }
        ]
    },
    {
        id: '4',
        key: 'systemFeatures',
        title: 'System Features',
        subsections: [
            {
                id: '4.1',
                key: 'features',
                title: 'Functional Requirements',
                description: 'Define the functional requirements for each system feature.',
                hints: ['Organize by feature', 'Input/Process/Output'],
                isRequired: true,
                inputType: 'dynamic-list' // Special handling for list of features
            }
        ]
    },
    {
        id: '5',
        key: 'nonFunctional',
        title: 'Nonfunctional Requirements',
        subsections: [
            {
                id: '5.1',
                key: 'content',
                title: 'Nonfunctional Requirements',
                description: 'Specify performance, safety, security, quality attributes, and business rules.',
                hints: ['Performance', 'Security', 'Reliability', 'Business Rules'],
                isRequired: true,
                inputType: 'textarea'
            }
        ]
    },
    {
        id: '6',
        key: 'other',
        title: 'Other Requirements',
        subsections: [
            {
                id: '6.1',
                key: 'appendix',
                title: 'Appendix',
                description: 'Any other requirements or information.',
                hints: ['Legal requirements', 'Temporary features'],
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
        introduction: {
            projectName: field('1', '1.1', true),
            content: field('1', '1.2', true)
        },
        overallDescription: {
            content: field('2', '2.1', true)
        },
        externalInterfaces: {
            content: field('3', '3.1', true)
        },
        systemFeatures: {
            features: [] // Starts empty
        },
        nonFunctional: {
            content: field('5', '5.1', true)
        },
        other: {
            appendix: field('6', '6.1', true)
        }
    }
}
