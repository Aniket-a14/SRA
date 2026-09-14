import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * loadChatContext's not-found/not-owned branch used to `throw new Error(...)` with no
 * statusCode set, which errorHandler defaults to 500 — a bad analysis id or someone
 * else's analysis both came back as "Internal Server Error" instead of 404.
 */

const mockAnalysisFindFirst = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        analysis: { findFirst: mockAnalysisFindFirst },
        chatMessage: {}
    }
}));

jest.unstable_mockModule('../../src/agents/ChatAgent.js', () => ({
    ChatAgent: jest.fn()
}));

jest.unstable_mockModule('../../src/utils/promptCompaction.js', () => ({
    createChatSnapshot: jest.fn(() => ({}))
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    REDACTED_PATHS: []
}));

const { processChat } = await import('../../src/services/chatService.js');

describe('processChat 404s instead of 500ing on a bad/foreign analysis id', () => {
    beforeEach(() => {
        mockAnalysisFindFirst.mockReset();
    });

    it('scopes the lookup to the caller and 404s when nothing matches', async () => {
        mockAnalysisFindFirst.mockResolvedValue(null);

        const error = await processChat('user-1', 'not-mine-or-missing', 'hello').catch(e => e);

        expect(mockAnalysisFindFirst.mock.calls[0][0].where).toEqual({ id: 'not-mine-or-missing', userId: 'user-1' });
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Analysis not found');
    });
});
