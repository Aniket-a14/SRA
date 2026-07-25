import { SchemaType } from '@google/generative-ai';

const STR = { type: SchemaType.STRING };
const STR_ARRAY = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } };

const diagramObject = {
    type: SchemaType.OBJECT,
    properties: { syntaxExplanation: STR, code: STR, caption: STR },
};

const additionalDiagrams = {
    type: SchemaType.ARRAY,
    description: 'AI-selected diagrams: for each key feature/URS, the most fitting Mermaid type.',
    items: {
        type: SchemaType.OBJECT,
        properties: { type: STR, title: STR, appliesTo: STR, code: STR, caption: STR },
        required: ['type', 'title', 'code'],
    },
};

const DIAGRAMS_SCHEMA = {
    type: SchemaType.OBJECT,
    properties: {
        analysisModels: {
            type: SchemaType.OBJECT,
            properties: {
                flowchartDiagram: diagramObject,
                sequenceDiagram: diagramObject,
                entityRelationshipDiagram: diagramObject,
                additionalDiagrams,
            },
        },
        tbdList: STR_ARRAY,
    },
};

/**
 * The verification methods ISO/IEC/IEEE 29148:2018 recognises. Exported because the prompt
 * guideline, the post-generation normaliser and the tests must all agree on the same four.
 */
export const VERIFICATION_METHODS = ['Inspection', 'Analysis', 'Demonstration', 'Test'];

/** A single requirement item, shaped by the format's requirement model. */
const requirementItemSchema = (model) => {
    if (model === 'iso-29148') {
        // 29148 §5.2.8 gives requirements attributes rather than leaving them bare sentences.
        // The text field is named `description` deliberately: it is the key every existing
        // consumer already reads for object-shaped requirements (the frontend's `isShell`
        // guard, the DOCX exporter, and the CLI's reqToString), so this model renders and
        // round-trips without touching any of them.
        return {
            type: SchemaType.OBJECT,
            properties: {
                id: STR,
                description: { type: SchemaType.STRING, description: 'The atomic "The system shall …" requirement statement.' },
                rationale: { type: SchemaType.STRING, description: 'Why this requirement exists — recoverable intent for whoever changes it later.' },
                verificationMethod: {
                    type: SchemaType.STRING,
                    description: `How compliance is confirmed. Exactly one of: ${VERIFICATION_METHODS.join(', ')}.`,
                },
                source: { type: SchemaType.STRING, description: 'The stakeholder need or input statement this derives from.' },
            },
            required: ['description', 'verificationMethod'],
        };
    }
    if (model === 'volere-shell') {
        return {
            type: SchemaType.OBJECT,
            properties: {
                id: STR,
                description: STR,
                rationale: { type: SchemaType.STRING, description: 'Why this requirement exists.' },
                fitCriterion: { type: SchemaType.STRING, description: 'Measurable acceptance test for the requirement.' },
                source: STR,
            },
            required: ['description', 'fitCriterion'],
        };
    }
    // 'ieee' / default → atomic "The system shall…" string.
    return STR;
};

const shellListSchema = () => ({ type: SchemaType.ARRAY, items: requirementItemSchema('volere-shell') });

const featureListSchema = (requirementModel) => ({
    type: SchemaType.ARRAY,
    items: {
        type: SchemaType.OBJECT,
        properties: {
            name: STR,
            description: STR,
            stimulusResponseSequences: STR_ARRAY,
            functionalRequirements: { type: SchemaType.ARRAY, items: requirementItemSchema(requirementModel) },
        },
        required: ['name', 'description', 'functionalRequirements'],
    },
});

const userClassesSchema = {
    type: SchemaType.ARRAY,
    items: { type: SchemaType.OBJECT, properties: { userClass: STR, characteristics: STR } },
};

const stakeholdersSchema = {
    type: SchemaType.ARRAY,
    items: { type: SchemaType.OBJECT, properties: { role: STR, interest: STR } },
};

const personasSchema = {
    type: SchemaType.ARRAY,
    items: { type: SchemaType.OBJECT, properties: { name: STR, description: STR, goals: STR_ARRAY } },
};

const userStoriesSchema = {
    type: SchemaType.ARRAY,
    items: {
        type: SchemaType.OBJECT,
        properties: { id: STR, role: STR, action: STR, benefit: STR, acceptanceCriteria: STR_ARRAY },
        required: ['role', 'action', 'benefit'],
    },
};

const issuesSchema = {
    type: SchemaType.ARRAY,
    items: { type: SchemaType.OBJECT, properties: { issue: STR, type: STR, impact: STR }, required: ['issue'] },
};

const glossarySchema = {
    type: SchemaType.ARRAY,
    items: { type: SchemaType.OBJECT, properties: { term: STR, definition: STR } },
};

const fieldSchema = (field) => {
    switch (field.kind) {
        case 'list': return STR_ARRAY;
        case 'shell-list': return shellListSchema();
        case 'user-classes': return userClassesSchema;
        case 'prose':
        default: return STR;
    }
};

const groupSchema = (section) => {
    const properties = {};
    for (const field of section.fields || []) {
        properties[field.id] = fieldSchema(field);
    }
    return { type: SchemaType.OBJECT, properties };
};

/** Map one section descriptor to its Gemini schema fragment. */
const sectionSchema = (section, spec) => {
    const model = section.requirementModel || spec.requirementModel || 'ieee';
    switch (section.kind) {
        case 'prose': return STR;
        case 'list': return STR_ARRAY;
        case 'group': return groupSchema(section);
        case 'feature-list': return featureListSchema(model);
        case 'requirement-group': return { type: SchemaType.ARRAY, items: requirementItemSchema(model) };
        case 'user-classes': return userClassesSchema;
        case 'stakeholders': return stakeholdersSchema;
        case 'personas': return personasSchema;
        case 'user-stories': return userStoriesSchema;
        case 'issues': return issuesSchema;
        case 'glossary': return glossarySchema;
        case 'diagrams': return DIAGRAMS_SCHEMA;
        default: return STR;
    }
};

/**
 * Build a Gemini responseSchema for a format, optionally restricted to a subset of section
 * ids (used for chunked generation). Always includes projectTitle + revisionHistory.
 *
 * @param {object} spec - a format descriptor
 * @param {string[]|null} sectionIds - restrict to these section ids, or null for all
 */
export const buildFormatSchema = (spec, sectionIds = null) => {
    const properties = {
        projectTitle: STR,
        revisionHistory: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.OBJECT, properties: { version: STR, date: STR, description: STR, author: STR } },
        },
    };
    const required = ['projectTitle'];

    const sections = sectionIds
        ? spec.sections.filter((s) => sectionIds.includes(s.id))
        : spec.sections;

    for (const section of sections) {
        properties[section.id] = sectionSchema(section, spec);
    }

    return {
        type: SchemaType.OBJECT,
        description: `${spec.name} specification document.`,
        properties,
        required,
    };
};
