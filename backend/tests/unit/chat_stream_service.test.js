import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockAnalysisFindFirst = jest.fn();
const mockAnalysisCreate = jest.fn();
const mockChatMessageFindUnique = jest.fn();
const mockChatMessageFindFirst = jest.fn();
const mockChatMessageFindMany = jest.fn();
const mockChatMessageUpsert = jest.fn();
const mockChatMessageCreate = jest.fn();
const mockChatStream = jest.fn();
const mockProposeEdit = jest.fn();

const txClient = {
    analysis: { findFirst: mockAnalysisFindFirst, create: mockAnalysisCreate }
};

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        analysis: { findUnique: mockFindUnique, findMany: mockFindMany },
        chatMessage: {
            findUnique: mockChatMessageFindUnique,
            findFirst: mockChatMessageFindFirst,
            findMany: mockChatMessageFindMany,
            upsert: mockChatMessageUpsert,
            create: mockChatMessageCreate
        },
        $transaction: jest.fn(async (fn) => fn(txClient))
    }
}));

jest.unstable_mockModule('../../src/agents/ChatAgent.js', () => ({
    ChatAgent: jest.fn().mockImplementation(() => ({
        chatStream: mockChatStream,
        proposeEdit: mockProposeEdit
    }))
}));

jest.unstable_mockModule('../../src/utils/promptCompaction.js', () => ({
    createChatSnapshot: jest.fn(() => ({}))
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const { processChatStream, looksLikeEditRequest } = await import('../../src/services/chatService.js');

async function* fakeStream(words) {
    for (const w of words) yield w;
}

describe('looksLikeEditRequest', () => {
    it('flags messages with edit-intent keywords', () => {
        expect(looksLikeEditRequest('Please rename the project to Foo')).toBe(true);
        expect(looksLikeEditRequest('Can you add a security requirement?')).toBe(true);
    });

    it('does not flag plain questions', () => {
        expect(looksLikeEditRequest('What does this requirement mean?')).toBe(false);
        expect(looksLikeEditRequest('Explain the architecture to me')).toBe(false);
    });
});

describe('processChatStream', () => {
    const originalMockAi = process.env.MOCK_AI;

    beforeEach(() => {
        process.env.MOCK_AI = 'false'; // exercise the real (mocked-agent) streaming path
        mockFindUnique.mockReset().mockResolvedValue({
            id: 'analysis-1', userId: 'user-1', rootId: null, resultJson: {}, metadata: {}
        });
        mockFindMany.mockReset().mockResolvedValue([{ id: 'analysis-1' }]);
        mockAnalysisFindFirst.mockReset().mockResolvedValue({ version: 1 });
        mockAnalysisCreate.mockReset().mockImplementation(({ data }) => Promise.resolve({ id: 'new-version-id', ...data }));
        mockChatMessageFindUnique.mockReset();
        mockChatMessageFindFirst.mockReset();
        mockChatMessageFindMany.mockReset().mockResolvedValue([]);
        mockChatMessageUpsert.mockReset();
        mockChatMessageCreate.mockReset();
        mockChatStream.mockReset();
        mockProposeEdit.mockReset();
    });

    afterEach(() => {
        process.env.MOCK_AI = originalMockAi;
    });

    it('streams reply chunks via onChunk and skips proposeEdit for a plain question', async () => {
        mockChatMessageFindUnique.mockResolvedValue(null);
        mockChatStream.mockImplementation(() => fakeStream(['The ', 'answer ', 'is X.']));

        const chunks = [];
        const result = await processChatStream('user-1', 'analysis-1', 'What does this mean?', 'uuid-1', (c) => chunks.push(c));

        expect(chunks).toEqual(['The ', 'answer ', 'is X.']);
        expect(result.reply).toBe('The answer is X.');
        expect(result.newAnalysisId).toBeNull();
        expect(mockProposeEdit).not.toHaveBeenCalled();
        expect(mockChatMessageCreate).toHaveBeenCalledWith({
            data: { analysisId: 'analysis-1', role: 'assistant', content: 'The answer is X.' }
        });
    });

    it('runs proposeEdit in parallel and versions the result for an edit-intent message', async () => {
        mockChatMessageFindUnique.mockResolvedValue(null);
        mockChatStream.mockImplementation(() => fakeStream(['Sure, ', 'renamed it.']));
        mockProposeEdit.mockResolvedValue({ updatedAnalysis: { projectTitle: 'New Name' } });

        const result = await processChatStream('user-1', 'analysis-1', 'Rename the project to New Name', 'uuid-2', () => {});

        expect(mockProposeEdit).toHaveBeenCalledTimes(1);
        expect(result.reply).toBe('Sure, renamed it.');
        expect(result.newAnalysisId).toBe('new-version-id');
        expect(mockAnalysisCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ resultJson: { projectTitle: 'New Name' } })
        }));
    });

    it('a failed proposeEdit does not break the streamed reply', async () => {
        mockChatMessageFindUnique.mockResolvedValue(null);
        mockChatStream.mockImplementation(() => fakeStream(['Still ', 'streams fine.']));
        mockProposeEdit.mockRejectedValue(new Error('AI edit call failed'));

        const result = await processChatStream('user-1', 'analysis-1', 'Please update the scope', 'uuid-3', () => {});

        expect(result.reply).toBe('Still streams fine.');
        expect(result.newAnalysisId).toBeNull();
    });

    it('short-circuits on a duplicate clientMessageId and replays the stored reply as one chunk', async () => {
        mockChatMessageFindUnique.mockResolvedValue({ analysisId: 'analysis-1', createdAt: new Date('2026-01-01T00:00:00Z') });
        mockChatMessageFindFirst.mockResolvedValue({ content: 'Already answered' });

        const chunks = [];
        const result = await processChatStream('user-1', 'analysis-1', 'hello again', 'dup-uuid', (c) => chunks.push(c));

        expect(result.reply).toBe('Already answered');
        expect(chunks).toEqual(['Already answered']);
        expect(mockChatStream).not.toHaveBeenCalled();
    });
});
