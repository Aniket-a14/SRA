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
const mockChatAgentChat = jest.fn();

const txClient = {
    analysis: {
        findFirst: mockAnalysisFindFirst,
        create: mockAnalysisCreate
    }
};

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        analysis: {
            findUnique: mockFindUnique,
            findMany: mockFindMany
        },
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
    ChatAgent: jest.fn().mockImplementation(() => ({ chat: mockChatAgentChat }))
}));

jest.unstable_mockModule('../../src/utils/promptCompaction.js', () => ({
    createChatSnapshot: jest.fn(() => ({}))
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const { processChat } = await import('../../src/services/chatService.js');

describe('processChat dedup via clientMessageId', () => {
    const originalMockAi = process.env.MOCK_AI;

    beforeEach(() => {
        process.env.MOCK_AI = 'true';
        mockFindUnique.mockReset();
        mockFindMany.mockReset().mockResolvedValue([{ id: 'analysis-1' }]);
        mockAnalysisFindFirst.mockReset().mockResolvedValue({ version: 1 });
        mockAnalysisCreate.mockReset().mockImplementation(({ data }) => Promise.resolve({ id: 'new-version-id', ...data }));
        mockChatMessageFindUnique.mockReset();
        mockChatMessageFindFirst.mockReset();
        mockChatMessageFindMany.mockReset().mockResolvedValue([]);
        mockChatMessageUpsert.mockReset();
        mockChatMessageCreate.mockReset();
        mockChatAgentChat.mockReset();

        mockFindUnique.mockResolvedValue({
            id: 'analysis-1',
            userId: 'user-1',
            rootId: null,
            resultJson: {},
            metadata: {}
        });
    });

    afterEach(() => {
        process.env.MOCK_AI = originalMockAi;
    });

    it('short-circuits and returns the stored reply when clientMessageId was already processed', async () => {
        const existingTurn = { analysisId: 'analysis-1', createdAt: new Date('2026-01-01T00:00:00Z') };
        mockChatMessageFindUnique.mockResolvedValue(existingTurn);
        mockChatMessageFindFirst.mockResolvedValue({ content: 'Previously computed reply' });

        const result = await processChat('user-1', 'analysis-1', 'hello again', 'dup-uuid');

        expect(result.reply).toBe('Previously computed reply');
        expect(mockChatMessageCreate).not.toHaveBeenCalled();
        expect(mockChatMessageUpsert).not.toHaveBeenCalled();
    });

    it('upserts on clientMessageId for a new send instead of blind create()', async () => {
        mockChatMessageFindUnique.mockResolvedValue(null);

        const result = await processChat('user-1', 'analysis-1', 'hello', 'new-uuid');

        expect(mockChatMessageUpsert).toHaveBeenCalledWith({
            where: { clientMessageId: 'new-uuid' },
            create: { analysisId: 'analysis-1', role: 'user', content: 'hello', clientMessageId: 'new-uuid' },
            update: {}
        });
        expect(result.reply).toBe('Mocked AI Reply');
    });

    it('falls back to a plain create() when no clientMessageId is supplied', async () => {
        mockChatMessageFindUnique.mockResolvedValue(null);

        await processChat('user-1', 'analysis-1', 'hello');

        expect(mockChatMessageUpsert).not.toHaveBeenCalled();
        expect(mockChatMessageCreate).toHaveBeenCalledWith({
            data: { analysisId: 'analysis-1', role: 'user', content: 'hello' }
        });
    });
});
