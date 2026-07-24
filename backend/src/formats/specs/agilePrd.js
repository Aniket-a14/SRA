/**
 * Agile Product Requirements Document descriptor.
 * Lightweight, stakeholder-facing: vision, personas, epics → user stories with acceptance
 * criteria, flat NFRs, open questions. tier 'light' → single-pass generation, no heavy
 * architecture/reflection/diagram pipeline.
 */
export const agilePrd = {
    id: 'agile-prd',
    name: 'Agile PRD',
    description: 'Lightweight Product Requirements Document with personas and user stories.',
    tier: 'light',
    coverSubtitle: 'Product Requirements Document',
    requirementModel: 'story',
    chunks: [
        ['overview', 'objectives', 'personas', 'userStories', 'nonFunctionalRequirements', 'openQuestions', 'glossary'],
    ],
    sections: [
        {
            id: 'overview', number: '1', title: 'Overview', kind: 'group',
            guideline: 'Product vision and the problem it solves.',
            fields: [
                { id: 'vision', label: 'Vision', kind: 'prose' },
                { id: 'problem', label: 'Problem Statement', kind: 'prose' },
            ],
        },
        {
            id: 'objectives', number: '2', title: 'Goals and Objectives', kind: 'list',
            guideline: 'Measurable product goals and success metrics.',
        },
        {
            id: 'personas', number: '3', title: 'Personas', kind: 'personas',
            guideline: 'Target user personas with their goals.',
        },
        {
            id: 'userStories', number: '4', title: 'User Stories', kind: 'user-stories',
            guideline: 'As a <role>, I want <action>, so that <benefit> — each with acceptance criteria (Given/When/Then).',
        },
        {
            id: 'nonFunctionalRequirements', number: '5', title: 'Non-Functional Requirements', kind: 'list',
            guideline: 'Performance, security, scalability, and quality expectations, stated plainly.',
        },
        {
            id: 'openQuestions', number: '6', title: 'Open Questions', kind: 'list',
            guideline: 'Unresolved product questions and assumptions to validate.',
        },
        {
            id: 'glossary', number: '7', title: 'Glossary', kind: 'glossary',
            guideline: 'Key terms and definitions.',
        },
    ],
};
