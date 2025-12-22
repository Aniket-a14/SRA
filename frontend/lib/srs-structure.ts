import { type SRSIntakeModel, type DomainType, type IntakeField } from '../types/srs-intake';

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
        key: 'introduction',
        title: 'Introduction',
        subsections: [
            {
                id: '1.1',
                key: 'purpose',
                title: 'Purpose',
                description: 'Identify the product/application whose software requirements are specified in this document.',
                placeholder: 'The purpose of this document is to specify...',
                hints: [
                    'Intended audience',
                    'Scope of the document',
                    'Why this project is being undertaken'
                ],
                isRequired: true,
                inputType: 'textarea'
            },
            {
                id: '1.2',
                key: 'scope',
                title: 'Product Scope', // "Document Conventions" usually 1.2 in some standards, Scope is critical though.
                description: 'Provide a short description of the software being specified and its benefits, objectives, and goals.',
                hints: [
                    'What the software WILL do',
                    'What the software WILL NOT do (out of scope)',
                    'Business benefits'
                ],
                isRequired: true,
                inputType: 'textarea'
            },
            {
                id: '1.3',
                key: 'definitions',
                title: 'Definitions, Acronyms, and Abbreviations',
                description: 'Define all terms, acronyms, and abbreviations required to interpret the SRS properly.',
                hints: ['SRA: Smart Requirements Analyzer', 'SRS: Software Requirements Specification'],
                isRequired: false,
                inputType: 'textarea'
            },
            {
                id: '1.4',
                key: 'references',
                title: 'References',
                description: 'List any other documents or web addresses to which this SRS refers.',
                hints: ['IEEE Std 830-1998', 'Internal Process Documents'],
                isRequired: false,
                inputType: 'textarea'
            },
            {
                id: '1.5',
                key: 'overview',
                title: 'Overview',
                description: 'Describe what the rest of the SRS contains and how it is organized.',
                hints: ['Section 2 describes...', 'Section 3 specifies...'],
                isRequired: false,
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
                key: 'productPerspective',
                title: 'Product Perspective',
                description: 'Describe the context and origin of the product. Is it a new product, a follow-on, or part of a larger system?',
                hints: ['System interfaces', 'User interfaces', 'Hardware interfaces'],
                isRequired: true,
                inputType: 'textarea'
            },
            {
                id: '2.2',
                key: 'productFunctions',
                title: 'Product Functions',
                description: 'Summarize the major functions the product must perform.',
                hints: ['High-level capabilities', 'Major feature groups'],
                isRequired: true,
                inputType: 'textarea'
            },
            {
                id: '2.3',
                key: 'userClasses',
                title: 'User Classes and Characteristics',
                description: 'Identify the various user classes that you anticipate will use this product.',
                hints: ['Administrators', 'End Users', 'Guests'],
                isRequired: true,
                inputType: 'textarea'
            },
            {
                id: '2.4',
                key: 'operatingEnvironment',
                title: 'Operating Environment',
                description: 'Describe the environment in which the software will operate.',
                hints: ['Hardware platform', 'Operating system', 'Network configurations'],
                isRequired: false,
                inputType: 'textarea'
            },
            {
                id: '2.5',
                key: 'constraints',
                title: 'Design and Implementation Constraints',
                description: 'Describe any items or issues that will limit the options available to the developers.',
                hints: ['Regulatory policies', 'Hardware limitations', 'Connectivity requirements'],
                isRequired: true,
                inputType: 'textarea'
            },
            {
                id: '2.6',
                key: 'userDocumentation',
                title: 'User Documentation',
                description: 'List the user documentation components (such as user manuals, on-line help, and tutorials) that will be delivered along with the software.',
                hints: ['Online Help', 'User Manuals', 'Tutorials'],
                isRequired: false,
                inputType: 'textarea'
            },
            {
                id: '2.7',
                key: 'assumptionsDependencies',
                title: 'Assumptions and Dependencies',
                description: 'List any assumed factors that would affect the requirements stated in the SRS.',
                hints: ['Third-party components', 'Operating system availability'],
                isRequired: false,
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
                key: 'userInterfaces',
                title: 'User Interfaces',
                description: 'Describe the logical characteristics of each interface between the software product and the users.',
                hints: ['GUI standards', 'Screen layout constraints', 'Error message standards'],
                isRequired: true,
                inputType: 'textarea'
            },
            {
                id: '3.2',
                key: 'hardwareInterfaces',
                title: 'Hardware Interfaces',
                description: 'Describe the logical and physical characteristics of each interface between the software product and the hardware components.',
                hints: ['Supported devices', 'Communication protocols'],
                isRequired: false,
                inputType: 'textarea'
            },
            {
                id: '3.3',
                key: 'softwareInterfaces',
                title: 'Software Interfaces',
                description: 'Describe the connections between this product and other specific software components.',
                hints: ['OS', 'Databases', 'Third-party libraries'],
                isRequired: true,
                inputType: 'textarea'
            },
            {
                id: '3.4',
                key: 'communicationInterfaces',
                title: 'Communication Interfaces',
                description: 'Describe the requirements associated with any communications functions required by this product.',
                hints: ['Email', 'Web browser', 'Network server communications protocols'],
                isRequired: false,
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
                key: 'performance',
                title: 'Performance Requirements',
                description: 'Specify both the static and the dynamic numerical requirements placed on the software or on human interaction with the software.',
                hints: ['Response time', 'Throughput', 'Capacity'],
                isRequired: true,
                inputType: 'textarea'
            },
            {
                id: '5.2',
                key: 'safety',
                title: 'Safety Requirements',
                description: 'Specify those requirements that are concerned with possible loss, damage, or harm that could result from the use of the product.',
                hints: ['Safeguards', 'Data integrity'],
                isRequired: false,
                inputType: 'textarea'
            },
            {
                id: '5.3',
                key: 'security',
                title: 'Security Requirements',
                description: 'Specify the factors that protect the software from accidental or malicious access, use, modification, destruction, or disclosure.',
                hints: ['Authentication', 'Authorization', 'Encryption'],
                isRequired: true,
                inputType: 'textarea'
            },
            {
                id: '5.4',
                key: 'quality',
                title: 'Software Quality Attributes',
                description: 'Specify any additional quality characteristics for the product.',
                hints: ['Availability', 'Maintainability', 'Portability'],
                isRequired: false,
                inputType: 'textarea'
            },
            {
                id: '5.5',
                key: 'businessRules',
                title: 'Business Rules',
                description: 'Define the business rules that the software must enforce.',
                hints: ['Workflows', 'Calculations', 'Policies'],
                isRequired: false,
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
                isRequired: false,
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
            purpose: field('1', '1.1', true),
            scope: field('1', '1.2', true),
            definitions: field('1', '1.3', false),
            references: field('1', '1.4', false),
            overview: field('1', '1.5', false),
        },
        overallDescription: {
            productPerspective: field('2', '2.1', true),
            productFunctions: field('2', '2.2', true),
            userClasses: field('2', '2.3', true),
            operatingEnvironment: field('2', '2.4', false),
            constraints: field('2', '2.5', true),
            userDocumentation: field('2', '2.6', false),
            assumptionsDependencies: field('2', '2.7', false),
        },
        externalInterfaces: {
            userInterfaces: field('3', '3.1', true),
            hardwareInterfaces: field('3', '3.2', false),
            softwareInterfaces: field('3', '3.3', true),
            communicationInterfaces: field('3', '3.4', false),
        },
        systemFeatures: {
            features: [] // Starts empty
        },
        nonFunctional: {
            performance: field('5', '5.1', true),
            safety: field('5', '5.2', false),
            security: field('5', '5.3', true),
            quality: field('5', '5.4', false),
            businessRules: field('5', '5.5', false),
        },
        other: {
            appendix: field('6', '6.1', false)
        }
    }
}
