import logger from '../../config/logger.js';

export const MAX_LOOPS = 2;
export const QUALITY_THRESHOLD = 85;
export const EXCEPTIONAL_SCORE = 98;

/**
 * Put the Critic's overall score back on the 0-100 scale the gate below compares against.
 *
 * The prompt asks for 0-100 and Gemini is handed a response schema, but only Gemini is —
 * BYOK means OpenAI, Claude and Grok answer this from the prompt alone, and a model asked to
 * score quality will reasonably return 0.86 or 8.6. Both are excellent documents; both lose
 * to `>= 85`, so the draft is refined, re-audited, scored the same way again, and issued as
 * though it had failed. A silent scale mismatch is indistinguishable from a genuinely poor
 * draft, which is why this normalises rather than trusting the number.
 *
 * A single number cannot always settle the question — a bare `10` is either a perfect 10/10
 * or a scathing 10/100, and guessing wrong in the second direction ships a bad document as
 * excellent. So the ambiguous band is decided by corroboration from the six 6Cs sub-scores,
 * which are on the same scale as the overall: an audit whose every dimension sits at or below
 * 10 is a 0-10 audit. Without that corroboration the ambiguous band is left alone.
 *
 * 0 is never rescaled — it is the documented "audit skipped" sentinel, and inflating it would
 * turn a missing audit into a passing one.
 *
 * @param {unknown} raw - the reported overall score
 * @param {object} [subScores] - the audit's per-dimension scores, used only to break ties
 */
export const normalizeScore = (raw, subScores = null) => {
    const score = Number(raw);
    if (!Number.isFinite(score) || score <= 0) return null;

    const observed = Object.values(subScores || {})
        .map(Number)
        .filter(n => Number.isFinite(n) && n > 0);
    const corroborates = (ceiling) => observed.length >= 3 && observed.every(n => n <= ceiling);

    // A fraction cannot be a 0-100 score at all, so this needs no second opinion — unless the
    // sub-scores are plainly 0-100, in which case the overall really is a very low 1.
    if (score <= 1) return observed.some(n => n > 1) ? score : score * 100;

    // 8.6 out of 100 is not a score a model produces; 8.6 out of 10 is.
    if (score < 10 && !Number.isInteger(score)) return score * 10;

    if (score <= 10) return corroborates(10) ? score * 10 : score;

    return score;
};

/**
 * The Reviewer is asked for "APPROVED", and mostly says it. It also says "Approved",
 * "APPROVED_WITH_COMMENTS" and "PASS" — none of which an equality check on "APPROVED"
 * accepts, so a draft the Reviewer signed off on was refined anyway and the run paid for a
 * pass it did not need. Rejection stays exact by construction: anything not recognised here
 * is treated as not approved.
 */
export const isApprovedStatus = (status) => {
    const normalized = String(status ?? '').trim().toUpperCase();
    return normalized.startsWith('APPROVE') || normalized === 'PASS' || normalized === 'PASSED';
};

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
    sections, agents, sleep, emitProgress, reflectionCooldownMs,
    resumeFrom = null, onPassComplete = null
}) {
    let { srsShell, allFeatures, srsRequirements, srsAppendices, srsDraft } = sections;
    const { devAgent, qaAgent, criticAgent } = agents;

    let loopCount = 0;
    let finalIndustryAudit = null;
    let reflectionFeedback = [];

    // A pass that already ran in an earlier invocation is not re-run: it costs three AI calls
    // and would score a draft this loop has already acted on.
    // The draft itself arrives through `sections`, restored from the checkpoint by the
    // caller — this carries only what the loop knows and the checkpoint does not.
    if (resumeFrom) {
        loopCount = resumeFrom.loopCount ?? 0;
        finalIndustryAudit = resumeFrom.finalIndustryAudit ?? null;
        if (resumeFrom.done) {
            logger.info("[Resume] Reflection loop already satisfied the quality bar — skipping");
            return { srsDraft, loopCount, finalIndustryAudit };
        }
        logger.info({ msg: '[Resume] Continuing reflection loop', completedPasses: loopCount });
    }

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

        // Normalised in place so the benchmark stored on the analysis, and shown in the UI,
        // is the same number this gate judged. Two different scales for one audit is how a
        // document gets issued reading "0.86" beside a note saying it failed to reach 85.
        const score = normalizeScore(audit?.overallScore, audit?.scores);
        if (score !== null && score !== audit.overallScore) {
            logger.warn({
                msg: '[Senior QA Critic] Rescaled overall score to 0-100',
                reported: audit.overallScore,
                normalized: score
            });
            audit.overallScore = score;
        }
        finalIndustryAudit = audit;

        logger.info(`    Review Status: ${review.status}, Quality Score: ${score ?? 'unavailable'}`);

        // C. Check if we meet the quality bar (Case-Insensitive)
        // Intelligent Override: If score is near perfect (98+), allow pass even if Reviewer is stuck in pedantry
        const isApproved = isApprovedStatus(review.status);
        // No usable score is not the same as a bad one. A truncated or unparseable audit used
        // to compare `undefined >= 85` as false and force a refinement pass no feedback could
        // guide, so an unreadable audit defers to the Reviewer rather than overruling it.
        const isHighQuality = score === null ? isApproved : score >= QUALITY_THRESHOLD;
        const isExceptional = score !== null && score >= EXCEPTIONAL_SCORE;

        if ((isApproved || isExceptional) && isHighQuality) {
            logger.info(`    [OK] Quality threshold met${isExceptional && !isApproved ? " (Exceptional Score Override)" : ""}. Exiting reflection loop.`);
            await onPassComplete?.({ loopCount, finalIndustryAudit, srsDraft, allFeatures, done: true });
            break;
        }

        // D. Threshold not met: Surgical Refinement
        loopCount++;

        const reason = !isApproved
            ? `QA Status: ${review.status}`
            : `Quality Score: ${score ?? 'unavailable'} < ${QUALITY_THRESHOLD}`;

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

        // The refinement is durable from here. Yielding at this boundary and nowhere else is
        // deliberate: it is the only point in the pass where the draft is whole.
        await onPassComplete?.({ loopCount, finalIndustryAudit, srsDraft, allFeatures, done: false });
    }

    return { srsDraft, loopCount, finalIndustryAudit };
}
