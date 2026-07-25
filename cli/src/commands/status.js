import chalk from 'chalk';
import { api, describeError } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';
import { followAnalysis, describeStage } from '../lib/progress.js';
import { readSpec } from '../lib/spec.js';
import { sync } from './sync.js';

const STATUS_COLOR = {
    COMPLETED: chalk.green,
    FAILED: chalk.red,
    IN_PROGRESS: chalk.cyan,
    PENDING: chalk.yellow,
    DRAFT: chalk.gray
};

const paint = (status) => (STATUS_COLOR[status] || chalk.white)(status || 'UNKNOWN');

/**
 * Report the linked analysis's state, and optionally follow it to completion.
 *
 * @param {{ analysis?: string, watch?: boolean, json?: boolean }} [options]
 */
export async function status(options = {}) {
    logger.setJsonMode(options.json);

    const config = await configManager.load();
    const analysisId = options.analysis || config.analysisId;

    if (!analysisId) {
        logger.error("No analysis linked. Run 'sra init' or 'sra analyze' first.");
        process.exitCode = 1;
        return;
    }

    let analysis;
    try {
        const response = await api.get(`/api/analyze/${analysisId}?mode=sync`);
        analysis = response?.data || response;
    } catch (error) {
        logger.error('Could not fetch the analysis', describeError(error));
        process.exitCode = 1;
        return;
    }

    const summary = {
        analysisId: analysis.id,
        title: analysis.title,
        status: analysis.status,
        resultQuality: analysis.resultQuality,
        version: analysis.version,
        formatId: analysis.resultJson?.formatId || null,
        projectId: analysis.projectId,
        isFinalized: Boolean(analysis.isFinalized),
        updatedAt: analysis.updatedAt
    };

    logger.raw('');
    logger.table([
        ['Analysis', summary.analysisId],
        ['Title', summary.title || '—'],
        ['Status', paint(summary.status)],
        ['Result quality', summary.resultQuality || '—'],
        ['Version', `v${summary.version}`],
        ['Format', summary.formatId || '—'],
        ['Finalized', summary.isFinalized ? 'yes' : 'no'],
        ['Last updated', summary.updatedAt ? new Date(summary.updatedAt).toLocaleString() : '—']
    ]);
    logger.raw('');

    await reportLocalDrift(summary);

    if (summary.resultQuality === 'PARTIAL') {
        logger.warn('Finished with a PARTIAL result — some sections were skipped upstream.');
    }
    if (summary.status === 'FAILED') {
        logger.warn('The run failed. Checkpoints are kept — it can be resumed from the web app.');
    }

    if (!options.watch) {
        if (options.json) logger.json(summary);
        return;
    }

    if (summary.status === 'COMPLETED' || summary.status === 'FAILED') {
        logger.info('Nothing to watch — the run has already finished.');
        if (options.json) logger.json(summary);
        return;
    }

    logger.startSpinner('Following the pipeline...');
    const outcome = await followAnalysis(analysisId, {
        onStage: (event) => logger.updateSpinner(describeStage(event))
    });

    if (outcome.status === 'COMPLETED') {
        logger.stopSpinner(true, 'Analysis complete.');
        await sync({ analysis: analysisId });
    } else {
        logger.stopSpinner(false, `Analysis ${outcome.status.toLowerCase()}.`);
        process.exitCode = 1;
    }

    if (options.json) logger.json({ ...summary, status: outcome.status, resultQuality: outcome.resultQuality });
}

/** Warn when the local spec was taken from an older version than the platform now holds. */
async function reportLocalDrift(summary) {
    let spec;
    try {
        spec = await readSpec();
    } catch {
        logger.info("No local spec yet — run 'sra sync' to pull one.");
        return;
    }

    if (spec.analysisId !== summary.analysisId) {
        logger.warn(`Local spec was synced from a different analysis (${spec.analysisId}).`);
        return;
    }

    if (summary.version && spec.version && summary.version !== spec.version) {
        logger.warn(`Local spec is from v${spec.version}; the platform is at v${summary.version}. Run 'sra sync'.`);
    }
}
