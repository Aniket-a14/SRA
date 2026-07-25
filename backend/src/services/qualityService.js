import { ALIGNMENT_CHECK_PROMPT } from '../utils/prompts.js';
import { analyzeText } from './aiService.js';
import { asAiSettings } from './providers/providerKeyService.js';
import { OUTPUT_TOKEN_LIMITS, TEMPERATURES } from '../utils/llmGenerationConfig.js';
import { stringifyForPrompt } from '../utils/promptCompaction.js';
import { sanitizePromptLabel, fillTemplate } from '../utils/promptSanitizer.js';

/**
 * Lints requirements to calculate a quality score and identify issues.
 * @param {Object} semanticAudit - Optional semantic audit result from Pillar 4 Critic.
 * @returns {Object} { score: number, issues: string[], ieeeCompliance: object }
 */
export const lintRequirements = (analysis, semanticAudit = null) => {
    let score = 100;
    const issues = [];

    if (semanticAudit) {
        // overallScore is already 0-100 (not 0-1). No multiplication needed.
        score = Math.round(semanticAudit.overallScore);
        if (semanticAudit.criticalIssues) {
            issues.push(...semanticAudit.criticalIssues.map(i => `[CRITICAL] ${i}`));
        }
        return {
            score,
            issues,
            ieeeCompliance: semanticAudit.ieeeCompliance || { status: "UNKNOWN" }
        };
    }

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

/** Layer-3 alignment check. Runs on the user's own key (`providerConfig`). */
export const checkAlignment = async (originalInput, validationContext, srsOutput, providerConfig) => {
    // Construct task-specific prompt (system prompt).
    //
    // Only short, sanitized labels are interpolated here. The raw stakeholder text used to be
    // templated in as `{{rawInput}}`, which handed anything the user typed system-level
    // authority — it now travels in the user turn below, where it is data rather than
    // instruction (the same split the SRS content already used).
    let systemPrompt = ALIGNMENT_CHECK_PROMPT;
    for (const [token, value] of [
        ['{{projectName}}', sanitizePromptLabel(originalInput.projectName) || "Unknown"],
        ['{{domain}}', sanitizePromptLabel(validationContext.domain) || "General Software"],
        ['{{purpose}}', sanitizePromptLabel(validationContext.purpose) || "Not Specified"],
        ['{{srsContent}}', 'The generated SRS content is provided in the user input.'],
    ]) {
        systemPrompt = fillTemplate(systemPrompt, token, value);
    }

    // Pass the raw input as the message text
    const text = "LAYER 1 RAW INPUT:\n" +
        (originalInput.rawText || "N/A").slice(0, 5000) +
        "\n\nSRS CONTENT FOR VERIFICATION:\n" +
        stringifyForPrompt(srsOutput, 15000);

    // Call AI
    const response = await analyzeText(text, {
        ...asAiSettings(providerConfig),
        systemPrompt: systemPrompt,
        temperature: TEMPERATURES.logic,
        maxOutputTokens: OUTPUT_TOKEN_LIMITS.smallJson
    });

    if (!response || response.success === false || !response.srs) {
        // Fallback if AI fails to return structure
        console.warn("Layer 3 Alignment Check failed:", response?.error);
        return { status: 'ALIGNED', mismatches: [] };
    }

    return response.srs;
};

/**
 * Pillar 4: Semantic LLM-Judge Audit
 * Integrates the CriticAgent's deep audit into the quality scoring system.
 */
export const runSemanticAudit = async (srsContent, originalRequirements = null) => {
    const { CriticAgent } = await import('../agents/CriticAgent.js');
    const critic = new CriticAgent();
    // auditSRS takes (originalRequirements, srsContent); this used to pass the SRS in the first
    // position, leaving the document itself undefined so the audit scored an empty snapshot.
    return await critic.auditSRS(originalRequirements, srsContent);
};
