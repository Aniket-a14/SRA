import chalk from 'chalk';
import { api, describeError } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';

const STATUS_COLOR = {
    COMPLETED: chalk.green,
    FAILED: chalk.red,
    IN_PROGRESS: chalk.cyan,
    PENDING: chalk.yellow
};

const paint = (status) => (STATUS_COLOR[status] || chalk.gray)(status || '—');
const truncate = (text, max) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text || '');
const unwrap = (response) => (Array.isArray(response) ? response : response?.data || []);

/**
 * List the analyses on the account — the same set the web app's history rail shows.
 *
 * @param {{ limit?: string, json?: boolean }} [options]
 */
export async function list(options = {}) {
    logger.setJsonMode(options.json);

    let analyses;
    try {
        analyses = unwrap(await api.get('/api/analyze'));
    } catch (error) {
        logger.error('Could not fetch analyses', describeError(error));
        process.exitCode = 1;
        return;
    }

    if (analyses.length === 0) {
        logger.info('No analyses yet. Start one with `sra analyze <file>` or `sra reverse`.');
        if (options.json) logger.json([]);
        return;
    }

    const limit = Number(options.limit) > 0 ? Number(options.limit) : 20;
    const shown = analyses.slice(0, limit);
    const { analysisId: linked } = await configManager.load();

    logger.raw('');
    logger.table(
        shown.map(a => [
            a.id === linked ? chalk.green('●') : ' ',
            a.id,
            `v${a.version ?? '?'}`,
            paint(a.status),
            truncate(a.title || a.inputPreview || 'Untitled', 44),
            new Date(a.createdAt).toLocaleDateString()
        ]),
        ['', 'ID', 'VER', 'STATUS', 'TITLE', 'CREATED']
    );
    logger.raw('');

    if (analyses.length > shown.length) {
        logger.info(`Showing ${shown.length} of ${analyses.length}. Use --limit to see more.`);
    }
    if (linked) logger.info(`${chalk.green('●')} marks the analysis linked to this folder.`);

    if (options.json) logger.json(shown);
}

/**
 * List projects on the account.
 *
 * @param {{ json?: boolean }} [options]
 */
export async function projects(options = {}) {
    logger.setJsonMode(options.json);

    let items;
    try {
        items = unwrap(await api.get('/api/projects'));
    } catch (error) {
        logger.error('Could not fetch projects', describeError(error));
        process.exitCode = 1;
        return;
    }

    if (items.length === 0) {
        logger.info('No projects yet. The platform creates one automatically on your first analysis.');
        if (options.json) logger.json([]);
        return;
    }

    const { projectId: linked } = await configManager.load();

    logger.raw('');
    logger.table(
        items.map(p => [
            p.id === linked ? chalk.green('●') : ' ',
            p.id,
            truncate(p.name, 40),
            truncate(p.description || '', 46)
        ]),
        ['', 'ID', 'NAME', 'DESCRIPTION']
    );
    logger.raw('');

    if (options.json) logger.json(items);
}
