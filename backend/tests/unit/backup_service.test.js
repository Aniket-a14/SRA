import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// 1. Mock child_process and fs/promises using unstable_mockModule for ESM compliance
jest.unstable_mockModule('child_process', () => ({
    execFile: jest.fn((cmd, args, options, cb) => {
        if (typeof args === 'function') {
            cb = args;
        } else if (typeof options === 'function') {
            cb = options;
        }
        cb(null, { stdout: 'mock_stdout', stderr: '' });
    }),
    exec: jest.fn((cmd, options, cb) => {
        if (typeof options === 'function') {
            cb = options;
        }
        cb(null, { stdout: 'mock_stdout', stderr: '' });
    })
}));

jest.unstable_mockModule('fs/promises', () => {
    const mockFs = {
        mkdir: jest.fn(() => Promise.resolve()),
        writeFile: jest.fn(() => Promise.resolve()),
        unlink: jest.fn(() => Promise.resolve()),
        stat: jest.fn(() => Promise.resolve({ size: 1024 * 1024 })),
        readFile: jest.fn(() => Promise.resolve(Buffer.from('mock_file_content'))),
        readdir: jest.fn(() => Promise.resolve([]))
    };
    return {
        ...mockFs,
        default: mockFs
    };
});

// 2. Dynamically import the mocked modules and backupService
const { execFile } = await import('child_process');
const { default: backupService } = await import('../../src/services/backupService.js');

const POOLER = 'postgresql://postgres.testref:pwd@aws-1.supabase.com:6543/postgres?pgbouncer=true';
const DIRECT = 'postgresql://postgres.testref:pwd@aws-1.supabase.com:5432/postgres';

describe('BackupService Unit Tests', () => {
    let originalEnv;
    let originalPlatform;

    beforeEach(() => {
        originalEnv = { ...process.env };
        originalPlatform = process.platform;
        jest.clearAllMocks();
        Object.defineProperty(process, 'platform', { value: 'linux' });

        jest.spyOn(backupService, 'logBackupMetadata').mockImplementation(() => Promise.resolve());
        jest.spyOn(backupService, 'calculateChecksum').mockImplementation(() => Promise.resolve('mock_checksum'));
        // Covered by its own describe block below; stubbed here so the argument assertions
        // see only the pg_dump call itself.
        jest.spyOn(backupService, 'assertDumpClientIsCompatible').mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        jest.restoreAllMocks();
    });

    it('builds the pg_dump command from the connection URL', async () => {
        process.env.DIRECT_URL = DIRECT;
        delete process.env.DATABASE_URL;

        await backupService.createBackup();

        expect(execFile).toHaveBeenCalled();
        const [command, args, options] = execFile.mock.calls[0];
        expect(command).toBe('pg_dump');
        expect(args).toEqual(expect.arrayContaining(['-h', 'aws-1.supabase.com']));
        expect(args).toEqual(expect.arrayContaining(['-p', '5432']));
        expect(args).toEqual(expect.arrayContaining(['-U', 'postgres.testref']));
        expect(options.env.PGPASSWORD).toBe('pwd');
    });

    it('prioritises DIRECT_URL over DATABASE_URL', async () => {
        process.env.DATABASE_URL = POOLER;
        process.env.DIRECT_URL = DIRECT;

        await backupService.createBackup();

        expect(execFile.mock.calls[0][1]).toEqual(expect.arrayContaining(['-p', '5432']));
    });

    it('defaults to port 5432 when the URL omits one', async () => {
        process.env.DIRECT_URL = 'postgresql://postgres.testref:pwd@aws-1.supabase.com/postgres';
        delete process.env.DATABASE_URL;

        await backupService.createBackup();

        expect(execFile.mock.calls[0][1]).toEqual(expect.arrayContaining(['-p', '5432']));
    });
});

/**
 * The transaction pooler is not a fallback — it is not a target at all.
 *
 * Two earlier tests here asserted the opposite: that a dump could be built against port
 * 6543, and that a failed DIRECT_URL should retry onto it. Both were wrong. PgBouncer in
 * transaction mode cannot serve pg_dump; it rejects the attempt during authentication with
 * "tenant/user not found", which reads like a credentials fault. The scheduled backup
 * really did fail this way every week for five weeks, and the pooler retry is what buried
 * the true error — the previous attempt's failure was overwritten by the pooler's.
 */
describe('BackupService: transaction pooler is never a dump target', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        jest.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    it('drops the pooler URL when a direct URL is also configured', () => {
        process.env.DIRECT_URL = DIRECT;
        process.env.DATABASE_URL = POOLER;

        expect(backupService.resolveDumpTargets()).toEqual([DIRECT]);
    });

    it('refuses outright when only the pooler is configured, naming the fix', () => {
        delete process.env.DIRECT_URL;
        process.env.DATABASE_URL = POOLER;

        expect(() => backupService.resolveDumpTargets()).toThrow(/transaction pooler/);
        expect(() => backupService.resolveDumpTargets()).toThrow(/DIRECT_URL/);
    });

    it('reports a missing configuration distinctly from an unusable one', () => {
        delete process.env.DIRECT_URL;
        delete process.env.DATABASE_URL;

        expect(() => backupService.resolveDumpTargets()).toThrow(/Neither DIRECT_URL nor DATABASE_URL/);
    });

    it('deduplicates when both variables hold the same direct URL', () => {
        process.env.DIRECT_URL = DIRECT;
        process.env.DATABASE_URL = DIRECT;

        expect(backupService.resolveDumpTargets()).toEqual([DIRECT]);
    });
});

/**
 * pg_dump refuses any server newer than itself. The scheduled backup broke precisely here:
 * the runner installed client 16 against a server that had moved to 17.
 */
describe('BackupService: pg_dump/server version preflight', () => {
    // The callback's second argument is the `{stdout, stderr}` object, matching this
    // file's top-level mock: a bare jest.fn() carries no util.promisify.custom symbol, so
    // promisify resolves it to that single value rather than splitting the two streams.
    const mockVersions = (clientOut, serverOut) => {
        execFile.mockImplementation((cmd, args, options, cb) => {
            if (typeof args === 'function') cb = args;
            else if (typeof options === 'function') cb = options;

            if (cmd === 'pg_dump') return cb(null, { stdout: clientOut, stderr: '' });
            if (cmd === 'psql') {
                if (serverOut instanceof Error) return cb(serverOut);
                return cb(null, { stdout: serverOut, stderr: '' });
            }
            return cb(null, { stdout: '', stderr: '' });
        });
    };

    beforeEach(() => jest.clearAllMocks());
    afterEach(() => jest.restoreAllMocks());

    it('rejects an older client, naming the package that fixes it', async () => {
        mockVersions('pg_dump (PostgreSQL) 16.14 (Ubuntu 16.14-1.pgdg24.04+1)\n', '17.6\n');

        await expect(backupService.assertDumpClientIsCompatible(DIRECT))
            .rejects.toThrow(/pg_dump 16 cannot dump a PostgreSQL 17 server/);
        await expect(backupService.assertDumpClientIsCompatible(DIRECT))
            .rejects.toThrow(/postgresql-client-17/);
    });

    it('accepts a matching client', async () => {
        mockVersions('pg_dump (PostgreSQL) 17.6\n', '17.6\n');
        await expect(backupService.assertDumpClientIsCompatible(DIRECT)).resolves.toBeUndefined();
    });

    it('accepts a newer client — pg_dump only refuses the reverse', async () => {
        mockVersions('pg_dump (PostgreSQL) 18.3\n', '17.6\n');
        await expect(backupService.assertDumpClientIsCompatible(DIRECT)).resolves.toBeUndefined();
    });

    it('proceeds when the server version cannot be read, rather than blocking the backup', async () => {
        mockVersions('pg_dump (PostgreSQL) 17.6\n', new Error('psql: could not connect'));
        await expect(backupService.assertDumpClientIsCompatible(DIRECT)).resolves.toBeUndefined();
    });

    it('fails clearly when pg_dump is not installed at all', async () => {
        execFile.mockImplementation((cmd, args, options, cb) => {
            if (typeof args === 'function') cb = args;
            else if (typeof options === 'function') cb = options;
            cb(new Error('spawn pg_dump ENOENT'));
        });

        await expect(backupService.assertDumpClientIsCompatible(DIRECT))
            .rejects.toThrow(/pg_dump is not installed/);
    });
});

describe('BackupService: failure reporting', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        jest.clearAllMocks();
        Object.defineProperty(process, 'platform', { value: 'linux' });
        jest.spyOn(backupService, 'assertDumpClientIsCompatible').mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    it('names the host, port and reason when a dump fails', async () => {
        process.env.DIRECT_URL = DIRECT;
        delete process.env.DATABASE_URL;

        execFile.mockImplementation((cmd, args, options, cb) => {
            if (typeof args === 'function') cb = args;
            else if (typeof options === 'function') cb = options;
            const error = new Error('Command failed');
            error.stderr = 'pg_dump: error: aborting because of server version mismatch\n';
            cb(error);
        });

        // Previously only the last attempt's error survived, so a run could report a cause
        // that belonged to a different target entirely.
        await expect(backupService.createBackup()).rejects.toThrow(/aws-1\.supabase\.com:5432/);
        await expect(backupService.createBackup()).rejects.toThrow(/server version mismatch/);
    });
});
