/**
 * Turn a format descriptor into the prompt's section-by-section guideline block, so the LLM
 * emits JSON keyed EXACTLY by the descriptor's section/field ids. Replaces the hardcoded
 * IEEE-830 guidelines when a non-legacy format is selected.
 */

const requirementModelNote = (model) => {
    if (model === 'volere-shell') {
        return 'Each requirement is a Volere SHELL object: { "description", "rationale" (why it exists), "fitCriterion" (a measurable acceptance test), "source" }. The fitCriterion is mandatory and must be objectively testable.';
    }
    if (model === 'story') {
        return 'Requirements are expressed as user stories, not "the system shall" clauses.';
    }
    return 'Each functional requirement is an atomic "The system shall …" sentence (a plain string).';
};

const KIND_SHAPE = {
    'prose': 'a single prose string',
    'list': 'an array of concise strings',
    'group': 'an object with the fields listed below',
    'feature-list': 'an array of { name, description, stimulusResponseSequences[], functionalRequirements[] }',
    'requirement-group': 'an array of requirement items',
    'user-classes': 'an array of { userClass, characteristics }',
    'stakeholders': 'an array of { role, interest }',
    'personas': 'an array of { name, description, goals[] }',
    'user-stories': 'an array of { role, action, benefit, acceptanceCriteria[] }',
    'issues': 'an array of { issue, type, impact }',
    'glossary': 'an array of { term, definition }',
    'diagrams': 'an object { analysisModels: { flowchartDiagram, sequenceDiagram, entityRelationshipDiagram, additionalDiagrams[] }, tbdList[] }',
};

const FIELD_SHAPE = {
    'prose': 'prose string',
    'list': 'array of strings',
    'shell-list': 'array of Volere shell objects { description, rationale, fitCriterion, source }',
    'user-classes': 'array of { userClass, characteristics }',
};

const sectionLine = (section, model) => {
    const shape = KIND_SHAPE[section.kind] || 'a string';
    let line = `- "${section.id}" (${section.number}. ${section.title}) — ${shape}.`;
    if (section.guideline) line += ` ${section.guideline}`;
    if (section.kind === 'group' && section.fields) {
        const fields = section.fields
            .map((f) => `    • "${f.id}" (${f.label}) — ${FIELD_SHAPE[f.kind] || 'prose string'}${f.guideline ? `: ${f.guideline}` : ''}`)
            .join('\n');
        line += `\n${fields}`;
    }
    if (section.kind === 'feature-list') {
        line += ` ${requirementModelNote(section.requirementModel || model)}`;
    }
    return line;
};

/**
 * @param {object} spec - a format descriptor
 * @param {string[]|null} sectionIds - restrict to a chunk's sections, or null for all
 */
export const buildFormatGuidelines = (spec, sectionIds = null) => {
    const model = spec.requirementModel || 'ieee';
    const sections = sectionIds
        ? spec.sections.filter((s) => sectionIds.includes(s.id))
        : spec.sections;

    const lines = sections.map((s) => sectionLine(s, model)).join('\n');

    return `<format_guidelines format="${spec.name}">
Produce a ${spec.name} document. Return a JSON object whose TOP-LEVEL keys are EXACTLY the
section ids below (plus "projectTitle" and "revisionHistory"). Do not add, rename, or omit keys.

${requirementModelNote(model)}

SECTIONS:
${lines}
</format_guidelines>`;
};
