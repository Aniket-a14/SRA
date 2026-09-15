import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * projectController had no test coverage at all before this. Covers the
 * assertOwned-based 404 boundary added on getProject/updateProject/deleteProject,
 * since that's a behavior change (was an inline `record.userId !== req.user.userId`
 * check per handler) — see src/utils/ownership.js.
 */

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: {
        project: {
            findUnique: mockFindUnique,
            update: mockUpdate,
            delete: mockDelete,
        }
    }
}));

jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    REDACTED_PATHS: []
}));

const { getProject, updateProject, deleteProject } = await import('../../src/controllers/projectController.js');

const OWNER = 'user-owner';
const INTRUDER = 'user-intruder';
const PROJECT_ID = 'p1';

function makeReq(userId, body = {}) {
    return { params: { id: PROJECT_ID }, user: { userId }, body };
}

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('projectController ownership boundary', () => {
    let next;

    beforeEach(() => {
        mockFindUnique.mockReset();
        mockUpdate.mockReset();
        mockDelete.mockReset();
        next = jest.fn();
    });

    describe('getProject', () => {
        it('returns the project to its owner', async () => {
            mockFindUnique.mockResolvedValue({ id: PROJECT_ID, userId: OWNER, analyses: [] });
            const res = makeRes();

            await getProject(makeReq(OWNER), res, next);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(next).not.toHaveBeenCalled();
        });

        it('404s a non-owner without a distinct 403', async () => {
            mockFindUnique.mockResolvedValue({ id: PROJECT_ID, userId: OWNER, analyses: [] });
            const res = makeRes();

            await getProject(makeReq(INTRUDER), res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, message: 'Project not found' }));
            expect(res.status).not.toHaveBeenCalled();
        });

        it('404s a missing project', async () => {
            mockFindUnique.mockResolvedValue(null);
            const res = makeRes();

            await getProject(makeReq(OWNER), res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, message: 'Project not found' }));
        });
    });

    describe('updateProject', () => {
        it('404s a non-owner before touching prisma.update', async () => {
            mockFindUnique.mockResolvedValue({ id: PROJECT_ID, userId: OWNER });
            const res = makeRes();

            await updateProject(makeReq(INTRUDER, { name: 'New name' }), res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
            expect(mockUpdate).not.toHaveBeenCalled();
        });
    });

    describe('deleteProject', () => {
        it('404s a non-owner before touching prisma.delete', async () => {
            mockFindUnique.mockResolvedValue({ id: PROJECT_ID, userId: OWNER });
            const res = makeRes();

            await deleteProject(makeReq(INTRUDER), res, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
            expect(mockDelete).not.toHaveBeenCalled();
        });
    });
});
