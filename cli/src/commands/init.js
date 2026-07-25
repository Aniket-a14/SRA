import inquirer from 'inquirer';
import chalk from 'chalk';
import { api, describeError, DEFAULT_BACKEND_URL } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';
import { sync } from './sync.js';

const unwrap = (response) => (Array.isArray(response) ? response : response?.data || []);

/**
 * Link this folder to an analysis on the platform.
 *
 * @param {{ analysis?: string, project?: string, backendUrl?: string }} [options]
 */
export async function init(options = {}) {
    logger.info('Initializing SRA connection...');

    const currentConfig = await configManager.load();
    const backendUrl = options.backendUrl || currentConfig.backendUrl || process.env.SRA_BACKEND_URL || DEFAULT_BACKEND_URL;

    if (!currentConfig.token) {
        logger.error('No API key found.');
        logger.info('Generate one in the web app under Settings, then set SRA_API_KEY (a .env file works).');
        process.exitCode = 1;
        return;
    }

    logger.startSpinner('Verifying API key...');
    try {
        const response = await api.get('/api/auth/me');
        const user = response?.data || response;
        logger.stopSpinner(true, `Authenticated as ${user.email || user.id}`);
    } catch (error) {
        logger.stopSpinner(false, 'Could not verify the API key');
        logger.error('Authentication failed', describeError(error));
        process.exitCode = 1;
        return;
    }

    // Non-interactive path: everything needed was passed as flags, so skip the prompts
    // entirely rather than blocking a CI run on a TTY that isn't there.
    if (options.analysis) {
        await configManager.save({ backendUrl, analysisId: options.analysis, projectId: options.project || null });
        logger.success('Linked. Configuration saved to sra.config.json');
        await sync();
        return;
    }

    logger.startSpinner('Fetching your analyses...');
    let analyses;
    try {
        analyses = unwrap(await api.get('/api/analyze'));
        logger.stopSpinner(true, `Found ${analyses.length} analysis/analyses`);
    } catch (error) {
        logger.stopSpinner(false, 'Could not fetch analyses');
        logger.error('Request failed', describeError(error));
        process.exitCode = 1;
        return;
    }

    if (analyses.length === 0) {
        logger.warn('This account has no analyses yet.');
        logger.info(`Create one with ${chalk.bold('sra analyze <file>')}, or generate one from this codebase with ${chalk.bold('sra reverse')}.`);
        return;
    }

    if (!process.stdin.isTTY) {
        logger.error('No analysis selected and no terminal to prompt on. Pass --analysis <id>.');
        process.exitCode = 1;
        return;
    }

    // Projects group analyses on the platform; offering them as a filter keeps a long
    // history navigable and records the real project id, which the old config never did.
    let projectFilter = options.project || null;
    if (!projectFilter) {
        const projects = await fetchProjects();
        if (projects.length > 1) {
            const { chosen } = await inquirer.prompt([{
                type: 'list',
                name: 'chosen',
                message: 'Filter by project:',
                choices: [
                    { name: 'All projects', value: null },
                    ...projects.map(p => ({ name: p.name, value: p.id }))
                ]
            }]);
            projectFilter = chosen;
        }
    }

    // The list endpoint returns the latest version per lineage and omits projectId, so a
    // chosen filter is applied by asking the platform which analyses that project holds.
    let candidates = analyses;
    if (projectFilter) {
        const ids = await fetchProjectAnalysisIds(projectFilter);
        if (ids) candidates = analyses.filter(a => ids.has(a.id));
        if (candidates.length === 0) {
            logger.warn('That project has no analyses yet — showing all instead.');
            candidates = analyses;
            projectFilter = null;
        }
    }

    const { analysisId } = await inquirer.prompt([{
        type: 'list',
        name: 'analysisId',
        message: 'Link this folder to which analysis?',
        pageSize: 15,
        choices: candidates.slice(0, 30).map(a => ({
            name: `${a.title || a.inputPreview || 'Untitled'} — v${a.version} · ${a.status} · ${new Date(a.createdAt).toLocaleDateString()}`,
            value: a.id,
            short: a.title
        }))
    }]);

    const selected = candidates.find(a => a.id === analysisId);
    if (selected && selected.status !== 'COMPLETED') {
        logger.warn(`That analysis is ${selected.status} — there may be no document to sync yet.`);
    }

    await configManager.save({ backendUrl, analysisId, projectId: projectFilter });
    logger.success('Connected. Configuration saved to sra.config.json');
    logger.warn('sra.config.json can hold your API token — it has been added to .gitignore automatically. Do not commit it.');

    logger.info('Auto-syncing spec...');
    await sync();
}

async function fetchProjects() {
    try {
        return unwrap(await api.get('/api/projects'));
    } catch (error) {
        logger.debug(`Projects unavailable: ${describeError(error)}`);
        return [];
    }
}

/** @returns {Promise<Set<string>|null>} analysis ids in the project, or null if unreadable */
async function fetchProjectAnalysisIds(projectId) {
    try {
        const response = await api.get(`/api/projects/${projectId}`);
        const project = response?.data || response;
        const ids = (project?.analyses || []).map(a => a.id);
        return new Set(ids);
    } catch (error) {
        logger.debug(`Could not read project ${projectId}: ${describeError(error)}`);
        return null;
    }
}
