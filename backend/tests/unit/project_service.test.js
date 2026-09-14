import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const findFirst = jest.fn();
const create = jest.fn();
const info = jest.fn();

jest.unstable_mockModule('../../src/config/prisma.js', () => ({
    default: { project: { findFirst, create } }
}));
jest.unstable_mockModule('../../src/config/logger.js', () => ({
    default: { info }
}));

const { ensureProjectExists } = await import('../../src/services/projectService.js');

describe('ensureProjectExists', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns an explicit project without querying or creating', async () => {
        await expect(ensureProjectExists('user-1', 'project-1', {}, '')).resolves.toBe('project-1');

        expect(findFirst).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });

    it('reuses a same-name project within the requesting user', async () => {
        findFirst.mockResolvedValue({ id: 'existing-project' });

        await expect(ensureProjectExists(
            'user-1',
            undefined,
            { details: { projectName: { content: 'Password Reset' } } },
            'ignored fallback'
        )).resolves.toBe('existing-project');

        expect(findFirst).toHaveBeenCalledWith({
            where: { userId: 'user-1', name: 'Password Reset' }
        });
        expect(create).not.toHaveBeenCalled();
    });

    it('creates a user-owned project when the name is new', async () => {
        findFirst.mockResolvedValue(null);
        create.mockResolvedValue({ id: 'created-project' });

        await expect(ensureProjectExists(
            'user-1',
            null,
            { details: { fullDescription: { content: 'Password reset service\nwith an email link.' } } },
            ''
        )).resolves.toBe('created-project');

        expect(create).toHaveBeenCalledWith({
            data: {
                name: 'Password reset service',
                description: 'Auto-created from analysis',
                userId: 'user-1'
            }
        });
    });
});
