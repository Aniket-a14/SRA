import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Two ways the quality layer reported something it had not measured.
 *
 * 1. checkAlignment returned { status: 'ALIGNED' } when the model call failed, and every
 *    caller mapped any status but MISMATCH_DETECTED to ALIGNED. A provider outage or a
 *    malformed reply was shown to the user as a verified Layer-3 alignment.
 * 2. recordQualityMetric filled missing scores with 85 via `Number(x) || 85`, which also
 *    rewrote a real 0 as 85. It had no caller either, so QualityMetricRecord stayed empty.
 */
const mockAnalyzeText = jest.fn();
jest.unstable_mockModule('../../src/services/aiService.js', () => ({ analyzeText: mockAnalyzeText }));

const mockCreate = jest.fn();
jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: { qualityMetricRecord: { create: mockCreate } }
}));

const { checkAlignment, recordQualityMetric } = await import('../../src/services/qualityService.js');
const { toLayer3Status, ALIGNMENT_CHECK_FAILED } = await import('../../src/utils/layer3Status.js');

const intent = { projectName: 'Leave Tracker', rawText: 'track leave' };
const context = { domain: 'HR', purpose: 'leave' };
const provider = { provider: 'GEMINI', apiKey: 'k', modelName: 'm' };

describe('Layer-3 alignment never reports an unrun check as ALIGNED', () => {
    beforeEach(() => mockAnalyzeText.mockReset());

    it.each([
        ['success:false', { success: false, error: 'provider 503' }],
        ['null response', null],
        ['no structured body', { success: true }]
    ])('checkAlignment returns CHECK_FAILED on %s', async (_label, response) => {
        mockAnalyzeText.mockResolvedValue(response);
        const result = await checkAlignment(intent, context, { projectTitle: 'x' }, provider);
        expect(result.status).toBe(ALIGNMENT_CHECK_FAILED);
        expect(toLayer3Status(result)).toBe('UNVERIFIED');
    });

    it('passes a genuine model verdict through', async () => {
        mockAnalyzeText.mockResolvedValue({ success: true, srs: { status: 'MISMATCH_DETECTED', mismatches: [{ severity: 'BLOCKER' }] } });
        const result = await checkAlignment(intent, context, {}, provider);
        expect(toLayer3Status(result)).toBe('MISMATCH');
    });

    it.each([
        [{ status: 'ALIGNED' }, 'ALIGNED'],
        [{ status: 'MISMATCH_DETECTED' }, 'MISMATCH'],
        [{ status: 'CHECK_FAILED' }, 'UNVERIFIED'],
        [{ status: 'PASS' }, 'UNVERIFIED'],          // outside the prompt's contract
        [{ status: 'aligned' }, 'UNVERIFIED'],       // contract is exact-case
        [{}, 'UNVERIFIED'],
        [null, 'UNVERIFIED'],                        // the thrown-error path
        [undefined, 'UNVERIFIED']
    ])('toLayer3Status(%j) is %s', (input, expected) => {
        expect(toLayer3Status(input)).toBe(expected);
    });
});

describe('recordQualityMetric records only what was measured', () => {
    const fullAudit = {
        overallScore: 0,
        scores: { clarity: 0, completeness: 40, conciseness: 55, consistency: 60, correctness: 70, context: 80 }
    };
    const base = {
        analysisId: 'a1', userId: 'u1', version: 2,
        promptVersion: '2.2.0', modelProvider: 'CLAUDE', modelName: 'claude-test'
    };

    beforeEach(() => {
        mockCreate.mockReset();
        mockCreate.mockImplementation(async ({ data }) => ({ id: 'row', ...data }));
    });

    it('stores a real 0 as 0, not 85', async () => {
        await recordQualityMetric({ ...base, audit: fullAudit, ragFaithfulness: 0 });
        const { data } = mockCreate.mock.calls[0][0];
        expect(data).toMatchObject({
            overallScore: 0, clarity: 0, completeness: 40, ragFaithfulness: 0,
            version: 2, promptVersion: '2.2.0', modelProvider: 'CLAUDE', modelName: 'claude-test'
        });
    });

    it('accepts numeric strings the model sometimes returns', async () => {
        await recordQualityMetric({ ...base, audit: { overallScore: '72', scores: Object.fromEntries(Object.keys(fullAudit.scores).map(k => [k, '50'])) } });
        expect(mockCreate.mock.calls[0][0].data.overallScore).toBe(72);
    });

    it.each([
        ['a skipped audit (light tier)', { overallScore: 0, scores: {}, skipped: true }],
        ['a missing dimension', { ...fullAudit, scores: { ...fullAudit.scores, context: undefined } }],
        ['a non-numeric dimension', { ...fullAudit, scores: { ...fullAudit.scores, clarity: 'high' } }],
        ['no overall score', { scores: fullAudit.scores }],
        ['no audit at all', undefined]
    ])('writes no row for %s', async (_label, audit) => {
        await expect(recordQualityMetric({ ...base, audit })).resolves.toBeNull();
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('writes no row without provider/model attribution instead of guessing one', async () => {
        await expect(recordQualityMetric({ ...base, modelName: undefined, audit: fullAudit })).resolves.toBeNull();
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('stores a missing faithfulness as null', async () => {
        await recordQualityMetric({ ...base, audit: fullAudit });
        expect(mockCreate.mock.calls[0][0].data.ragFaithfulness).toBeNull();
    });

    it('never throws when the insert fails', async () => {
        mockCreate.mockRejectedValue(new Error('db down'));
        await expect(recordQualityMetric({ ...base, audit: fullAudit })).resolves.toBeNull();
    });
});
