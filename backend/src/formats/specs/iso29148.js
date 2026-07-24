/**
 * ISO/IEC/IEEE 29148:2018 Software Requirements Specification descriptor.
 * The modern successor to IEEE 830 — a distinct clause structure (Introduction → References →
 * Specific Requirements → Verification → Annexes), generated directly into this shape via the
 * descriptor engine (tier 'detailed' → full pipeline).
 */
export const iso29148 = {
    id: 'iso29148',
    name: 'ISO/IEC/IEEE 29148:2018',
    description: 'Modern requirements-engineering standard (successor to IEEE 830).',
    tier: 'detailed',
    coverSubtitle: 'System/Software Requirements Specification',
    requirementModel: 'ieee',
    // Generation chunks respect Gemini free-tier token limits for the full pipeline.
    chunks: [
        ['introduction', 'references'],
        ['specificRequirements', 'systemFunctions'],
        ['systemAttributes', 'verification', 'glossary', 'appendices'],
    ],
    sections: [
        {
            id: 'introduction', number: '1', title: 'Introduction', kind: 'group',
            guideline: 'Purpose, scope and a product overview.',
            fields: [
                { id: 'purpose', label: 'Purpose', kind: 'prose' },
                { id: 'scope', label: 'Scope', kind: 'prose', guideline: 'Identify the product; benefits, objectives and goals.' },
                { id: 'productPerspective', label: 'Product Perspective', kind: 'prose' },
                { id: 'productFunctions', label: 'Product Functions', kind: 'list' },
                { id: 'userCharacteristics', label: 'User Characteristics', kind: 'user-classes' },
                { id: 'constraints', label: 'Limitations and Constraints', kind: 'list' },
                { id: 'assumptionsAndDependencies', label: 'Assumptions and Dependencies', kind: 'list' },
            ],
        },
        {
            id: 'references', number: '2', title: 'References', kind: 'list',
            guideline: 'All referenced standards and documents.',
        },
        {
            id: 'specificRequirements', number: '3', title: 'External Interfaces', kind: 'group',
            guideline: 'External interface requirements.',
            fields: [
                { id: 'userInterfaces', label: 'User Interfaces', kind: 'prose' },
                { id: 'hardwareInterfaces', label: 'Hardware Interfaces', kind: 'prose' },
                { id: 'softwareInterfaces', label: 'Software Interfaces', kind: 'prose' },
                { id: 'communicationsInterfaces', label: 'Communications Interfaces', kind: 'prose' },
            ],
        },
        {
            id: 'systemFunctions', number: '4', title: 'System Functions', kind: 'feature-list',
            requirementModel: 'ieee',
            guideline: 'Functional capabilities, one subsection per function with atomic requirements.',
        },
        {
            id: 'systemAttributes', number: '5', title: 'Software System Attributes', kind: 'group',
            guideline: 'Non-functional attributes and business rules.',
            fields: [
                { id: 'performance', label: 'Performance Requirements', kind: 'list' },
                { id: 'security', label: 'Security', kind: 'list' },
                { id: 'safety', label: 'Safety', kind: 'list' },
                { id: 'qualityAttributes', label: 'Software Quality Attributes', kind: 'list' },
                { id: 'businessRules', label: 'Business Rules', kind: 'list' },
            ],
        },
        {
            id: 'verification', number: '6', title: 'Verification', kind: 'prose',
            guideline: 'How the requirements in Section 3-5 will be verified (inspection, analysis, demonstration, test).',
        },
        {
            id: 'glossary', number: 'A', title: 'Definitions', kind: 'glossary', appendix: true,
            guideline: 'Terms, acronyms and abbreviations.',
        },
        {
            id: 'appendices', number: 'B', title: 'Analysis Models', kind: 'diagrams', appendix: true,
            guideline: 'Structural diagrams; select the most fitting Mermaid type per function.',
        },
    ],
};
