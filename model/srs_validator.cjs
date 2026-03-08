/**
 * SRA-PRO VALIDATOR (Industry-Grade)
 * 
 * Two-tier validation mirroring the backend pipeline:
 * 
 * Layer 2 (Gate): Schema validation, required keys, prefix checks,
 *                 ambiguity audit, quantification enforcement.
 * 
 * Layer 3 (Alignment): Cross-checks generated content against
 *                      project name/description for hallucination detection.
 */

const { TEMPLATES, FORBIDDEN_TERMS } = require('./srs_templates.cjs');

/**
 * Layer 2: Validates a generated SRS section against template rules.
 * 
 * @param {string} section - Section key (e.g., "introduction")
 * @param {object} content - The generated JSON content for this section
 * @param {string} templateId - Template ID (e.g., "IEEE_830")
 * @returns {{ success: boolean, errors: string[], warnings: string[] }}
 */
function validateSection(section, content, templateId) {
    const template = TEMPLATES[templateId];
    if (!template) return { success: false, errors: [`Unknown template: ${templateId}`], warnings: [] };

    const errors = [];
    const warnings = [];

    // 1. Null/undefined check
    if (!content || typeof content !== 'object') {
        return { success: false, errors: [`Section "${section}" is null or not an object.`], warnings: [] };
    }

    // 2. Required keys check (from skeleton)
    const expectedKeys = getExpectedKeys(section, template);
    if (expectedKeys.length > 0) {
        const contentKeys = Object.keys(content);
        const missingKeys = expectedKeys.filter(k => !contentKeys.includes(k));
        for (const key of missingKeys) {
            errors.push(`Missing required key "${key}" in "${section}".`);
        }
    }

    // 3. Empty value check
    checkEmptyValues(content, section, errors, warnings);

    // 4. Requirement prefix check
    if (template.rules.requirementPrefix) {
        checkRequirementPrefix(content, template.rules.requirementPrefix, section, templateId, warnings);
    }

    // 5. Quantification check (for sections that require it)
    if (template.rules.requiresQuantification.includes(section)) {
        checkQuantification(content, section, warnings);
    }

    // 6. Forbidden terms audit
    checkForbiddenTerms(content, template.rules.forbiddenTerms, section, warnings);

    // 7. Template-specific validation
    runTemplateSpecificValidation(section, content, templateId, errors, warnings);

    // 8. Mermaid syntax check (if applicable)
    checkMermaidSyntax(content, section, warnings);

    return {
        success: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Layer 3: Alignment check — ensures content matches the project context.
 * 
 * @param {string} section - Section key
 * @param {object} content - Generated content
 * @param {string} projectName - Original project name
 * @param {string} projectDescription - Original project description
 * @returns {{ aligned: boolean, mismatches: string[] }}
 */
function checkAlignment(section, content, projectName, projectDescription) {
    const mismatches = [];
    const contentStr = JSON.stringify(content).toLowerCase();
    const projectNameLower = projectName.toLowerCase();

    // 1. Name alignment: Check if the content refers to the correct project
    // Only flag if a DIFFERENT project name appears to be referenced
    const genericNames = ['project', 'system', 'application', 'product', 'software', 'platform'];
    if (projectNameLower.length > 3 && !genericNames.includes(projectNameLower)) {
        // Extract capitalized multi-word names from content that might be other project names
        const possibleNames = contentStr.match(/[A-Z][a-zA-Z]+\s[A-Z][a-zA-Z]+/g) || [];
        for (const name of possibleNames) {
            if (!projectNameLower.includes(name.toLowerCase()) && !genericNames.some(g => name.toLowerCase().includes(g))) {
                // Only flag if it looks like a specific product name
                if (name.length > 5 && !contentStr.includes(projectNameLower)) {
                    mismatches.push(`Possible identity mismatch: Content may reference "${name}" instead of "${projectName}".`);
                    break;
                }
            }
        }
    }

    return {
        aligned: mismatches.length === 0,
        mismatches
    };
}


// ============================================================================
// Internal Validation Helpers
// ============================================================================

/**
 * Gets expected top-level keys for a section from the template skeleton.
 */
function getExpectedKeys(section, template) {
    const skel = template.skeleton[section];
    if (!skel) return [];
    if (Array.isArray(skel)) return []; // Array sections don't have fixed keys
    return Object.keys(skel);
}

/**
 * Recursively checks for empty strings and empty arrays in content.
 */
function checkEmptyValues(obj, path, errors, warnings) {
    if (typeof obj === 'string') {
        if (obj.trim() === '') {
            warnings.push(`Empty value at "${path}".`);
        }
        return;
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            warnings.push(`Empty array at "${path}".`);
        }
        return;
    }
    if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
            checkEmptyValues(value, `${path}.${key}`, errors, warnings);
        }
    }
}

/**
 * Checks that functional requirements use the expected prefix.
 */
function checkRequirementPrefix(content, prefix, section, templateId, warnings) {
    const contentStr = JSON.stringify(content);

    // Only check in relevant sections
    const requirementSections = {
        'IEEE_830': ['specificRequirements'],
        'ISO_29148': ['functionalRequirements'],
        'AGILE_USER_STORIES': ['featureBacklog'],
        'VOLERE': ['functionalRequirements']
    };

    const relevantSections = requirementSections[templateId] || [];
    if (!relevantSections.includes(section)) return;

    // Count occurrences of the prefix
    const prefixCount = (contentStr.match(new RegExp(prefix, 'gi')) || []).length;
    if (prefixCount === 0) {
        warnings.push(`No requirements found using the "${prefix}" prefix in "${section}". All requirements should use this prefix.`);
    }
}

/**
 * Checks for quantified metrics in sections that require them.
 */
function checkQuantification(content, section, warnings) {
    const contentStr = JSON.stringify(content);
    // Look for numeric values — a basic heuristic
    const hasNumbers = /\d+(\.\d+)?(%|ms|s|min|hr|MB|GB|TB|users|req\/s)/i.test(contentStr);
    if (!hasNumbers) {
        warnings.push(`Section "${section}" should contain quantified metrics (e.g., "< 200ms", "99.9% uptime", "1000 concurrent users") but none were found.`);
    }
}

/**
 * Audits content for forbidden vague terms.
 */
function checkForbiddenTerms(content, forbiddenTerms, section, warnings) {
    const contentStr = JSON.stringify(content).toLowerCase();
    const found = [];

    for (const term of (forbiddenTerms || FORBIDDEN_TERMS)) {
        if (contentStr.includes(term.toLowerCase())) {
            found.push(term);
        }
    }

    if (found.length > 0) {
        warnings.push(`Section "${section}" contains vague/forbidden terms: [${found.join(', ')}]. Replace with quantified metrics.`);
    }
}

/**
 * Template-specific validation rules.
 */
function runTemplateSpecificValidation(section, content, templateId, errors, warnings) {
    switch (templateId) {
        case 'VOLERE':
            validateVolereRequirements(section, content, errors, warnings);
            break;
        case 'AGILE_USER_STORIES':
            validateAgileStories(section, content, errors, warnings);
            break;
        case 'ISO_29148':
            validateISO29148(section, content, errors, warnings);
            break;
        default:
            break;
    }
}

/**
 * Volere: Each requirement must have a Requirement Shell with fitCriterion.
 */
function validateVolereRequirements(section, content, errors, warnings) {
    if (section !== 'functionalRequirements' && section !== 'nonFunctionalRequirements') return;

    const requirements = extractVolereRequirements(section, content);
    for (const req of requirements) {
        if (!req.description || req.description.trim() === '') {
            errors.push(`Volere requirement ${req.requirementId || '?'} missing description.`);
        }
        if (!req.fitCriterion || req.fitCriterion.trim() === '') {
            errors.push(`Volere requirement ${req.requirementId || '?'} missing fitCriterion. Every requirement MUST have a measurable Fit Criterion.`);
        }
        if (!req.rationale || req.rationale.trim() === '') {
            warnings.push(`Volere requirement ${req.requirementId || '?'} missing rationale.`);
        }
    }
}

/**
 * Extracts all Volere requirement objects from a section.
 */
function extractVolereRequirements(section, content) {
    if (section === 'functionalRequirements' && content.requirements) {
        return Array.isArray(content.requirements) ? content.requirements : [];
    }
    if (section === 'nonFunctionalRequirements') {
        // NFRs are organized by category, each is an array of requirement objects
        const all = [];
        for (const category of Object.values(content)) {
            if (Array.isArray(category)) {
                all.push(...category);
            }
        }
        return all;
    }
    return [];
}

/**
 * Agile: Each story must have role/goal/benefit and acceptance criteria.
 */
function validateAgileStories(section, content, errors, warnings) {
    if (section !== 'featureBacklog') return;
    if (!Array.isArray(content)) return;

    for (const epic of content) {
        if (!epic.epic || epic.epic.trim() === '') {
            errors.push('Agile epic missing name.');
        }
        if (!Array.isArray(epic.userStories) || epic.userStories.length === 0) {
            errors.push(`Epic "${epic.epic || '?'}" has no user stories.`);
            continue;
        }
        for (const story of epic.userStories) {
            // Check Connextra format
            if (!story.story || !story.story.toLowerCase().startsWith('as a')) {
                errors.push(`User story "${(story.story || '').substring(0, 40)}..." does not follow Connextra format ("As a [role], I want [goal] so that [benefit]").`);
            }
            // Check acceptance criteria use Given/When/Then
            if (!Array.isArray(story.acceptanceCriteria) || story.acceptanceCriteria.length === 0) {
                errors.push(`User story "${(story.story || '').substring(0, 40)}..." missing acceptance criteria.`);
            } else {
                for (const ac of story.acceptanceCriteria) {
                    if (!ac.given || !ac.when || !ac.then) {
                        warnings.push(`Acceptance criterion in story "${(story.story || '').substring(0, 40)}..." missing Given/When/Then fields.`);
                    }
                }
            }
        }
    }
}

/**
 * ISO 29148: Functional requirements must have traceability.
 */
function validateISO29148(section, content, errors, warnings) {
    if (section !== 'functionalRequirements') return;
    if (!Array.isArray(content)) return;

    for (const req of content) {
        if (!req.traceability || req.traceability.trim() === '') {
            warnings.push(`ISO 29148 requirement "${req.featureName || '?'}" missing traceability link.`);
        }
        if (!req.priority || req.priority.trim() === '') {
            warnings.push(`ISO 29148 requirement "${req.featureName || '?'}" missing priority.`);
        }
    }
}

/**
 * Basic Mermaid syntax validation for diagram sections.
 */
function checkMermaidSyntax(content, section, warnings) {
    const contentStr = JSON.stringify(content);
    // Look for common Mermaid keywords
    const mermaidKeywords = ['graph ', 'flowchart ', 'sequenceDiagram', 'erDiagram', 'classDiagram', 'stateDiagram'];
    const hasMermaid = mermaidKeywords.some(kw => contentStr.includes(kw));

    if (!hasMermaid) return; // No diagrams to validate

    // Check for common Mermaid errors
    if (contentStr.includes('```mermaid')) {
        warnings.push(`Section "${section}" contains markdown code fences around Mermaid code. The "code" field should contain raw Mermaid syntax only, without fences.`);
    }
}

module.exports = { validateSection, checkAlignment };
