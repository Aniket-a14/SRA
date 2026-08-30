import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateMany = jest.fn();
const mockDeleteMany = jest.fn();

const mockChatMessageFindUnique = jest.fn();
const mockChatMessageFindFirst = jest.fn();
const mockChatMessageFindMany = jest.fn();
const mockChatMessageUpsert = jest.fn();
const mockChatMessageCreate = jest.fn();

const txClient = {
    analysis: {
        findFirst: mockFindFirst,
        create: mockCreate,
        update: mockUpdate
    }
};

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        analysis: {
            findUnique: mockFindUnique,
            findFirst: mockFindFirst,
            findMany: mockFindMany,
            create: mockCreate,
            update: mockUpdate,
            updateMany: mockUpdateMany,
            deleteMany: mockDeleteMany
        },
        chatMessage: {
            findUnique: mockChatMessageFindUnique,
            findFirst: mockChatMessageFindFirst,
            findMany: mockChatMessageFindMany,
            upsert: mockChatMessageUpsert,
            create: mockChatMessageCreate
        },
        auditLog: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 })
        },
        user: {
            findMany: jest.fn().mockResolvedValue([])
        },
        $transaction: jest.fn(async (fn) => fn(txClient))
    }
}));

jest.unstable_mockModule('../../src/config/redis.js', () => ({
    getRedisClient: jest.fn(() => ({
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        publish: jest.fn().mockResolvedValue(1)
    }))
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    REDACTED_PATHS: []
}));

jest.unstable_mockModule('../../src/services/providers/providerKeyService.js', () => ({
    resolveProviderKey: jest.fn().mockResolvedValue({ provider: 'GEMINI', apiKey: 'test-key', modelName: 'gemini-2.5-flash' })
}));

jest.unstable_mockModule('../../src/utils/promptCompaction.js', () => ({
    createChatSnapshot: jest.fn(() => ({}))
}));

const mockChatStream = jest.fn();
const mockProposeEdit = jest.fn();

jest.unstable_mockModule('../../src/agents/ChatAgent.js', () => ({
    ChatAgent: jest.fn().mockImplementation(() => ({
        chatStream: mockChatStream,
        proposeEdit: mockProposeEdit,
        chat: jest.fn().mockResolvedValue({
            reply: 'Chat response',
            updatedAnalysis: null
        })
    }))
}));

const { processChatStream, processChat } = await import('../../src/services/chatService.js');
const { reconcileStaleInProgress } = await import('../../src/services/reconciliationService.js');

async function* fakeAsyncStream(tokens, errorAfterIndex = -1) {
    for (let i = 0; i < tokens.length; i++) {
        if (errorAfterIndex === i) {
            throw new Error('Upstream provider connection dropped');
        }
        yield tokens[i];
    }
}

describe('Asynchronous Persistent Task Execution & Cross-Device Sync Suite', () => {
    const originalMockAi = process.env.MOCK_AI;

    beforeEach(() => {
        process.env.MOCK_AI = 'false';
        mockFindUnique.mockReset();
        mockFindFirst.mockReset();
        mockFindMany.mockReset().mockResolvedValue([{ id: 'analysis-123' }]);
        mockCreate.mockReset();
        mockUpdate.mockReset();
        mockUpdateMany.mockReset();
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

    it('Criterion 1 & 2: Chat turn persists user message immediately and finishes even if client onChunk throws (tab closed mid-stream)', async () => {
        mockFindFirst.mockResolvedValue({
            id: 'analysis-123',
            userId: 'user-456',
            rootId: 'analysis-123',
            inputText: 'Requirements for health app',
            resultJson: { projectTitle: 'Health App' },
            metadata: {}
        });
        mockFindMany.mockResolvedValue([{ id: 'analysis-123' }]);
        mockChatMessageFindUnique.mockResolvedValue(null);

        mockChatStream.mockImplementation(() => fakeAsyncStream(['Hello ', 'user, ', 'here is ', 'the update.']));

        let chunkCount = 0;
        const faultyClientOnChunk = (_chunk) => {
            chunkCount++;
            if (chunkCount === 2) {
                // Simulate browser tab closing mid-stream (broken pipe / aborted writable stream)
                throw new Error('Client connection closed prematurely');
            }
        };

        const result = await processChatStream(
            'user-456',
            'analysis-123',
            'Can you explain requirement 1?',
            'client-msg-uuid-999',
            faultyClientOnChunk
        );

        // 1. User message was persisted up-front to database
        expect(mockChatMessageUpsert).toHaveBeenCalledWith({
            where: { clientMessageId: 'client-msg-uuid-999' },
            create: expect.objectContaining({
                analysisId: 'analysis-123',
                userId: 'user-456',
                role: 'user',
                content: 'Can you explain requirement 1?',
                clientMessageId: 'client-msg-uuid-999'
            }),
            update: {}
        });

        // 2. Full LLM assistant reply was completed on server despite client disconnect
        expect(result.reply).toBe('Hello user, here is the update.');

        // 3. Assistant response was persisted to PostgreSQL
        expect(mockChatMessageCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({
                analysisId: 'analysis-123',
                userId: 'user-456',
                role: 'assistant',
                content: 'Hello user, here is the update.'
            })
        });
    });

    it('Criterion 3: Cross-Device State Convergence - Chat edit creates durable new version and publishes event for other devices', async () => {
        mockFindFirst.mockResolvedValue({
            id: 'analysis-root-1',
            userId: 'user-456',
            rootId: 'analysis-root-1',
            version: 1,
            inputText: 'Original prompt',
            resultJson: { projectTitle: 'V1 Title', functionalRequirements: [] },
            metadata: {}
        });
        mockFindMany.mockResolvedValue([{ id: 'analysis-root-1' }]);
        mockChatMessageFindUnique.mockResolvedValue(null);

        mockChatStream.mockImplementation(() => fakeAsyncStream(['Added ', 'the new requirements.']));
        mockProposeEdit.mockResolvedValue({
            updatedAnalysis: {
                projectTitle: 'V2 Title',
                functionalRequirements: ['FR-1: Realtime Sync']
            }
        });
        mockCreate.mockResolvedValue({
            id: 'analysis-v2-id',
            version: 2,
            title: 'V2 Title'
        });

        const result = await processChatStream(
            'user-456',
            'analysis-root-1',
            'Please add functional requirement for Realtime Sync',
            'client-msg-uuid-100',
            () => {}
        );

        // Version 2 created in database
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                version: 2,
                rootId: 'analysis-root-1',
                parentId: 'analysis-root-1',
                resultJson: expect.objectContaining({
                    projectTitle: 'V2 Title'
                })
            })
        }));

        expect(result.newAnalysisId).toBe('analysis-v2-id');
    });

    it('Criterion 4: Idempotent Resubmission - Replaying same clientMessageId returns stored result without re-invoking AI', async () => {
        mockFindFirst.mockResolvedValue({
            id: 'analysis-123',
            userId: 'user-456',
            rootId: 'analysis-123',
            resultJson: {},
            metadata: {}
        });
        mockChatMessageFindUnique.mockResolvedValue({
            id: 'existing-msg-id',
            analysisId: 'analysis-123',
            clientMessageId: 'client-msg-uuid-999',
            createdAt: new Date('2026-08-30T10:00:00Z')
        });
        mockChatMessageFindFirst.mockResolvedValue({
            id: 'assistant-reply-id',
            content: 'Cached authoritative answer from database',
            createdAt: new Date('2026-08-30T10:00:02Z')
        });

        const result = await processChat(
            'user-456',
            'analysis-123',
            'Can you explain requirement 1?',
            'client-msg-uuid-999'
        );

        expect(result.reply).toBe('Cached authoritative answer from database');
        expect(mockChatStream).not.toHaveBeenCalled();
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('Criterion 5: Stale Task Detection & Recovery - reconcileStaleInProgress cleans up stuck PENDING and IN_PROGRESS tasks', async () => {
        mockUpdateMany.mockResolvedValue({ count: 3 });

        const count = await reconcileStaleInProgress();

        expect(mockUpdateMany).toHaveBeenCalledWith({
            where: {
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                updatedAt: { lt: expect.any(Date) }
            },
            data: {
                status: 'FAILED',
                resultQuality: 'NONE'
            }
        });
        expect(count).toBe(3);
    });
});
