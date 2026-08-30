import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { hook, findGitRoot, SRA_HOOK_START } from '../src/commands/hook.js';

const originalCwd = process.cwd();
let workdir;

beforeEach(async () => {
    workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'sra-hook-'));
    process.chdir(workdir);
    process.exitCode = 0;
});

afterAll(async () => {
    process.chdir(originalCwd);
    process.exitCode = 0;
});

describe('git hook automation', () => {
    test('finds git root correctly when .git exists', async () => {
        await fs.mkdir(path.join(workdir, '.git'));
        const subDir = path.join(workdir, 'src', 'deep');
        await fs.mkdir(subDir, { recursive: true });

        const root = await findGitRoot(subDir);
        expect(root).toBe(path.join(workdir, '.git'));
    });

    test('returns error when not in a git repository', async () => {
        await hook('install');
        expect(process.exitCode).toBe(1);
    });

    test('installs pre-commit hook in a git repository', async () => {
        await fs.mkdir(path.join(workdir, '.git'));

        await hook('install');
        expect(process.exitCode).toBe(0);

        const hookPath = path.join(workdir, '.git', 'hooks', 'pre-commit');
        const content = await fs.readFile(hookPath, 'utf8');
        expect(content).toContain(SRA_HOOK_START);
        expect(content).toContain('sra check --strict');
    });

    test('is idempotent when installed multiple times', async () => {
        await fs.mkdir(path.join(workdir, '.git'));

        await hook('install');
        await hook('install');

        const hookPath = path.join(workdir, '.git', 'hooks', 'pre-commit');
        const content = await fs.readFile(hookPath, 'utf8');
        const occurrences = (content.match(new RegExp(SRA_HOOK_START, 'g')) || []).length;
        expect(occurrences).toBe(1);
    });

    test('uninstalls pre-commit hook cleanly', async () => {
        await fs.mkdir(path.join(workdir, '.git'));

        await hook('install');
        await hook('uninstall');

        const hookPath = path.join(workdir, '.git', 'hooks', 'pre-commit');
        let exists = true;
        try {
            await fs.stat(hookPath);
        } catch {
            exists = false;
        }
        expect(exists).toBe(false);
    });
});
