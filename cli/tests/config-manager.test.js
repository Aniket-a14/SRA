import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { configManager } from '../src/config/config-manager.js';

const originalCwd = process.cwd();
const originalKey = process.env.SRA_API_KEY;
let workdir;

const readConfig = async () =>
    JSON.parse(await fs.readFile(path.join(workdir, 'sra.config.json'), 'utf-8'));

beforeEach(async () => {
    workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'sra-config-'));
    process.chdir(workdir);
    delete process.env.SRA_API_KEY;
    delete process.env.SRA_TOKEN;
    configManager.reset();
});

afterAll(() => {
    process.chdir(originalCwd);
    if (originalKey) process.env.SRA_API_KEY = originalKey;
});

describe('config migration', () => {
    test('reads a legacy projectId as the analysis link', async () => {
        // Before the platform had Projects, `projectId` held an analysis id.
        await fs.writeFile('sra.config.json', JSON.stringify({ projectId: 'legacy-analysis-id' }));

        const config = await configManager.load();
        expect(config.analysisId).toBe('legacy-analysis-id');
    });

    test('an explicit analysisId wins over a legacy projectId', async () => {
        await fs.writeFile('sra.config.json', JSON.stringify({
            projectId: 'real-project-id',
            analysisId: 'real-analysis-id'
        }));

        const config = await configManager.load();
        expect(config.analysisId).toBe('real-analysis-id');
        expect(config.projectId).toBe('real-project-id');
    });

    test('returns no link at all for a fresh directory', async () => {
        const config = await configManager.load();
        expect(config.analysisId).toBeNull();
    });
});

describe('token handling', () => {
    test('never writes an environment-supplied token to disk', async () => {
        process.env.SRA_API_KEY = 'sra_live_from_environment';
        configManager.reset();

        await configManager.save({ analysisId: 'a1' });

        const onDisk = await readConfig();
        expect(onDisk.analysisId).toBe('a1');
        // Persisting it would turn a process-scoped secret into a checked-out one.
        expect(onDisk.token).toBeUndefined();
    });

    test('keeps a token that was already stored in the file', async () => {
        await fs.writeFile('sra.config.json', JSON.stringify({ token: 'sra_live_stored' }));
        configManager.reset();

        await configManager.save({ analysisId: 'a1' });

        expect((await readConfig()).token).toBe('sra_live_stored');
    });
});

describe('gitignore protection', () => {
    test('adds the config to .gitignore on first save', async () => {
        await configManager.save({ analysisId: 'a1' });
        expect(await fs.readFile('.gitignore', 'utf-8')).toContain('sra.config.json');
    });

    test('does not duplicate an existing entry', async () => {
        await fs.writeFile('.gitignore', 'node_modules\nsra.config.json\n');
        await configManager.save({ analysisId: 'a1' });

        const contents = await fs.readFile('.gitignore', 'utf-8');
        expect(contents.split('\n').filter(l => l.trim() === 'sra.config.json')).toHaveLength(1);
    });

    test('appends cleanly to a .gitignore with no trailing newline', async () => {
        await fs.writeFile('.gitignore', 'node_modules');
        await configManager.save({ analysisId: 'a1' });

        expect(await fs.readFile('.gitignore', 'utf-8')).toBe('node_modules\nsra.config.json\n');
    });
});
