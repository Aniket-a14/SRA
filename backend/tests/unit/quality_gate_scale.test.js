import { describe, it, expect, jest } from '@jest/globals';

/**
 * The quality gate compares the Critic's score against 85. Only Gemini receives a response
 * schema for that call — BYOK means OpenAI, Claude and Grok answer from the prompt text alone
 * — so the number can arrive on a scale the gate was never written for. When it does, an
 * excellent document is refined, re-audited, scored the same way, and issued as a failure.
 */

const { normalizeScore, isApprovedStatus, runReflectionLoop } =
    await import('../../src/services/pipeline/reflectionStage.js');

describe('normalizeScore', () => {
    it('leaves a 0-100 score alone', () => {
        expect(normalizeScore(91)).toBe(91);
        expect(normalizeScore(62)).toBe(62);
    });

    it('rescales a 0-1 fraction', () => {
        expect(normalizeScore(0.86)).toBeCloseTo(86);
        expect(normalizeScore(0.9)).toBeCloseTo(90);
    });

    it('rescales a fractional 0-10 score', () => {
        expect(normalizeScore(8.6)).toBeCloseTo(86);
    });

    it('leaves an ambiguous whole number alone without corroboration', () => {
        // 10 is either a perfect 10/10 or a scathing 10/100. Promoting it on a guess would
        // issue a failing document as exceptional, so one number is not enough to act on.
        expect(normalizeScore(10)).toBe(10);
        expect(normalizeScore(9)).toBe(9);
    });

    it('rescales an ambiguous whole number when the 6Cs agree it is a 0-10 audit', () => {
        const scores = { clarity: 9, completeness: 8, conciseness: 9, consistency: 10, correctness: 9, context: 8 };
        expect(normalizeScore(9, scores)).toBe(90);
    });

    it('does not rescale when the 6Cs are plainly on 0-100', () => {
        const scores = { clarity: 95, completeness: 88, conciseness: 90, consistency: 92, correctness: 93, context: 89 };
        expect(normalizeScore(9, scores)).toBe(9);
        // A genuine 1-out-of-100 stays a 1 rather than becoming a pass.
        expect(normalizeScore(1, scores)).toBe(1);
    });

    it('treats an unusable score as absent rather than as zero', () => {
        // 0 is the "audit skipped" sentinel; inflating it would turn a missing audit into one
        // that passed, and `undefined >= 85` silently reads as a failing document.
        expect(normalizeScore(0)).toBeNull();
        expect(normalizeScore(undefined)).toBeNull();
        expect(normalizeScore('not a number')).toBeNull();
    });
});

describe('isApprovedStatus', () => {
    it('accepts the wordings a reviewer actually returns', () => {
        for (const status of ['APPROVED', 'Approved', ' approved ', 'APPROVED_WITH_COMMENTS', 'PASS']) {
            expect(isApprovedStatus(status)).toBe(true);
        }
    });

    it('treats anything unrecognised as not approved', () => {
        for (const status of ['REJECTED', 'NEEDS_WORK', '', null, undefined]) {
            expect(isApprovedStatus(status)).toBe(false);
        }
    });
});

const baseArgs = (agents) => ({
    text: 'input',
    poOutput: { features: [] },
    archOutput: { tier: '3' },
    projectName: 'Proj',
    sections: {
        srsShell: { introduction: { purpose: 'p' } },
        allFeatures: [{ name: 'F1' }],
        srsRequirements: { nonFunctionalRequirements: {} },
        srsAppendices: { appendices: {} },
        srsDraft: { introduction: { purpose: 'p' } }
    },
    agents,
    sleep: () => Promise.resolve(),
    emitProgress: () => {},
    reflectionCooldownMs: 0
});

describe('runReflectionLoop — score scale', () => {
    it('passes a document the Critic scored 0.9, instead of refining it', async () => {
        const devAgent = { refineSRS: jest.fn() };
        const qaAgent = { reviewSRS: jest.fn().mockResolvedValue({ status: 'APPROVED', feedback: [] }) };
        const criticAgent = {
            auditSRS: jest.fn().mockResolvedValue({ overallScore: 0.9, criticalIssues: [], suggestions: [] })
        };

        const result = await runReflectionLoop(baseArgs({ devAgent, qaAgent, criticAgent }));

        expect(result.loopCount).toBe(0);
        expect(devAgent.refineSRS).not.toHaveBeenCalled();
        // The stored benchmark is the number the gate judged, not the one the model sent.
        expect(result.finalIndustryAudit.overallScore).toBeCloseTo(90);
    });

    it('accepts a reviewer that approved in different words', async () => {
        const devAgent = { refineSRS: jest.fn() };
        const qaAgent = { reviewSRS: jest.fn().mockResolvedValue({ status: 'Approved', feedback: [] }) };
        const criticAgent = {
            auditSRS: jest.fn().mockResolvedValue({ overallScore: 88, criticalIssues: [], suggestions: [] })
        };

        const result = await runReflectionLoop(baseArgs({ devAgent, qaAgent, criticAgent }));

        expect(result.loopCount).toBe(0);
        expect(devAgent.refineSRS).not.toHaveBeenCalled();
    });

    it('defers to the Reviewer when the audit is unreadable', async () => {
        // A truncated audit used to compare `undefined >= 85` as false, forcing a refinement
        // pass that no feedback could guide — three AI calls to act on nothing.
        const devAgent = { refineSRS: jest.fn() };
        const qaAgent = { reviewSRS: jest.fn().mockResolvedValue({ status: 'APPROVED', feedback: [] }) };
        const criticAgent = { auditSRS: jest.fn().mockResolvedValue({ criticalIssues: [], suggestions: [] }) };

        const result = await runReflectionLoop(baseArgs({ devAgent, qaAgent, criticAgent }));

        expect(result.loopCount).toBe(0);
        expect(devAgent.refineSRS).not.toHaveBeenCalled();
    });

    it('still refines a genuinely low score', async () => {
        const devAgent = { refineSRS: jest.fn().mockResolvedValue({}) };
        const qaAgent = { reviewSRS: jest.fn().mockResolvedValue({ status: 'REJECTED', feedback: [{ issue: 'bad' }] }) };
        const criticAgent = {
            auditSRS: jest.fn().mockResolvedValue({ overallScore: 41, criticalIssues: [], suggestions: [] })
        };

        const result = await runReflectionLoop(baseArgs({ devAgent, qaAgent, criticAgent }));

        expect(result.loopCount).toBe(2);
        expect(devAgent.refineSRS).toHaveBeenCalledTimes(2);
    });
});

describe('runReflectionLoop — pausing and resuming', () => {
    it('reports each completed pass so the run can be checkpointed', async () => {
        const devAgent = { refineSRS: jest.fn().mockResolvedValue({}) };
        const qaAgent = { reviewSRS: jest.fn().mockResolvedValue({ status: 'REJECTED', feedback: [{ issue: 'bad' }] }) };
        const criticAgent = {
            auditSRS: jest.fn().mockResolvedValue({ overallScore: 30, criticalIssues: [], suggestions: [] })
        };
        const onPassComplete = jest.fn();

        await runReflectionLoop({ ...baseArgs({ devAgent, qaAgent, criticAgent }), onPassComplete });

        expect(onPassComplete).toHaveBeenCalledTimes(2);
        expect(onPassComplete.mock.calls[0][0]).toMatchObject({ loopCount: 1, done: false });
        expect(onPassComplete.mock.calls[1][0]).toMatchObject({ loopCount: 2, done: false });
    });

    it('lets a yield propagate so the worker can continue in a new invocation', async () => {
        const devAgent = { refineSRS: jest.fn().mockResolvedValue({}) };
        const qaAgent = { reviewSRS: jest.fn().mockResolvedValue({ status: 'REJECTED', feedback: [{ issue: 'bad' }] }) };
        const criticAgent = {
            auditSRS: jest.fn().mockResolvedValue({ overallScore: 30, criticalIssues: [], suggestions: [] })
        };
        const paused = Object.assign(new Error('paused'), { paused: true, stage: 'reflection_pass_1' });
        const onPassComplete = jest.fn().mockRejectedValue(paused);

        await expect(
            runReflectionLoop({ ...baseArgs({ devAgent, qaAgent, criticAgent }), onPassComplete })
        ).rejects.toBe(paused);

        // Stopped after the first refinement rather than spending a second pass it cannot finish.
        expect(devAgent.refineSRS).toHaveBeenCalledTimes(1);
    });

    it('does not re-audit a pass that already ran in an earlier invocation', async () => {
        const devAgent = { refineSRS: jest.fn().mockResolvedValue({}) };
        const qaAgent = { reviewSRS: jest.fn().mockResolvedValue({ status: 'REJECTED', feedback: [{ issue: 'bad' }] }) };
        const criticAgent = {
            auditSRS: jest.fn().mockResolvedValue({ overallScore: 30, criticalIssues: [], suggestions: [] })
        };

        const result = await runReflectionLoop({
            ...baseArgs({ devAgent, qaAgent, criticAgent }),
            resumeFrom: { loopCount: 1, srsDraft: { resumed: true }, allFeatures: [{ name: 'F1' }], done: false }
        });

        expect(result.loopCount).toBe(2);
        expect(devAgent.refineSRS).toHaveBeenCalledTimes(1); // only the pass that was still owed
    });

    it('skips the loop entirely when it had already cleared the bar', async () => {
        const devAgent = { refineSRS: jest.fn() };
        const qaAgent = { reviewSRS: jest.fn() };
        const criticAgent = { auditSRS: jest.fn() };

        const result = await runReflectionLoop({
            ...baseArgs({ devAgent, qaAgent, criticAgent }),
            resumeFrom: { loopCount: 1, finalIndustryAudit: { overallScore: 91 }, srsDraft: { done: true }, done: true }
        });

        expect(result.finalIndustryAudit.overallScore).toBe(91);
        expect(qaAgent.reviewSRS).not.toHaveBeenCalled();
        expect(criticAgent.auditSRS).not.toHaveBeenCalled();
    });
});
