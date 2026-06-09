import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// 1. Mock child_process and fs/promises using unstable_mockModule for ESM compliance
jest.unstable_mockModule('child_process', () => ({
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
const { exec } = await import('child_process');
const { default: backupService } = await import('../../src/services/backupService.js');

describe('BackupService Unit Tests', () => {
    let originalEnv;
    let originalPlatform;

    beforeEach(() => {
        originalEnv = { ...process.env };
        originalPlatform = process.platform;
        jest.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should construct pg_dump command with custom port 6543 from DATABASE_URL', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        process.env.DATABASE_URL = 'postgresql://postgres.testref:pwd@aws-1.supabase.com:6543/postgres?pgbouncer=true';
        delete process.env.DIRECT_URL;

        // Spy on logBackupMetadata to prevent database log operations
        jest.spyOn(backupService, 'logBackupMetadata').mockImplementation(() => Promise.resolve());
        jest.spyOn(backupService, 'calculateChecksum').mockImplementation(() => Promise.resolve('mock_checksum'));

        await backupService.createBackup();

        // Check if exec was called with the correct command containing port 6543
        expect(exec).toHaveBeenCalled();
        const calledCommand = exec.mock.calls[0][0];
        expect(calledCommand).toContain('-p 6543');
        expect(calledCommand).toContain('-h aws-1.supabase.com');
        expect(calledCommand).toContain('-U postgres.testref');
        expect(calledCommand).not.toContain('PGPASS' + 'WORD=');
        const execOptions = exec.mock.calls[0][1];
        expect(execOptions.env.PGPASSWORD).toBe('pwd');
    });

    it('should prioritize DIRECT_URL (port 5432) over DATABASE_URL (port 6543)', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        process.env.DATABASE_URL = 'postgresql://postgres.testref:pwd@aws-1.supabase.com:6543/postgres?pgbouncer=true';
        process.env.DIRECT_URL = 'postgresql://postgres.testref:pwd@aws-1.supabase.com:5432/postgres';

        jest.spyOn(backupService, 'logBackupMetadata').mockImplementation(() => Promise.resolve());
        jest.spyOn(backupService, 'calculateChecksum').mockImplementation(() => Promise.resolve('mock_checksum'));

        await backupService.createBackup();

        // Check if the command was constructed using DIRECT_URL details (port 5432)
        expect(exec).toHaveBeenCalled();
        const calledCommand = exec.mock.calls[0][0];
        expect(calledCommand).toContain('-p 5432');
    });

    it('should default to port 5432 if port is not specified in connection URL', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        process.env.DATABASE_URL = 'postgresql://postgres.testref:pwd@aws-1.supabase.com/postgres';
        delete process.env.DIRECT_URL;

        jest.spyOn(backupService, 'logBackupMetadata').mockImplementation(() => Promise.resolve());
        jest.spyOn(backupService, 'calculateChecksum').mockImplementation(() => Promise.resolve('mock_checksum'));

        await backupService.createBackup();

        expect(exec).toHaveBeenCalled();
        const calledCommand = exec.mock.calls[0][0];
        expect(calledCommand).toContain('-p 5432');
    });

    it('should retry with DATABASE_URL when DIRECT_URL backup command fails', async () => {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        process.env.DIRECT_URL = `postgresql://${'postgres.testref'}:${'pwd'}@invalid-host:5432/postgres`;
        process.env.DATABASE_URL = `postgresql://${'postgres.testref'}:${'pwd'}@aws-1.supabase.com:6543/postgres?pgbouncer=true`;

        exec
            .mockImplementationOnce((cmd, options, cb) => {
                if (typeof options === 'function') cb = options;
                cb(new Error('direct connection failed'));
            })
            .mockImplementation((cmd, options, cb) => {
                if (typeof options === 'function') cb = options;
                cb(null, { stdout: 'mock_stdout', stderr: '' });
            });

        jest.spyOn(backupService, 'logBackupMetadata').mockImplementation(() => Promise.resolve());
        jest.spyOn(backupService, 'calculateChecksum').mockImplementation(() => Promise.resolve('mock_checksum'));

        await backupService.createBackup();

        expect(exec).toHaveBeenCalledTimes(2);
        expect(exec.mock.calls[0][0]).toContain('-h invalid-host');
        expect(exec.mock.calls[1][0]).toContain('-h aws-1.supabase.com');
        expect(exec.mock.calls[1][0]).toContain('-p 6543');
    });
});
