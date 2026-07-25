import fs from 'fs/promises';
import chalk from 'chalk';
import { api, describeError } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';
import { fetchFormats, DEFAULT_FORMAT_ID } from '../lib/formats.js';
import { followAnalysis, describeStage } from '../lib/progress.js';
import { sync } from './sync.js';

const MAX_INPUT_CHARS = 50000;

/** Read the requirement source: a file path, or stdin when given `-` or nothing piped in. */
async function readInput(source) {
    if (source && source !== '-') return fs.readFile(source, 'utf-8');

    if (process.stdin.isTTY) return null;

    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Start an analysis from local text — the CLI equivalent of the web app's composer.
 *
 * @param {string} [source] - file to read, or `-` for stdin
 * @param {{ format?: string, project?: string, provider?: string, model?: string,
 *           profile?: string, depth?: string, strictness?: string,
 *           wait?: boolean, json?: boolean }} [options]
 */
export async function analyze(source, options = {}) {
    logger.setJsonMode(options.json);

    let text;
    try {
        text = await readInput(source);
    } catch (error) {
        logger.error(`Could not read ${source}`, error.message);
        process.exitCode = 1;
        return;
    }

    if (!text || !text.trim()) {
        logger.error('No input. Pass a file path, or pipe text in: sra analyze requirements.md');
        process.exitCode = 1;
        return;
    }

    if (text.length > MAX_INPUT_CHARS) {
        // Checked here rather than letting the server 400: the message names the actual
        // numbers, which a generic validation error would not.
        logger.error(`Input is ${text.length} characters; the platform accepts at most ${MAX_INPUT_CHARS}.`);
        logger.info('Trim the input, or use `sra reverse` if this is a codebase rather than prose.');
        process.exitCode = 1;
        return;
    }

    const { formats, defaultFormatId } = await fetchFormats();
    let format = options.format || defaultFormatId || DEFAULT_FORMAT_ID;
    if (!formats.some(f => f.id === format)) {
        logger.warn(`Unknown format '${format}'. Available: ${formats.map(f => f.id).join(', ')}.`);
        format = defaultFormatId || DEFAULT_FORMAT_ID;
    }

    const settings = { format };
    if (options.profile) settings.profile = options.profile;
    if (options.provider) settings.modelProvider = options.provider;
    if (options.model) settings.modelName = options.model;
    if (options.depth) settings.depth = Number(options.depth);
    if (options.strictness) settings.strictness = Number(options.strictness);

    logger.startSpinner(`Queueing analysis (${format})...`);

    let job;
    try {
        const response = await api.post('/api/analyze', {
            text: text.trim(),
            projectId: options.project || undefined,
            settings
        });
        job = response?.data || response;
    } catch (error) {
        logger.stopSpinner(false, 'Could not start the analysis');
        logger.error('The platform rejected the request', describeError(error));
        if (String(describeError(error)).includes('API key configured')) {
            logger.info('Add your provider key in Settings on the web app, then re-run.');
        }
        process.exitCode = 1;
        return;
    }

    const analysisId = job?.id || job?.jobId;
    if (!analysisId) {
        logger.stopSpinner(false, 'The platform did not return an analysis id.');
        process.exitCode = 1;
        return;
    }

    logger.stopSpinner(true, `Analysis queued (${analysisId}).`);
    await configManager.save({ analysisId, projectId: options.project || null });

    if (job?.reuseFound) {
        logger.info(`Reuse candidate found (${job.reuseType}) — the pipeline will build on existing knowledge.`);
    }

    if (options.wait === false) {
        logger.info(`Running in the background. Follow it with ${chalk.bold('sra status --watch')}.`);
        if (options.json) logger.json({ analysisId, queued: true });
        return;
    }

    logger.startSpinner('Waiting for the pipeline...');
    const outcome = await followAnalysis(analysisId, {
        onStage: (event) => logger.updateSpinner(describeStage(event))
    });

    if (outcome.status !== 'COMPLETED') {
        logger.stopSpinner(false, `Analysis ${outcome.status.toLowerCase()}.`);
        process.exitCode = 1;
        return;
    }

    logger.stopSpinner(true, 'Specification generated.');
    const spec = await sync({ analysis: analysisId });

    if (options.json && spec) {
        logger.json({ analysisId, formatId: spec.formatId, version: spec.version, features: spec.features.length });
    }
}
