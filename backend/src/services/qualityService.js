
/**
 * Lints requirements to calculate a quality score and identify issues.
 * @param {Object} analysis - The JSON output from the AI analysis.
 * @returns {Object} { score: number, issues: string[] }
 */
export const lintRequirements = (analysis) => {
    let score = 100;
    const issues = [];

    // Config: Deduction points
    const POINTS_AMBIGUITY = 5;
    const POINTS_NOT_MEASURABLE = 10;
    const POINTS_MISSING_FIELD = 15;
    const POINTS_EMPTY_SECTION = 20;

    // 1. Ambiguity Check
    // Words to avoid: fast, easy, user-friendly, robust, scalable, seamless, efficient
    const ambiguousWords = ['fast', 'easy', 'user-friendly', 'robust', 'scalable', 'seamless', 'efficient', 'quickly', 'simple', 'minimal'];
    const ambiguityRegex = new RegExp(`\\b(${ambiguousWords.join('|')})\\b`, 'gi');

    const checkAmbiguity = (text, location) => {
        if (!text) return;
        const matches = text.match(ambiguityRegex);
        if (matches) {
            // Deduplicate matches
            const uniqueMatches = [...new Set(matches.map(m => m.toLowerCase()))];
            issues.push(`Ambiguity in ${location}: Avoid words like "${uniqueMatches.join(', ')}". Be specific.`);
            score -= POINTS_AMBIGUITY;
        }
    };

    // 2. Validate Introduction & Overall Description
    if (!analysis.introduction || !analysis.introduction.purpose) {
        issues.push("Introduction: Purpose is missing.");
        score -= POINTS_MISSING_FIELD;
    }
    if (!analysis.overallDescription || !analysis.overallDescription.productFunctions || analysis.overallDescription.productFunctions.length === 0) {
        issues.push("Overall Description: Product Functions are missing.");
        score -= POINTS_MISSING_FIELD;
    }

    // 3. Validate System Features (Functional Requirements)
    if (analysis.systemFeatures && Array.isArray(analysis.systemFeatures)) {
        if (analysis.systemFeatures.length === 0) {
            issues.push("System Features: No features identified.");
            score -= POINTS_EMPTY_SECTION;
        }

        analysis.systemFeatures.forEach((feature, idx) => {
            const featureName = feature.name || `Feature #${idx + 1}`;

            // Check Description Ambiguity
            checkAmbiguity(feature.description, `${featureName} Description`);

            // Check Functional Requirements
            if (!feature.functionalRequirements || feature.functionalRequirements.length === 0) {
                issues.push(`${featureName}: No functional requirements listed.`);
                score -= POINTS_MISSING_FIELD;
            } else {
                feature.functionalRequirements.forEach((req, rIdx) => {
                    checkAmbiguity(req, `${featureName} FR #${rIdx + 1}`);
                });
            }
        });
    } else {
        issues.push("System Features section is missing or invalid.");
        score -= POINTS_EMPTY_SECTION;
    }

    // 4. Validate Non-Functional Requirements (Measurability)
    if (analysis.nonFunctionalRequirements) {
        const nfrs = analysis.nonFunctionalRequirements;
        const measureRegex = /\d+|%|ms|seconds|minutes|hours|concurrent|uptime|response time/i;

        // Helper to check NFR category
        const checkNfrCategory = (categoryName, requirements) => {
            if (!requirements) return;
            requirements.forEach((req, idx) => {
                if (!measureRegex.test(req)) {
                    // Only penalize strict measurability for Performance. 
                    // Security/Safety might be policy-based.
                    if (categoryName === 'Performance') {
                        issues.push(`NFR (${categoryName}) #${idx + 1} is not measurable. Add metrics (e.g., "load < 200ms").`);
                        score -= POINTS_NOT_MEASURABLE;
                    }
                }
                checkAmbiguity(req, `NFR (${categoryName}) #${idx + 1}`);
            });
        };

        checkNfrCategory('Performance', nfrs.performanceRequirements);
        checkNfrCategory('Safety', nfrs.safetyRequirements);
        checkNfrCategory('Security', nfrs.securityRequirements);
        checkNfrCategory('Quality', nfrs.softwareQualityAttributes);
    }

    // 5. External Interfaces
    if (analysis.externalInterfaceRequirements) {
        const eir = analysis.externalInterfaceRequirements;
        if (!eir.userInterfaces && !eir.softwareInterfaces) {
            // Not critical, but worth noting
        }
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    return { score, issues };
};
