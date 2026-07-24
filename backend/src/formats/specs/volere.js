/**
 * Volere Requirements Specification descriptor.
 * Structurally the most distinct format: project drivers + stakeholders, a rich NFR taxonomy,
 * project issues, and — critically — every requirement uses the Volere "shell"
 * (description + rationale + fit criterion + source). tier 'detailed' → full pipeline.
 */
export const volere = {
    id: 'volere',
    name: 'Volere',
    description: 'Robertson Volere template — use-case driven, requirement shells with fit criteria.',
    tier: 'detailed',
    coverSubtitle: 'Requirements Specification',
    requirementModel: 'volere-shell',
    chunks: [
        ['purpose', 'stakeholders', 'constraints', 'namingConventions'],
        ['functionalRequirements'],
        ['nonFunctionalRequirements', 'projectIssues', 'appendices'],
    ],
    sections: [
        {
            id: 'purpose', number: '1', title: 'The Purpose of the Project', kind: 'group',
            guideline: 'The business problem and the goals of the product.',
            fields: [
                { id: 'businessProblem', label: 'The User Business or Background of the Project Effort', kind: 'prose' },
                { id: 'goals', label: 'Goals of the Project', kind: 'list' },
            ],
        },
        {
            id: 'stakeholders', number: '2', title: 'Stakeholders', kind: 'stakeholders',
            guideline: 'The people with an interest in the product and their stake.',
        },
        {
            id: 'constraints', number: '3', title: 'Constraints', kind: 'group',
            guideline: 'Mandated constraints on the solution.',
            fields: [
                { id: 'solutionConstraints', label: 'Solution Constraints', kind: 'list' },
                { id: 'implementationEnvironment', label: 'Implementation Environment', kind: 'prose' },
                { id: 'assumptions', label: 'Assumptions', kind: 'list' },
            ],
        },
        {
            id: 'namingConventions', number: '4', title: 'Naming Conventions and Terminology', kind: 'glossary',
            guideline: 'Glossary and data dictionary of all terms used in the specification.',
        },
        {
            id: 'functionalRequirements', number: '5', title: 'Functional Requirements', kind: 'feature-list',
            requirementModel: 'volere-shell',
            guideline: 'Use-case driven. Each business use case becomes a group; each requirement uses the Volere shell (description, rationale, fit criterion, source).',
        },
        {
            id: 'nonFunctionalRequirements', number: '6', title: 'Non-functional Requirements', kind: 'group',
            guideline: 'Volere NFR taxonomy. Each item is a requirement shell.',
            fields: [
                { id: 'lookAndFeel', label: 'Look and Feel Requirements', kind: 'shell-list' },
                { id: 'usability', label: 'Usability and Humanity Requirements', kind: 'shell-list' },
                { id: 'performance', label: 'Performance Requirements', kind: 'shell-list' },
                { id: 'operational', label: 'Operational and Environmental Requirements', kind: 'shell-list' },
                { id: 'maintainability', label: 'Maintainability and Support Requirements', kind: 'shell-list' },
                { id: 'security', label: 'Security Requirements', kind: 'shell-list' },
                { id: 'cultural', label: 'Cultural and Political Requirements', kind: 'shell-list' },
                { id: 'legal', label: 'Legal Requirements', kind: 'shell-list' },
            ],
        },
        {
            id: 'projectIssues', number: '7', title: 'Project Issues', kind: 'issues',
            guideline: 'Open issues, risks, and off-the-shelf/solution considerations that are not yet resolved.',
        },
        {
            id: 'appendices', number: 'A', title: 'Analysis Models', kind: 'diagrams', appendix: true,
            guideline: 'Structural diagrams; select the most fitting Mermaid type per use case.',
        },
    ],
};
