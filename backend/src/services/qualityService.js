import { ALIGNMENT_CHECK_PROMPT } from '../utils/prompts.js';
import { analyzeText } from './aiService.js';
import { asAiSettings } from './providers/providerKeyService.js';
import { OUTPUT_TOKEN_LIMITS, TEMPERATURES } from '../utils/llmGenerationConfig.js';
import { stringifyForPrompt } from '../utils/promptCompaction.js';
import { sanitizePromptLabel, fillTemplate } from '../utils/promptSanitizer.js';
import { ALIGNMENT_CHECK_FAILED } from '../utils/layer3Status.js';

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
        // A check that did not run is not a pass. This used to return ALIGNED, so a provider
        // outage or a malformed reply was reported to the user as a verified alignment.
        logger.warn({ msg: 'Layer 3 alignment check did not complete', error: response?.error });
        return { status: ALIGNMENT_CHECK_FAILED, mismatches: [], reason: response?.error || 'No structured response' };
    }

    return response.srs;
};

import prisma from '../config/prisma.js';
import logger from '../config/logger.js';

const SIX_CS = ['clarity', 'completeness', 'conciseness', 'consistency', 'correctness', 'context'];
const finiteOrNull = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

/**
 * Persist one completed run's 6Cs audit and RAG faithfulness, so quality can be tracked per
 * prompt version and per provider/model over time. Called once per successful analysis.
 *
 * Records only what was measured. The columns are NOT NULL, and this used to fill any
 * missing score with 85 (`Number(x) || 85`, which also turned a real 0 into 85). Now an
 * audit that was skipped or lacks any of the six scores writes no row at all, and a 0 is
 * stored as 0. Best-effort: a failure is logged and never affects the analysis.
 *
 * @returns {Promise<object|null>} the created row, or null when nothing was recorded
 */
export const recordQualityMetric = async ({
    analysisId,
    userId,
    version,
    promptVersion,
    modelProvider,
    modelName,
    audit,
    ragFaithfulness = null
}) => {
    if (!analysisId || !userId || !promptVersion || !modelProvider || !modelName) return null;

    const overallScore = finiteOrNull(audit?.overallScore);
    const scores = Object.fromEntries(SIX_CS.map((dim) => [dim, finiteOrNull(audit?.scores?.[dim])]));
    const missing = SIX_CS.filter((dim) => scores[dim] === null);
    if (!audit || audit.skipped || overallScore === null || missing.length > 0) {
        logger.info({
            msg: 'Quality metric not recorded: audit incomplete',
            analysisId,
            skipped: Boolean(audit?.skipped),
            missing: overallScore === null ? ['overallScore', ...missing] : missing
        });
        return null;
    }

    try {
        return await prisma.qualityMetricRecord.create({
            data: {
                analysisId,
                userId,
                version: Number(version) || 1,
                promptVersion: String(promptVersion),
                modelProvider: String(modelProvider),
                modelName: String(modelName),
                overallScore,
                ...scores,
                ragFaithfulness: finiteOrNull(ragFaithfulness)
            }
        });
    } catch (err) {
        logger.warn({ msg: 'Failed to record quality metric', analysisId, error: err.message });
        return null;
    }
};
