
/**
 * Lints requirements to calculate a quality score and identify issues.
 * @param {Object} analysisJson - The JSON output from the AI analysis.
 * @returns {Object} { score: number, issues: string[] }
 */
export const lintRequirements = (analysis) => {
    let score = 100;
    const issues = [];
    const deductions = []; // To track what we gathered

    // Config: Deduction points
    const POINTS_AMBIGUITY = 5;
    const POINTS_NOT_MEASURABLE = 10;
    const POINTS_MISSING_FEATURE = 15;
    const POINTS_INCOMPLETE = 10;

    // 1. Ambiguity Check
    // Words to avoid: fast, easy, user-friendly, robust, scalable, seamless, efficient
    const ambiguousWords = ['fast', 'easy', 'user-friendly', 'robust', 'scalable', 'seamless', 'efficient', 'quickly', 'simple'];
    const ambiguityRegex = new RegExp(`\\b(${ambiguousWords.join('|')})\\b`, 'gi');

    // Check Functional Requirements
    if (analysis.functionalRequirements) {
        analysis.functionalRequirements.forEach((req, idx) => {
            const matches = req.match(ambiguityRegex);
            if (matches) {
                issues.push(`Ambiguity in FR #${idx + 1}: Avoid words like "${matches[0]}". Be specific.`);
                score -= POINTS_AMBIGUITY;
            }
        });
    }

    // Check User Stories
    if (analysis.userStories) {
        analysis.userStories.forEach((story, idx) => {
            // Check Feature Mapping
            if (!story.feature || story.feature.trim() === "") {
                issues.push(`User Story #${idx + 1} is missing a mapped Feature.`);
                score -= POINTS_MISSING_FEATURE;
            }

            // Ambiguity in Benefit
            if (story.benefit && story.benefit.match(ambiguityRegex)) {
                const matches = story.benefit.match(ambiguityRegex);
                issues.push(`Ambiguity in User Story #${idx + 1} Benefit: Avoid "${matches[0]}".`);
                score -= POINTS_AMBIGUITY;
            }
        });
    }

    // 2. Measurability Check (Non-Functional Requirements)
    // Should contain numbers or units
    if (analysis.nonFunctionalRequirements) {
        const measureRegex = /\d+|%|ms|seconds|minutes|hours|concurrent|uptime/i;
        analysis.nonFunctionalRequirements.forEach((req, idx) => {
            if (!measureRegex.test(req)) {
                issues.push(`NFR #${idx + 1} is not measurable. Add metrics (e.g., "load < 200ms", "99.9% uptime").`);
                score -= POINTS_NOT_MEASURABLE;
            }
        });
    }

    // 3. Completeness (Acceptance Criteria)
    if (analysis.acceptanceCriteria) {
        if (analysis.acceptanceCriteria.length === 0 && analysis.userStories.length > 0) {
            issues.push("Missing Acceptance Criteria for User Stories.");
            score -= 20;
        }
        analysis.acceptanceCriteria.forEach((ac, idx) => {
            if (!ac.criteria || ac.criteria.length === 0) {
                issues.push(`Acceptance Criteria for "${ac.story}" is empty.`);
                score -= POINTS_INCOMPLETE;
            }
        });
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    return { score, issues };
};
