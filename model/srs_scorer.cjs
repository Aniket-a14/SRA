/**
 * SRA-PRO SRS SCORER (Automated Quality Rubric)
 * 
 * Scores generated SRS output on 4 pillars derived from IEEE quality attributes:
 * 
 * 1. STRUCTURAL COMPLETENESS (0-100)
 *    - Are all expected skeleton keys present and populated?
 *    - Based on IEEE 830 §4.3: "A complete SRS should include all significant requirements"
 * 
 * 2. REQUIREMENT QUALITY (0-100)
 *    - Do requirements use correct prefix ("The system shall")?
 *    - Are they specific (no forbidden vague terms)?
 *    - Are acceptance criteria testable / fit criteria measurable?
 * 
 * 3. QUANTIFICATION DENSITY (0-100)
 *    - Ratio of quantified requirements (containing numbers, units, thresholds)
 *    - Based on IEEE 830 §4.7: "Verifiable requirements can be measured"
 * 
 * 4. CONSISTENCY (0-100)
 *    - Does content reference the correct project name?
 *    - Are there contradictions (e.g., two different response time claims)?
 *    - Does terminology stay uniform?
 * 
 * Final Score = weighted average of the 4 pillars.
 */

const { TEMPLATES, FORBIDDEN_TERMS } = require('./srs_templates.cjs');

/**
 * Scores a complete, generated SRS document.
 * 
 * @param {object} srsDocument - The full SRS JSON (all sections combined)
 * @param {string} templateId - Template used (e.g., "IEEE_830")
 * @param {string} projectName - Original project name
 * @param {string} projectDescription - Original project description
 * @returns {object} Detailed score breakdown
 */
function scoreSRS(srsDocument, templateId, projectName, projectDescription) {
    const template = TEMPLATES[templateId];
    if (!template) {
        return { total: 0, error: `Unknown template: ${templateId}` };
    }

    const structural = scoreStructuralCompleteness(srsDocument, template);
    const quality = scoreRequirementQuality(srsDocument, template);
    const quantification = scoreQuantificationDensity(srsDocument);
    const consistency = scoreConsistency(srsDocument, projectName, projectDescription);

    // Weighted average — structural and quality matter most
    const weights = {
        structural: 0.30,
        quality: 0.30,
        quantification: 0.20,
        consistency: 0.20
    };

    const total = Math.round(
        structural.score * weights.structural +
        quality.score * weights.quality +
        quantification.score * weights.quantification +
        consistency.score * weights.consistency
    );

    return {
        total,
        grade: getGrade(total),
        pillars: {
            structural,
            quality,
            quantification,
            consistency
        },
        weights,
        templateId,
        projectName
    };
}


// ============================================================================
// Pillar 1: Structural Completeness
// ============================================================================

function scoreStructuralCompleteness(srsDocument, template) {
    const details = [];
    let filled = 0;
    let total = 0;

    for (const section of template.sections) {
        const sectionData = srsDocument[section];
        const skel = template.skeleton[section];

        if (!sectionData) {
            details.push(`MISSING section: ${section}`);
            total++;
            continue;
        }

        // Count filled keys vs expected keys
        const result = countFilledKeys(sectionData, skel, section);
        filled += result.filled;
        total += result.total;
        details.push(...result.details);
    }

    const score = total > 0 ? Math.round((filled / total) * 100) : 0;
    return { score, filled, total, details };
}

/**
 * Recursively counts filled vs expected keys.
 */
function countFilledKeys(content, skeleton, path) {
    let filled = 0;
    let total = 0;
    const details = [];

    if (skeleton === null || skeleton === undefined) {
        return { filled: 0, total: 0, details: [] };
    }

    // String skeleton field
    if (typeof skeleton === 'string') {
        total = 1;
        if (typeof content === 'string' && content.trim() !== '' && content.trim() !== 'TBD') {
            filled = 1;
        } else {
            details.push(`EMPTY: ${path}`);
        }
        return { filled, total, details };
    }

    // Boolean skeleton field (e.g., FrontMatter flags)
    if (typeof skeleton === 'boolean') {
        return { filled: 1, total: 1, details: [] };
    }

    // Number skeleton field
    if (typeof skeleton === 'number') {
        total = 1;
        filled = (typeof content === 'number') ? 1 : 0;
        return { filled, total, details };
    }

    // Array skeleton field — check if content array has items
    if (Array.isArray(skeleton)) {
        total = 1;
        if (Array.isArray(content) && content.length > 0) {
            filled = 1;
        } else {
            details.push(`EMPTY array: ${path}`);
        }
        return { filled, total, details };
    }

    // Object skeleton — recurse into keys
    if (typeof skeleton === 'object') {
        for (const key of Object.keys(skeleton)) {
            const childResult = countFilledKeys(
                content ? content[key] : undefined,
                skeleton[key],
                `${path}.${key}`
            );
            filled += childResult.filled;
            total += childResult.total;
            details.push(...childResult.details);
        }
    }

    return { filled, total, details };
}


// ============================================================================
// Pillar 2: Requirement Quality
// ============================================================================

function scoreRequirementQuality(srsDocument, template) {
    const contentStr = JSON.stringify(srsDocument);
    const details = [];
    let deductions = 0;

    // 2a. Prefix compliance
    const prefix = template.rules.requirementPrefix;
    const prefixMatches = (contentStr.match(new RegExp(prefix, 'gi')) || []).length;
    if (prefixMatches === 0) {
        deductions += 30;
        details.push(`No "${prefix}" prefix found anywhere in the document.`);
    } else if (prefixMatches < 5) {
        deductions += 15;
        details.push(`Only ${prefixMatches} uses of "${prefix}" prefix — expected more for a complete SRS.`);
    }

    // 2b. Forbidden terms penalty
    const contentLower = contentStr.toLowerCase();
    const foundForbidden = [];
    for (const term of (template.rules.forbiddenTerms || FORBIDDEN_TERMS)) {
        const count = (contentLower.match(new RegExp(term.toLowerCase(), 'g')) || []).length;
        if (count > 0) {
            foundForbidden.push({ term, count });
        }
    }
    if (foundForbidden.length > 0) {
        const totalVague = foundForbidden.reduce((s, f) => s + f.count, 0);
        deductions += Math.min(30, totalVague * 3); // 3 points per vague term, max 30
        details.push(`Found ${totalVague} vague term occurrences: ${foundForbidden.map(f => `"${f.term}" (${f.count}x)`).join(', ')}`);
    }

    // 2c. Template-specific quality checks
    const templateDeductions = checkTemplateSpecificQuality(srsDocument, template, details);
    deductions += templateDeductions;

    const score = Math.max(0, 100 - deductions);
    return { score, prefixCount: prefixMatches, forbiddenTermsFound: foundForbidden, details };
}

/**
 * Template-specific quality scoring.
 */
function checkTemplateSpecificQuality(srsDocument, template, details) {
    let deductions = 0;

    // Volere: Check fitCriterion presence in requirements
    if (template.name.includes('Volere')) {
        const sectionsToCheck = [
            'Section9_FunctionalRequirements',
            'Section10_LookAndFeel',
            'Section11_Usability',
            'Section12_Performance',
            'Section13_Operational',
            'Section14_Maintainability',
            'Section15_Security',
            'Section16_Cultural',
            'Section17_Legal'
        ];

        let missingFitTotal = 0;
        for (const sectionKey of sectionsToCheck) {
            const reqs = srsDocument[sectionKey];
            if (Array.isArray(reqs)) {
                const missingFit = reqs.filter(r => !r.fitCriterion || r.fitCriterion.trim() === '');
                missingFitTotal += missingFit.length;
            }
        }

        if (missingFitTotal > 0) {
            deductions += Math.min(20, missingFitTotal * 5);
            details.push(`${missingFitTotal} Volere requirements missing fitCriterion across all sections.`);
        }
    }

    // Agile: Check Connextra format and Given/When/Then
    if (template.name.includes('Agile')) {
        const backlog = srsDocument.featureBacklog;
        if (Array.isArray(backlog)) {
            let storiesWithoutFormat = 0;
            let storiesWithoutAC = 0;
            for (const epic of backlog) {
                for (const story of (epic.userStories || [])) {
                    if (!story.story || !story.story.toLowerCase().startsWith('as a')) {
                        storiesWithoutFormat++;
                    }
                    if (!Array.isArray(story.acceptanceCriteria) || story.acceptanceCriteria.length === 0) {
                        storiesWithoutAC++;
                    }
                }
            }
            if (storiesWithoutFormat > 0) {
                deductions += Math.min(15, storiesWithoutFormat * 3);
                details.push(`${storiesWithoutFormat} stories not using Connextra format.`);
            }
            if (storiesWithoutAC > 0) {
                deductions += Math.min(15, storiesWithoutAC * 3);
                details.push(`${storiesWithoutAC} stories missing acceptance criteria.`);
            }
        }
    }

    // IEEE 830: Check SystemFeatures have all sub-fields
    if (template.name.includes('830')) {
        const features = srsDocument.SystemFeatures;
        if (Array.isArray(features)) {
            let incompleteFeatures = 0;
            for (const f of features) {
                if (!f.featureName || !f.descriptionAndPriority || !Array.isArray(f.functionalRequirements) || f.functionalRequirements.length === 0) {
                    incompleteFeatures++;
                }
            }
            if (incompleteFeatures > 0) {
                deductions += Math.min(20, incompleteFeatures * 5);
                details.push(`${incompleteFeatures} SystemFeatures incomplete (missing featureName, priority, or requirements).`);
            }
        }
    }

    return deductions;
}


// ============================================================================
// Pillar 3: Quantification Density
// ============================================================================

function scoreQuantificationDensity(srsDocument) {
    const contentStr = JSON.stringify(srsDocument);
    const details = [];

    // Count quantified values: numbers with units
    const quantifiedPattern = /\d+(\.\d+)?\s*(ms|s|sec|seconds|minutes|min|hours|hrs|%|percent|MB|GB|TB|KB|users|concurrent|requests|req\/s|tps|ops\/s|bits|bytes|Mbps|Gbps|px|dpi)/gi;
    const quantifiedMatches = contentStr.match(quantifiedPattern) || [];

    // Count raw numbers (less precise but still quantified)
    const numberPattern = /\b\d{2,}\b/g;
    const numberMatches = contentStr.match(numberPattern) || [];

    // Count comparison operators with numbers (e.g., "< 200ms", "> 99.9%")
    const comparisonPattern = /[<>≤≥]=?\s*\d+/g;
    const comparisonMatches = contentStr.match(comparisonPattern) || [];

    const totalQuantified = quantifiedMatches.length + comparisonMatches.length;
    const wordCount = contentStr.split(/\s+/).length;
    const density = wordCount > 0 ? (totalQuantified / wordCount) * 1000 : 0; // per 1000 words

    // Scoring: 10+ quantified values per 1000 words = 100, 0 = 0
    let score;
    if (density >= 10) score = 100;
    else if (density >= 7) score = 90;
    else if (density >= 5) score = 75;
    else if (density >= 3) score = 60;
    else if (density >= 1) score = 40;
    else score = 10;

    details.push(`${totalQuantified} quantified values found (${quantifiedMatches.length} with units, ${comparisonMatches.length} with comparisons)`);
    details.push(`Density: ${density.toFixed(1)} per 1000 words (word count: ${wordCount})`);

    if (totalQuantified < 5) {
        details.push('LOW: Very few quantified metrics. Requirements may not be verifiable.');
    }

    return { score, quantifiedCount: totalQuantified, density: parseFloat(density.toFixed(1)), wordCount, details };
}


// ============================================================================
// Pillar 4: Consistency
// ============================================================================

function scoreConsistency(srsDocument, projectName, projectDescription) {
    const contentStr = JSON.stringify(srsDocument);
    const contentLower = contentStr.toLowerCase();
    const details = [];
    let deductions = 0;

    // 4a. Project name presence
    const projectNameLower = projectName.toLowerCase();
    const nameCount = (contentLower.match(new RegExp(projectNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (nameCount === 0) {
        deductions += 20;
        details.push(`Project name "${projectName}" not found in the document.`);
    } else if (nameCount < 3) {
        deductions += 5;
        details.push(`Project name "${projectName}" appears only ${nameCount} time(s) — may lack contextual consistency.`);
    }

    // 4b. Contradictory numbers (simple heuristic)
    // Look for the same metric being defined with different values
    const responseTimeMatches = contentStr.match(/(\d+(\.\d+)?)\s*ms/g) || [];
    const uptimeMatches = contentStr.match(/(\d+(\.\d+)?)\s*%/g) || [];

    // Flag if same metric type has very different values (potential contradiction)
    if (responseTimeMatches.length > 1) {
        const values = responseTimeMatches.map(m => parseFloat(m));
        const max = Math.max(...values);
        const min = Math.min(...values);
        if (max > 0 && min > 0 && max / min > 100) {
            deductions += 10;
            details.push(`Possible response time contradiction: values range from ${min}ms to ${max}ms (100x spread).`);
        }
    }

    // 4c. Section cross-referencing: scope should align with functions
    // This is a lightweight heuristic check
    const descriptionWords = projectDescription.toLowerCase().split(/\s+/).filter(w => w.length > 5);
    const contextOverlap = descriptionWords.filter(w => contentLower.includes(w));
    const overlapRatio = descriptionWords.length > 0 ? contextOverlap.length / descriptionWords.length : 0;
    if (overlapRatio < 0.3) {
        deductions += 15;
        details.push(`Low terminology overlap with project description (${Math.round(overlapRatio * 100)}%). Content may not align with the original scope.`);
    }

    const score = Math.max(0, 100 - deductions);
    return { score, projectNameOccurrences: nameCount, descriptionOverlap: Math.round(overlapRatio * 100), details };
}


// ============================================================================
// Grading
// ============================================================================

function getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
}


module.exports = { scoreSRS };
