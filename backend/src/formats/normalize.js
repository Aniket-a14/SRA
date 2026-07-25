import { VERIFICATION_METHODS } from './schemaBuilder.js';

/**
 * Post-generation normalisation for descriptor-driven documents.
 *
 * A schema `description` asking for one of four values is guidance, not enforcement — only
 * Gemini receives the schema at all, and the other providers are steered by prompt alone. Left
 * alone, a requirements table ends up mixing "Test", "testing", "Test/Demo" and "" in the same
 * column, which reads as sloppy in the one place a specification is supposed to be precise.
 */

/** Everything a model plausibly emits, mapped to the canonical method it means. */
const SYNONYMS = {
    inspection: 'Inspection',
    inspect: 'Inspection',
    review: 'Inspection',
    walkthrough: 'Inspection',
    examination: 'Inspection',
    audit: 'Inspection',

    analysis: 'Analysis',
    analyse: 'Analysis',
    analyze: 'Analysis',
    analytical: 'Analysis',
    modelling: 'Analysis',
    modeling: 'Analysis',
    simulation: 'Analysis',
    calculation: 'Analysis',

    demonstration: 'Demonstration',
    demonstrate: 'Demonstration',
    demo: 'Demonstration',
    observation: 'Demonstration',

    test: 'Test',
    testing: 'Test',
    tested: 'Test',
};

/**
 * Resolve a free-text method to one of the canonical four.
 * An unrecognised or absent value becomes "TBD" rather than being coerced to a plausible
 * method — silently labelling an unassigned requirement "Test" would overstate the rigour of
 * the document, and TBD is the convention the rest of the pipeline already uses for a gap.
 */
export const normalizeVerificationMethod = (value) => {
    if (typeof value !== 'string') return 'TBD';

    const cleaned = value.trim();
    if (!cleaned) return 'TBD';

    const exact = VERIFICATION_METHODS.find(m => m.toLowerCase() === cleaned.toLowerCase());
    if (exact) return exact;

    // "Test/Demonstration", "by inspection", "Analysis (modelling)" — take the first token that
    // resolves, which is the primary method in every phrasing of this kind we have seen.
    for (const token of cleaned.toLowerCase().split(/[^a-z]+/).filter(Boolean)) {
        if (SYNONYMS[token]) return SYNONYMS[token];
    }

    return 'TBD';
};

const normalizeRequirementList = (list) => {
    if (!Array.isArray(list)) return list;
    return list.map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
        if (!('verificationMethod' in item)) return item;
        return { ...item, verificationMethod: normalizeVerificationMethod(item.verificationMethod) };
    });
};

/**
 * Walk a generated document and canonicalise every requirement's verification method.
 * Only sections whose requirement model actually carries one are touched, so this is a no-op
 * for IEEE 830, Volere and the Agile PRD.
 */
export const normalizeFormatDoc = (doc, spec) => {
    if (!doc || typeof doc !== 'object' || !spec?.sections) return doc;

    const out = { ...doc };

    for (const section of spec.sections) {
        const model = section.requirementModel || spec.requirementModel;
        if (model !== 'iso-29148') continue;

        const value = out[section.id];
        if (value === undefined || value === null) continue;

        if (section.kind === 'feature-list' && Array.isArray(value)) {
            out[section.id] = value.map(feature => (
                feature && typeof feature === 'object'
                    ? { ...feature, functionalRequirements: normalizeRequirementList(feature.functionalRequirements) }
                    : feature
            ));
        } else if (section.kind === 'requirement-group') {
            out[section.id] = normalizeRequirementList(value);
        }
    }

    return out;
};
