/**
 * SRA-PRO SKELETON CONFIGURATION
 * 
 * Dynamic template configuration loader.
 * Returns the skeleton, sections, sectionInstructions, and rules
 * for the requested template ID.
 */

const { TEMPLATES } = require('./srs_templates.cjs');

/**
 * @param {string} templateId - One of: IEEE_830, ISO_29148, AGILE_USER_STORIES, VOLERE
 * @returns {{ skeleton: object, sections: string[], sectionInstructions: object, rules: object, name: string }}
 */
function getTemplateConfig(templateId) {
    const template = TEMPLATES[templateId];
    if (!template) {
        const available = Object.keys(TEMPLATES).join(', ');
        throw new Error(`Unknown template "${templateId}". Available: ${available}`);
    }

    return {
        name: template.name,
        sections: template.sections,
        skeleton: JSON.parse(JSON.stringify(template.skeleton)), // Deep clone
        sectionInstructions: template.sectionInstructions,
        rules: template.rules
    };
}

/**
 * Returns all available template IDs.
 */
function getAvailableTemplates() {
    return Object.keys(TEMPLATES).map(id => ({
        id,
        name: TEMPLATES[id].name,
        description: TEMPLATES[id].description
    }));
}

module.exports = { getTemplateConfig, getAvailableTemplates };
