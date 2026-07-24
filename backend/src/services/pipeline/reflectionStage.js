import logger from '../../config/logger.js';

export const MAX_LOOPS = 2;
export const QUALITY_THRESHOLD = 85;
export const EXCEPTIONAL_SCORE = 98;

/**
 * Pillar 1 — global reflection loop. Each pass runs the Reviewer (approve/reject) and the
 * Critic (6Cs quality score) against the current draft; if the bar isn't met the Developer
 * performs a SURGICAL refinement of only the flagged section (Shell / Features / Requirements /
 * Appendices), chosen by keyword-matching the combined feedback. Max 2 passes. An exceptional
 * Critic score (>= 98) can override a pedantic Reviewer rejection.
 *
 * Extracted verbatim from analysisService.performAnalysis (behavior unchanged) so the loop can
 * be unit-tested in isolation and the orchestrator stays readable.
 *
 * @param {object}   p
 * @param {string}   p.text            - original (sanitized) input text
 * @param {object}   p.poOutput        - Product Owner output
 * @param {object}   p.archOutput      - Architect output
 * @param {string}   p.projectName
 * @param {object}   p.sections        - { srsShell, allFeatures, srsRequirements, srsAppendices, srsDraft }
 * @param {object}   p.agents          - { devAgent, qaAgent, criticAgent }
 * @param {(ms:number)=>Promise<void>} p.sleep - provider-aware cooldown
 * @param {(stage:string,msg:string,extra?:object)=>void} p.emitProgress
 * @param {number}   p.reflectionCooldownMs
 * @returns {Promise<{ srsDraft: object, loopCount: number, finalIndustryAudit: object|null }>}
 */
export async function runReflectionLoop({
    text, poOutput, archOutput, projectName,
    sections, agents, sleep, emitProgress, reflectionCooldownMs
}) {
    let { srsShell, allFeatures, srsRequirements, srsAppendices, srsDraft } = sections;
    const { devAgent, qaAgent, criticAgent } = agents;

    let loopCount = 0;
    let finalIndustryAudit = null;
    let reflectionFeedback = [];

    // Mandatory cooling period before starting the heavy Reflection Loop on Free Tier
    logger.info("    [Pause] Cooling down before Reflection Loop (GCP Quota Safety)...");
    await sleep(reflectionCooldownMs);

    while (loopCount < MAX_LOOPS) {
        logger.info(`--> Pillar 1: Global Reflection Pass ${loopCount + 1}`);
        emitProgress('reflection', `Reviewing quality (pass ${loopCount + 1}/${MAX_LOOPS})...`);

        // A. Reviewer Audit (Security/Consistency)
        const review = await qaAgent.reviewSRS(poOutput, srsDraft);

        // B. Critic Audit (6Cs Quality)
        const audit = await criticAgent.auditSRS(poOutput, srsDraft);
        finalIndustryAudit = audit;

        logger.info(`    Review Status: ${review.status}, Quality Score: ${audit.overallScore}`);

        // C. Check if we meet the quality bar (Case-Insensitive)
        // Intelligent Override: If score is near perfect (98+), allow pass even if Reviewer is stuck in pedantry
        const isApproved = review.status?.toUpperCase() === "APPROVED";
        const isHighQuality = audit.overallScore >= QUALITY_THRESHOLD;
        const isExceptional = audit.overallScore >= EXCEPTIONAL_SCORE;

        if ((isApproved || isExceptional) && isHighQuality) {
            logger.info(`    [OK] Quality threshold met${isExceptional && !isApproved ? " (Exceptional Score Override)" : ""}. Exiting reflection loop.`);
            break;
        }

        // D. Threshold not met: Surgical Refinement
        loopCount++;

        const reason = review.status !== "APPROVED"
            ? `QA Status: ${review.status}`
            : `Quality Score: ${audit.overallScore} < ${QUALITY_THRESHOLD}`;

        logger.info(`    [Refine] ${reason}. Performing surgical refinement...`);
        emitProgress('reflection_refine', `Refining ${reflectionFeedback.length ? 'flagged sections' : 'draft'} (${reason})...`);

        reflectionFeedback = [
            ...review.feedback,
            ...(audit.criticalIssues || []).map(issue => ({ severity: "MAJOR", category: "Quality", issue })),
            ...(audit.suggestions || []).map(suggestion => ({ severity: "MINOR", category: "Quality", issue: suggestion }))
        ];

        const hasAppendicesFeedback = reflectionFeedback.some(f => f.issue.toLowerCase().includes('diagram') || f.issue.toLowerCase().includes('flowchart') || f.issue.toLowerCase().includes('erd'));
        const hasNFRFeedback = reflectionFeedback.some(f => f.issue.toLowerCase().includes('requirement') || f.issue.toLowerCase().includes('security') || f.category === 'Security');
        const hasFeatureFeedback = reflectionFeedback.some(f => f.issue.toLowerCase().includes('feature') || f.issue.toLowerCase().includes('function'));

        let targetSectionName = "Shell";
        let targetDraft = { ...srsShell };

        if (hasAppendicesFeedback) {
            targetSectionName = "Appendices";
            targetDraft = { ...srsAppendices };
        } else if (hasNFRFeedback) {
            targetSectionName = "Requirements";
            targetDraft = { ...srsRequirements };
        } else if (hasFeatureFeedback) {
            targetSectionName = "Features";
            targetDraft = { systemFeatures: allFeatures };
        }

        // SURGICAL REFINEMENT: Developer only touches what's broken
        const refinedSection = await devAgent.refineSRS(
            text,
            poOutput,
            archOutput,
            targetDraft,
            targetSectionName,
            reflectionFeedback,
            { projectName }
        );

        // Re-stitch based on which section was refined
        if (targetSectionName === "Shell") {
            srsDraft = { ...srsDraft, ...refinedSection };
        } else if (targetSectionName === "Features") {
            if (refinedSection.systemFeatures) allFeatures = refinedSection.systemFeatures;
            srsDraft.systemFeatures = allFeatures;
        } else if (targetSectionName === "Requirements") {
            srsDraft = { ...srsDraft, ...refinedSection };
        } else if (targetSectionName === "Appendices") {
            srsDraft = { ...srsDraft, ...refinedSection };
        }
    }

    return { srsDraft, loopCount, finalIndustryAudit };
}
