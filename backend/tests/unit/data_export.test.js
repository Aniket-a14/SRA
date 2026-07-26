import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/**
 * The export is the densest collection of one user's personal data the API will ever
 * produce, so what it must NOT contain matters more than what it does.
 *
 * These assert on the Prisma `select` clauses rather than on the returned object, because a
 * mock returns only what it is told to. Asserting the shape of the result would pass against
 * a query that asks the database for the refresh token and merely happens not to be handed
 * one by the mock.
 */

const findMany = () => jest.fn().mockResolvedValue([]);

const mockUserFindUnique = jest.fn();
const mockProjectFindMany = findMany();
const mockAnalysisFindMany = findMany();
const mockSessionFindMany = findMany();
const mockAccountFindMany = findMany();
const mockApiKeyFindMany = findMany();
const mockProviderKeyFindMany = findMany();
const mockChatFindMany = findMany();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        user: { findUnique: mockUserFindUnique },
        project: { findMany: mockProjectFindMany },
        analysis: { findMany: mockAnalysisFindMany },
        session: { findMany: mockSessionFindMany },
        account: { findMany: mockAccountFindMany },
        apiKey: { findMany: mockApiKeyFindMany },
        userProviderKey: { findMany: mockProviderKeyFindMany },
        chatMessage: { findMany: mockChatFindMany }
    }
}));

const USER_ID = 'user-1';

beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, email: 'a@example.com', name: 'A', image: null, createdAt: new Date(0) });
    [mockProjectFindMany, mockAnalysisFindMany, mockSessionFindMany, mockAccountFindMany,
        mockApiKeyFindMany, mockProviderKeyFindMany, mockChatFindMany].forEach(m => m.mockResolvedValue([]));
});

const selectOf = (mock) => mock.mock.calls[0][0].select;
const whereOf = (mock) => mock.mock.calls[0][0].where;

describe('exportUserData never exports a usable credential', () => {
    it('omits the session refresh token while keeping the session metadata', async () => {
        const { exportUserData } = await import('../../src/services/auth/dataExportService.js');
        await exportUserData(USER_ID);

        const select = selectOf(mockSessionFindMany);
        // `Session.token` IS the refresh credential — present in an export file, it is a
        // durable account takeover for anyone who later reads that file.
        expect(select.token).toBeUndefined();
        expect(select.ipAddress).toBe(true);
    });

    it('omits the password hash from the user record', async () => {
        const { exportUserData } = await import('../../src/services/auth/dataExportService.js');
        await exportUserData(USER_ID);

        expect(selectOf(mockUserFindUnique).password).toBeUndefined();
    });

    it('omits provider-key ciphertext, exporting only the mask', async () => {
        const { exportUserData } = await import('../../src/services/auth/dataExportService.js');
        await exportUserData(USER_ID);

        const select = selectOf(mockProviderKeyFindMany);
        expect(select.encryptedKey).toBeUndefined();
        expect(select.maskedKey).toBe(true);
    });

    it('omits the stored API-key hash', async () => {
        const { exportUserData } = await import('../../src/services/auth/dataExportService.js');
        await exportUserData(USER_ID);

        expect(selectOf(mockApiKeyFindMany).key).toBeUndefined();
    });

    it('omits encrypted OAuth access/refresh tokens from linked accounts', async () => {
        const { exportUserData } = await import('../../src/services/auth/dataExportService.js');
        await exportUserData(USER_ID);

        const select = selectOf(mockAccountFindMany);
        expect(select.access_token).toBeUndefined();
        expect(select.refresh_token).toBeUndefined();
        expect(select.provider).toBe(true);
    });
});

describe('exportUserData is self-service, not an admin tool', () => {
    it('scopes every collection to the requesting user', async () => {
        const { exportUserData } = await import('../../src/services/auth/dataExportService.js');
        await exportUserData(USER_ID);

        expect(whereOf(mockUserFindUnique)).toEqual({ id: USER_ID });
        for (const mock of [mockProjectFindMany, mockAnalysisFindMany, mockSessionFindMany,
            mockAccountFindMany, mockApiKeyFindMany, mockProviderKeyFindMany]) {
            expect(whereOf(mock)).toEqual({ userId: USER_ID });
        }
    });

    it('reaches chat messages only through the caller\'s own analyses', async () => {
        const { exportUserData } = await import('../../src/services/auth/dataExportService.js');
        mockAnalysisFindMany.mockResolvedValue([{ id: 'an-1' }, { id: 'an-2' }]);

        await exportUserData(USER_ID);

        expect(whereOf(mockChatFindMany)).toEqual({ analysisId: { in: ['an-1', 'an-2'] } });
    });

    it('skips the chat query entirely when the user has no analyses', async () => {
        const { exportUserData } = await import('../../src/services/auth/dataExportService.js');

        await exportUserData(USER_ID);

        // `{ in: [] }` would be harmless, but not issuing the query at all is what keeps an
        // empty account from touching the largest table in the schema.
        expect(mockChatFindMany).not.toHaveBeenCalled();
    });

    it('404s for a user that does not exist', async () => {
        const { exportUserData } = await import('../../src/services/auth/dataExportService.js');
        mockUserFindUnique.mockResolvedValue(null);

        await expect(exportUserData('nobody')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('includes the user\'s own authored content in full — redacting it would defeat portability', async () => {
        const { exportUserData } = await import('../../src/services/auth/dataExportService.js');
        await exportUserData(USER_ID);

        const select = selectOf(mockAnalysisFindMany);
        expect(select.inputText).toBe(true);
        expect(select.resultJson).toBe(true);
    });
});
