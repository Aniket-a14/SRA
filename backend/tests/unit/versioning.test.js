import { describe, it, expect, jest } from '@jest/globals';
import { Prisma } from '../../src/generated/prisma/index.js';
import { createNextVersion } from '../../src/services/versioning.js';

function versionCollisionError() {
    return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['rootId', 'version'] }
    });
}

describe('createNextVersion', () => {
    it('creates version = max(version)+1 on the first attempt when there is no race', async () => {
        const tx = {
            analysis: {
                findFirst: jest.fn().mockResolvedValue({ version: 3 }),
                create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-id', ...data }))
            }
        };

        const result = await createNextVersion(tx, 'root-1', (version) => ({ version, title: `v${version}` }));

        expect(tx.analysis.create).toHaveBeenCalledTimes(1);
        expect(tx.analysis.create).toHaveBeenCalledWith({ data: { version: 4, title: 'v4' } });
        expect(result.version).toBe(4);
    });

    it('retries with a freshly re-read max version on a rootId/version collision', async () => {
        const tx = {
            analysis: {
                findFirst: jest.fn()
                    .mockResolvedValueOnce({ version: 3 }) // first read: stale, someone else already took v4
                    .mockResolvedValueOnce({ version: 4 }), // re-read after collision
                create: jest.fn()
                    .mockRejectedValueOnce(versionCollisionError())
                    .mockImplementationOnce(({ data }) => Promise.resolve({ id: 'new-id', ...data }))
            }
        };

        const result = await createNextVersion(tx, 'root-1', (version) => ({ version }));

        expect(tx.analysis.create).toHaveBeenCalledTimes(2);
        expect(tx.analysis.create).toHaveBeenNthCalledWith(1, { data: { version: 4 } });
        expect(tx.analysis.create).toHaveBeenNthCalledWith(2, { data: { version: 5 } });
        expect(result.version).toBe(5);
    });

    it('rethrows immediately on a non-collision error without retrying', async () => {
        const boom = new Error('DB is down');
        const tx = {
            analysis: {
                findFirst: jest.fn().mockResolvedValue({ version: 1 }),
                create: jest.fn().mockRejectedValue(boom)
            }
        };

        await expect(createNextVersion(tx, 'root-1', (version) => ({ version }))).rejects.toThrow('DB is down');
        expect(tx.analysis.create).toHaveBeenCalledTimes(1);
    });

    it('gives up after exhausting retries on repeated collisions', async () => {
        const tx = {
            analysis: {
                findFirst: jest.fn().mockResolvedValue({ version: 1 }),
                create: jest.fn().mockRejectedValue(versionCollisionError())
            }
        };

        await expect(createNextVersion(tx, 'root-1', (version) => ({ version }))).rejects.toThrow();
    });
});
