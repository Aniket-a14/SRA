/**
 * HARDENED SRS SECTION VALIDATOR
 * Focuses on semantic quality, ambiguity reduction, and structural integrity.
 */

const AMBIGUOUS_PHRASES = [
    "including but not limited to",
    "as appropriate",
    "as required",
    "to be determined",
    "tbd",
    "various",
    "multiple",
    "seamless",
    "easy for the user",
    "robust",
    "user-friendly",
    "efficient",
    "optimal",
    "reliable",
    "flexible",
    "powerful",
    "high-performance",
    "state-of-the-art"
];

const REQUIRED_KEYS = {
    introduction: ["purpose", "documentConventions", "intendedAudience", "productScope", "references"],
    overallDescription: ["productPerspective", "productFunctions", "userClassesAndCharacteristics", "operatingEnvironment"],
    externalInterfaceRequirements: ["userInterfaces", "hardwareInterfaces", "softwareInterfaces", "communicationsInterfaces"],
    systemFeatures: ["name", "description", "functionalRequirements"],
    nonFunctionalRequirements: ["performanceRequirements", "safetyRequirements", "securityRequirements"],
    appendices: ["analysisModels", "tbdList"]
};

/**
 * Validates a generated SRS section.
 * @param {string} sectionName 
 * @param {object} content 
 * @returns {object} { success: boolean, errors: Array }
 */
function validateSection(sectionName, content) {
    const errors = [];

    // 1. Structural Integrity
    if (typeof content !== 'object' || content === null) {
        errors.push(`${sectionName} content is not a valid JSON object.`);
        return { success: false, errors };
    }

    const keys = sectionName === "systemFeatures" ? REQUIRED_KEYS.systemFeatures : REQUIRED_KEYS[sectionName];
    if (keys) {
        if (sectionName === "systemFeatures" && Array.isArray(content)) {
            content.forEach((feature, i) => {
                keys.forEach(k => {
                    if (!feature[k]) errors.push(`Feature [${i}] "${feature.name || 'unnamed'}" missing key: ${k}`);
                });
            });
        } else if (sectionName !== "systemFeatures") {
            keys.forEach(k => {
                if (!content[k]) errors.push(`${sectionName} missing key: ${k}`);
            });
        }
    }

    // 2. Requirement Quality: "The system shall"
    if (sectionName === "systemFeatures" && Array.isArray(content)) {
        content.forEach((feature, fIdx) => {
            if (feature.functionalRequirements && Array.isArray(feature.functionalRequirements)) {
                feature.functionalRequirements.forEach((req, rIdx) => {
                    if (!req.trim().toLowerCase().startsWith("the system shall")) {
                        errors.push(`Requirement Rule Violation (Feature ${fIdx}, Req ${rIdx}): Requirement must start with "The system shall".`);
                    }
                });
            }
        });
    }

    // 3. Quantification Check (Performance)
    if (sectionName === "nonFunctionalRequirements") {
        const perf = content.performanceRequirements;
        if (Array.isArray(perf)) {
            perf.forEach((p, i) => {
                // Look for numbers (quantification)
                if (!/\d+/.test(p)) {
                    errors.push(`Quantification Violation (Performance Req ${i}): Requirement lacks measurable metrics (numbers). Found: "${p}"`);
                }
            });
        }
    }

    // 4. Ambiguity Audit
    const contentStr = JSON.stringify(content).toLowerCase();
    AMBIGUOUS_PHRASES.forEach(phrase => {
        // Regex for word/phrase boundary
        const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedPhrase}\\b`, 'i');
        if (regex.test(contentStr)) {
            errors.push(`Ambiguity Violation: Found forbidden term "${phrase}". Use specific, verifiable language.`);
        }
    });

    // 5. Mermaid Syntax Validation (Appendices)
    if (sectionName === "appendices" && content.analysisModels) {
        const models = content.analysisModels;
        const diagramTypes = ["flowchartDiagram", "sequenceDiagram", "entityRelationshipDiagram"];

        diagramTypes.forEach(type => {
            const diagram = models[type];
            if (diagram && diagram.code) {
                const code = diagram.code.trim();
                const firstLine = code.split('\n')[0].toLowerCase();

                if (type === "flowchartDiagram" && !firstLine.includes("graph") && !firstLine.includes("flowchart")) {
                    errors.push(`Mermaid Error (${type}): Flowchart must start with "graph" or "flowchart". Found: "${firstLine}"`);
                }
                if (type === "sequenceDiagram" && !firstLine.includes("sequencediagram")) {
                    errors.push(`Mermaid Error (${type}): Sequence diagram must start with "sequenceDiagram".`);
                }
                if (type === "entityRelationshipDiagram" && !firstLine.includes("erdiagram")) {
                    errors.push(`Mermaid Error (${type}): ER diagram must start with "erDiagram".`);
                }

                // Basic check for unclosed brackets or common syntax fails
                if ((code.match(/\{/g) || []).length !== (code.match(/\}/g) || []).length) {
                    errors.push(`Mermaid Error (${type}): Unbalanced curly braces detected.`);
                }
            }
        });
    }

    return {
        success: errors.length === 0,
        errors
    };
}

module.exports = { validateSection };
