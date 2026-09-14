import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const ensureProjectExists = jest.fn();
const createDraftAnalysis = jest.fn();

jest.unstable_mockModule('../../src/services/projectService.js', () => ({
    ensureProjectExists
}));

jest.unstable_mockModule('../../src/services/analysisService.js', () => ({
    getUserAnalyses: jest.fn(),
    getAnalysisById: jest.fn(),
    getAnalysisHistory: jest.fn(),
    deleteAnalysis: jest.fn(),
    createDraftAnalysis
}));

jest.unstable_mockModule('../../src/services/queueService.js', () => ({
    addAnalysisJob: jest.fn(),
    getJobStatus: jest.fn(),
    resumeAnalysisJob: jest.fn()
}));

jest.unstable_mockModule('../../src/services/surgicalRefineService.js', () => ({ surgicalRefine: jest.fn() }));
jest.unstable_mockModule('../../src/services/diffService.js', () => ({ compareAnalyses: jest.fn() }));
jest.unstable_mockModule('../../src/services/qualityService.js', () => ({ lintRequirements: jest.fn(), checkAlignment: jest.fn() }));
jest.unstable_mockModule('../../src/services/validationService.js', () => ({ validateRequirements: jest.fn(), autoFixRequirements: jest.fn() }));
jest.unstable_mockModule('../../src/services/aiService.js', () => ({
    analyzeText: jest.fn(),
    repairDiagram: jest.fn()
}));
jest.unstable_mockModule('../../src/services/knowledge/embeddingService.js', () => ({ embedText: jest.fn() }));
jest.unstable_mockModule('../../src/services/knowledge/reuseService.js', () => ({ findReuseCandidate: jest.fn() }));
jest.unstable_mockModule('../../src/config/prisma.js', () => ({ default: {} }));
jest.unstable_mockModule('../../src/utils/response.js', () => ({ successResponse: (res, data, message, status = 200) => res.status(status).json({ success: true, message, data }) }));
jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    REDACTED_PATHS: []
}));
jest.unstable_mockModule('../../src/services/versioning.js', () => ({ createNextVersion: jest.fn() }));
jest.unstable_mockModule('../../src/services/providers/providerKeyService.js', () => ({
    resolveProviderForUser: jest.fn(),
    asAiSettings: jest.fn(),
    resolveProviderKey: jest.fn(),
    listProviderKeys: jest.fn(),
    upsertProviderKey: jest.fn(),
    deleteProviderKey: jest.fn(),
    refreshProviderModels: jest.fn()
}));
jest.unstable_mockModule('../../src/utils/errorSanitizer.js', () => ({ sanitizeError: jest.fn() }));
jest.unstable_mockModule('../../src/utils/errorCodes.js', () => ({ ErrorCodes: {} }));
jest.unstable_mockModule('../../src/utils/sseWriter.js', () => ({ createSSEStream: jest.fn() }));

const { analyze } = await import('../../src/controllers/analysisController.js');

const response = () => {
    const res = { statusCode: 200, body: null };
    res.status = (status) => {
        res.statusCode = status;
        return res;
    };
    res.json = (body) => {
        res.body = body;
        return res;
    };
    return res;
};

describe('Layer-1 draft project association', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ensureProjectExists.mockResolvedValue('project-created-for-draft');
        createDraftAnalysis.mockResolvedValue({
            id: 'draft-1',
            projectId: 'project-created-for-draft'
        });
    });

    it('persists the resolved project on a draft and returns it to the review client', async () => {
        const srsData = {
            details: {
                projectName: { content: 'Password Reset' },
                fullDescription: { content: 'Reset a password by email.' }
            }
        };
        const req = {
            body: { srsData, draft: true, settings: { format: 'ieee830' } },
            user: { userId: 'user-1' }
        };
        const res = response();

        await analyze(req, res, jest.fn());

        expect(ensureProjectExists).toHaveBeenCalledWith('user-1', undefined, srsData, undefined);
        expect(createDraftAnalysis).toHaveBeenCalledWith(
            'user-1',
            srsData,
            'project-created-for-draft',
            { format: 'ieee830' }
        );
        expect(res.body.data).toEqual({
            id: 'draft-1',
            projectId: 'project-created-for-draft',
            status: 'draft'
        });
    });

    it('keeps an explicitly selected project instead of resolving another one', async () => {
        const srsData = { details: { projectName: { content: 'Existing Project' } } };
        const req = {
            body: { srsData, draft: true, projectId: 'existing-project' },
            user: { userId: 'user-1' }
        };
        const res = response();

        ensureProjectExists.mockResolvedValue('existing-project');
        createDraftAnalysis.mockResolvedValue({ id: 'draft-2', projectId: 'existing-project' });

        await analyze(req, res, jest.fn());

        expect(ensureProjectExists).toHaveBeenCalledWith('user-1', 'existing-project', srsData, undefined);
        expect(createDraftAnalysis).toHaveBeenCalledWith('user-1', srsData, 'existing-project', undefined);
        expect(res.body.data.projectId).toBe('existing-project');
    });
});
