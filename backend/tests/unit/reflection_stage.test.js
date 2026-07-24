import { jest, describe, it, expect } from '@jest/globals';

const { runReflectionLoop } = await import('../../src/services/pipeline/reflectionStage.js');

const noopSleep = () => Promise.resolve();
const noopProgress = () => {};

const baseSections = () => ({
    srsShell: { introduction: { purpose: 'p' } },
    allFeatures: [{ name: 'F1' }],
    srsRequirements: { nonFunctionalRequirements: {} },
    srsAppendices: { appendices: {} },
    srsDraft: { introduction: { purpose: 'p' }, systemFeatures: [{ name: 'F1' }] }
});

const makeArgs = (agents) => ({
    text: 'input',
    poOutput: { features: [] },
    archOutput: { tier: '3' },
    projectName: 'Proj',
    sections: baseSections(),
    agents,
    sleep: noopSleep,
    emitProgress: noopProgress,
    reflectionCooldownMs: 0
});

describe('runReflectionLoop', () => {
    it('exits immediately (loopCount 0) when the first pass is approved and high quality', async () => {
        const devAgent = { refineSRS: jest.fn() };
        const qaAgent = { reviewSRS: jest.fn().mockResolvedValue({ status: 'APPROVED', feedback: [] }) };
        const criticAgent = { auditSRS: jest.fn().mockResolvedValue({ overallScore: 90, criticalIssues: [], suggestions: [] }) };

        const result = await runReflectionLoop(makeArgs({ devAgent, qaAgent, criticAgent }));

        expect(result.loopCount).toBe(0);
        expect(result.finalIndustryAudit.overallScore).toBe(90);
        expect(devAgent.refineSRS).not.toHaveBeenCalled();
    });

    it('accepts an exceptional Critic score (>=98) even when the Reviewer rejects', async () => {
        const devAgent = { refineSRS: jest.fn() };
        const qaAgent = { reviewSRS: jest.fn().mockResolvedValue({ status: 'REJECTED', feedback: [] }) };
        const criticAgent = { auditSRS: jest.fn().mockResolvedValue({ overallScore: 99, criticalIssues: [], suggestions: [] }) };

        const result = await runReflectionLoop(makeArgs({ devAgent, qaAgent, criticAgent }));

        expect(result.loopCount).toBe(0);
        expect(devAgent.refineSRS).not.toHaveBeenCalled();
    });

    it('surgically refines the Appendices section when feedback mentions a diagram', async () => {
        const devAgent = { refineSRS: jest.fn().mockResolvedValue({ appendices: { fixed: true } }) };
        // First pass fails (reject + low score with a diagram complaint), second pass passes.
        const qaAgent = {
            reviewSRS: jest.fn()
                .mockResolvedValueOnce({ status: 'REJECTED', feedback: [{ severity: 'MAJOR', category: 'Quality', issue: 'The ERD diagram is malformed' }] })
                .mockResolvedValueOnce({ status: 'APPROVED', feedback: [] })
        };
        const criticAgent = {
            auditSRS: jest.fn()
                .mockResolvedValueOnce({ overallScore: 60, criticalIssues: [], suggestions: [] })
                .mockResolvedValueOnce({ overallScore: 92, criticalIssues: [], suggestions: [] })
        };

        const result = await runReflectionLoop(makeArgs({ devAgent, qaAgent, criticAgent }));

        expect(result.loopCount).toBe(1);
        expect(devAgent.refineSRS).toHaveBeenCalledTimes(1);
        // 5th positional arg to refineSRS is the target section name.
        expect(devAgent.refineSRS.mock.calls[0][4]).toBe('Appendices');
    });

    it('stops after MAX_LOOPS (2) even if quality never clears', async () => {
        const devAgent = { refineSRS: jest.fn().mockResolvedValue({}) };
        const qaAgent = { reviewSRS: jest.fn().mockResolvedValue({ status: 'REJECTED', feedback: [{ issue: 'bad' }] }) };
        const criticAgent = { auditSRS: jest.fn().mockResolvedValue({ overallScore: 10, criticalIssues: [], suggestions: [] }) };

        const result = await runReflectionLoop(makeArgs({ devAgent, qaAgent, criticAgent }));

        expect(result.loopCount).toBe(2);
        expect(devAgent.refineSRS).toHaveBeenCalledTimes(2);
    });
});
