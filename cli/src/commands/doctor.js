import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';
import { api, describeError, DEFAULT_BACKEND_URL } from '../api/api-client.js';
import { specExists, readSpec } from '../lib/spec.js';
import { fetchFormats } from '../lib/formats.js';
import { CLI_VERSION } from '../lib/version.js';

const execFileAsync = promisify(execFile);
const MIN_NODE_MAJOR = 18;

/**
 * Diagnose the local setup and its connection to the platform.
 *
 * Reports a non-zero exit when something is actually broken, so it can gate a CI step —
 * warnings (an unlinked folder, no spec yet) are informational and do not fail.
 *
 * @param {{ json?: boolean }} [options]
 */
export async function doctor(options = {}) {
    logger.setJsonMode(options.json);

    const checks = [];
    const record = (name, level, detail) => {
        checks.push({ name, level, detail });
        const emit = level === 'ok' ? logger.success : level === 'warn' ? logger.warn : logger.error;
        emit.call(logger, `${name}: ${detail}`);
    };

    logger.info('Running SRA diagnostics...');
    logger.raw('');

    // --- Environment -----------------------------------------------------------------
    const nodeMajor = Number(process.version.replace('v', '').split('.')[0]);
    record(
        'Node.js',
        nodeMajor >= MIN_NODE_MAJOR ? 'ok' : 'error',
        nodeMajor >= MIN_NODE_MAJOR ? process.version : `${process.version} — the CLI requires >= ${MIN_NODE_MAJOR}`
    );
    record('CLI version', 'ok', CLI_VERSION);

    // git backs the codebase scan: outside a repo, `reverse` and `check --suggest` fall
    // back to a walk that can't honour .gitignore.
    try {
        await execFileAsync('git', ['rev-parse', '--is-inside-work-tree']);
        record('Git repository', 'ok', 'detected — scans will respect .gitignore');
    } catch {
        record('Git repository', 'warn', 'not a git repository — codebase scans fall back to a heuristic ignore list');
    }

    // --- Local state -----------------------------------------------------------------
    const config = await configManager.load();
    const backendUrl = config.backendUrl || process.env.SRA_BACKEND_URL || DEFAULT_BACKEND_URL;

    if (await configManager.exists()) {
        record('Local config', 'ok', `sra.config.json → analysis ${config.analysisId || 'not linked'}`);
    } else {
        record('Local config', 'warn', "not found — run 'sra init'");
    }
    record('Backend URL', 'ok', backendUrl);

    if (await specExists()) {
        try {
            const spec = await readSpec();
            record('Requirement manifest', 'ok', `sra.spec.json — ${spec.features?.length || 0} group(s), ${spec.formatName || spec.formatId || 'unknown format'} v${spec.version}`);
        } catch (error) {
            record('Requirement manifest', 'error', `sra.spec.json is not valid JSON (${error.message})`);
        }
    } else {
        record('Requirement manifest', 'warn', "not found — run 'sra sync'");
    }

    // --- Credentials -----------------------------------------------------------------
    const token = config.token || process.env.SRA_API_KEY;
    if (!token) {
        record('Platform API key', 'error', 'missing — set SRA_API_KEY (generate one in the web app under Settings)');
    } else if (!token.startsWith('sra_live_')) {
        record('Platform API key', 'warn', 'present, but not in the sra_live_ format — this may be a short-lived session JWT');
    } else {
        record('Platform API key', 'ok', `present (${token.slice(0, 13)}…)`);
    }

    // --- Connectivity ----------------------------------------------------------------
    let authed = false;
    try {
        const health = await api.get('/api/health');
        const services = (health?.data || health)?.services || {};
        const degraded = Object.entries(services).filter(([, state]) => state !== 'UP' && state !== 'CONFIGURED');
        record(
            'Backend health',
            degraded.length === 0 ? 'ok' : 'warn',
            degraded.length === 0
                ? 'all services reporting healthy'
                : `degraded — ${degraded.map(([svc, state]) => `${svc}=${state}`).join(', ')}`
        );
    } catch (error) {
        record('Backend health', 'error', describeError(error));
    }

    try {
        const me = await api.get('/api/auth/me');
        const user = me?.data || me;
        record('Authentication', 'ok', `signed in as ${user.email || user.id}`);
        authed = true;
    } catch (error) {
        record('Authentication', 'error', describeError(error));
    }

    // --- Platform capability parity --------------------------------------------------
    const { formats, live } = await fetchFormats();
    record(
        'Format registry',
        live ? 'ok' : 'warn',
        live
            ? `${formats.length} format(s) available: ${formats.map(f => f.id).join(', ')}`
            : 'unreachable — the CLI is using its built-in list, which may lag the platform'
    );

    if (authed) await checkProviderKeys(record);

    // --- Verdict ---------------------------------------------------------------------
    const errors = checks.filter(c => c.level === 'error');
    const warnings = checks.filter(c => c.level === 'warn');

    logger.raw('');
    logger.raw('─'.repeat(60));
    if (errors.length === 0 && warnings.length === 0) {
        logger.success('Everything checks out.');
    } else {
        logger.info(`${errors.length} error(s), ${warnings.length} warning(s).`);
    }

    if (options.json) logger.json({ checks, errors: errors.length, warnings: warnings.length });
    if (errors.length > 0) process.exitCode = 1;
}

/**
 * Generation runs entirely on the user's own provider key — the platform key funds
 * embeddings only. Without a key, `sra analyze` and `sra reverse` fail at the point of
 * enqueue, so this is worth surfacing here rather than at the first failed run.
 */
async function checkProviderKeys(record) {
    let keys;
    try {
        const response = await api.get('/api/settings/provider-keys');
        keys = response?.data || response;
    } catch (error) {
        record('Provider keys (BYOK)', 'warn', `could not be read — ${describeError(error)}`);
        return;
    }

    const active = (Array.isArray(keys) ? keys : []).filter(k => k.isActive);

    if (active.length === 0) {
        record('Provider keys (BYOK)', 'error', 'none configured — analyses cannot run. Add one in the web app under Settings.');
        return;
    }

    const described = active.map(k => {
        const models = Array.isArray(k.availableModels) ? k.availableModels.length : 0;
        return `${k.provider} (${k.maskedKey}${models ? `, ${models} model${models === 1 ? '' : 's'}` : ''})`;
    });
    record('Provider keys (BYOK)', 'ok', described.join(', '));

    const modelless = active.filter(k => !Array.isArray(k.availableModels) || k.availableModels.length === 0);
    if (modelless.length > 0) {
        logger.info(`  ${chalk.gray(`└─ ${modelless.map(k => k.provider).join(', ')} has no discovered models — refresh it in Settings.`)}`);
    }
}
