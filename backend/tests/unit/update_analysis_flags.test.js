import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockPrisma = {
    analysis: { update: jest.fn() },
    $transaction: jest.fn((callback) => callback(mockPrisma))
};

jest.unstable_mockModule('../../src/config/prisma.js', () => ({ default: mockPrisma }));

const getAnalysisById = jest.fn();
jest.unstable_mockModule('../../src/services/analysisService.js', () => ({
    getAnalysisById,
    performAnalysis: jest.fn(),
    getUserAnalyses: jest.fn(),
    getAnalysisHistory: jest.fn(),
    deleteAnalysis: jest.fn(),
    createDraftAnalysis: jest.fn()
}));

const checkAlignment = jest.fn();
jest.unstable_mockModule('../../src/services/qualityService.js', () => ({
    checkAlignment,
    lintRequirements: () => ({ score: 90, issues: [] })
}));

jest.unstable_mockModule('../../src/services/versioning.js', () => ({
    createNextVersion: jest.fn(async (tx, rootId, build) => ({ id: 'new-id', version: 2, ...build(2) }))
}));

const { updateAnalysis } = await import('../../src/controllers/analysisController.js');

const respond = () => {
    const res = { statusCode: 200, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    return res;
};

const existing = {
    id: 'analysis-1',
    userId: 'user-1',
    inputText: 'raw',
    metadata: {},
    resultJson: { formatId: 'ieee830', projectTitle: 'Demo', systemFeatures: [] }
};

beforeEach(() => {
    getAnalysisById.mockResolvedValue(existing);
    mockPrisma.analysis.update.mockImplementation(async ({ data }) => ({ id: 'analysis-1', version: 1, ...data }));
    checkAlignment.mockResolvedValue({ status: 'ALIGNED' });
});

describe('updateAnalysis control flags', () => {
    test('does not persist inPlace/skipAlignment into the stored document', async () => {
        const req = {
            params: { id: 'analysis-1' },
            user: { userId: 'user-1' },
            body: {
                inPlace: true,
                skipAlignment: true,
                systemFeatures: [{ name: 'Auth', verification_files: ['src/auth.ts'] }],
                metadata: { cliTraceability: { summary: { groups: 1 } } }
            }
        };

        await updateAnalysis(req, respond(), jest.fn());

        const written = mockPrisma.analysis.update.mock.calls[0][0].data.resultJson;
        // These steer how the update is applied; storing them leaves two stray keys in
        // the SRS that persist through every later read and export.
        expect(written).not.toHaveProperty('inPlace');
        expect(written).not.toHaveProperty('skipAlignment');
        expect(written.systemFeatures[0].verification_files).toEqual(['src/auth.ts']);
    });

    test('inPlace still routes to an in-place update rather than a new version', async () => {
        const req = {
            params: { id: 'analysis-1' },
            user: { userId: 'user-1' },
            body: { inPlace: true, projectTitle: 'Renamed' }
        };

        await updateAnalysis(req, respond(), jest.fn());

        expect(mockPrisma.analysis.update).toHaveBeenCalled();
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    test('skipAlignment still suppresses the paid alignment call', async () => {
        const req = {
            params: { id: 'analysis-1' },
            user: { userId: 'user-1' },
            body: { skipAlignment: true, projectTitle: 'Renamed' }
        };

        await updateAnalysis(req, respond(), jest.fn());

        expect(checkAlignment).not.toHaveBeenCalled();
    });

    test('without skipAlignment the alignment check still runs', async () => {
        const req = {
            params: { id: 'analysis-1' },
            user: { userId: 'user-1' },
            body: { projectTitle: 'Renamed' }
        };

        await updateAnalysis(req, respond(), jest.fn());

        expect(checkAlignment).toHaveBeenCalled();
    });
});
