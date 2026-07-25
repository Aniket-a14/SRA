import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { api, describeError } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';
import { scanCodebase, buildDigest, findEvidence } from '../lib/scanner.js';
import { followAnalysis, describeStage } from '../lib/progress.js';
import { fetchFormats, DEFAULT_FORMAT_ID } from '../lib/formats.js';
import { sync } from './sync.js';
import { readSpec, writeSpec } from '../lib/spec.js';

// Only propose a file as evidence when several distinct requirement terms point at it.
// A single common word matching is noise, and pre-filling noise makes `sra check` report
// verifications the developer never made.
const EVIDENCE_MIN_SCORE = 6;
const EVIDENCE_MAX_FILES = 5;

/**
 * Generate a requirements specification from an existing codebase.
 *
 * The codebase is reduced locally to a structural digest — interfaces, entities, module
 * layout, dependencies — and that digest is run through the same multi-agent pipeline the
 * web app uses. Generation deliberately stays server-side: it runs on the user's own
 * provider key under BYOK, so a CLI-local model path would need a second key and would
 * drift from whatever the platform generates.
 *
 * @param {{ path?: string, format?: string, project?: string, notes?: string,
 *           yes?: boolean, dryRun?: boolean, wait?: boolean, json?: boolean,
 *           provider?: string, model?: string }} [options]
 */
export async function reverse(options = {}) {
    logger.setJsonMode(options.json);

    const cwd = path.resolve(options.path || process.cwd());
    logger.info(`Reverse engineering requirements from ${chalk.bold(cwd)}`);

    logger.startSpinner('Scanning codebase...');
    let scan;
    try {
        scan = await scanCodebase({ cwd });
    } catch (error) {
        logger.stopSpinner(false, 'Scan failed');
        logger.error('Could not scan the codebase', error.message);
        process.exitCode = 1;
        return;
    }

    if (scan.sourceFileCount === 0) {
        logger.stopSpinner(false, 'Nothing to analyse');
        logger.error(`No source files found under ${cwd}.`);
        process.exitCode = 1;
        return;
    }

    logger.stopSpinner(true, `Scanned ${scan.sourceFileCount} source files (${scan.fileCount} tracked).`);
    reportScan(scan);

    const digest = buildDigest(scan, { notes: options.notes || '' });

    if (options.dryRun) {
        const target = path.join(cwd, 'sra.digest.txt');
        await fs.writeFile(target, digest);
        logger.success(`Digest written to ${target} (${digest.length} characters). No analysis was started.`);
        if (options.json) logger.json({ dryRun: true, characters: digest.length, file: target });
        return;
    }

    const format = await resolveFormat(options.format);

    if (!options.yes && !options.json && process.stdin.isTTY) {
        const { proceed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: `Send a ${digest.length}-character digest to the SRA pipeline and generate a ${format} spec? This uses your own provider key.`,
            default: true
        }]);
        if (!proceed) {
            logger.info('Cancelled.');
            return;
        }
    }

    logger.startSpinner('Queueing analysis...');

    const settings = { format, profile: 'technical' };
    if (options.provider) settings.modelProvider = options.provider;
    if (options.model) settings.modelName = options.model;

    let job;
    try {
        const response = await api.post('/api/analyze', {
            text: digest,
            projectId: options.project || undefined,
            settings
        });
        job = response?.data || response;
    } catch (error) {
        logger.stopSpinner(false, 'Could not start the analysis');
        logger.error('The platform rejected the request', describeError(error));
        // A missing provider key is the single most common cause and is fixable in one
        // step, so name the step instead of leaving a bare 400.
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

    if (options.wait === false) {
        logger.info(`Running in the background. Follow it with: ${chalk.bold(`sra status --watch`)}`);
        if (options.json) logger.json({ analysisId, queued: true });
        return;
    }

    logger.startSpinner('Waiting for the pipeline...');
    const outcome = await followAnalysis(analysisId, {
        onStage: (event) => logger.updateSpinner(describeStage(event))
    });

    if (outcome.status !== 'COMPLETED') {
        logger.stopSpinner(false, `Analysis ${outcome.status.toLowerCase()}.`);
        if (outcome.status === 'FAILED') {
            logger.info(`Checkpoints are kept — resume it from the web app, or re-run once the cause is fixed.`);
        }
        process.exitCode = 1;
        return;
    }

    logger.stopSpinner(true, 'Specification generated.');

    const spec = await sync({ analysis: analysisId, json: false });
    if (!spec) return;

    const linked = await linkEvidence(scan, cwd);

    logger.success(`Reverse engineering complete — ${spec.features.length} requirement group(s), ${linked} pre-linked to source files.`);
    logger.info(`Review the proposed links with ${chalk.bold('sra check')}, then publish them with ${chalk.bold('sra push')}.`);

    if (options.json) {
        logger.json({ analysisId, formatId: spec.formatId, features: spec.features.length, evidenceLinked: linked });
    }
}

function reportScan(scan) {
    const languages = Object.entries(scan.languages).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (languages.length) logger.info(`Languages: ${languages.map(([l, c]) => `${l} (${c})`).join(', ')}`);
    if (scan.routes.length) logger.info(`Detected ${scan.routes.length} HTTP endpoint(s).`);
    if (scan.models.length) logger.info(`Detected ${scan.models.length} data entit${scan.models.length === 1 ? 'y' : 'ies'}: ${scan.models.slice(0, 8).join(', ')}${scan.models.length > 8 ? '…' : ''}`);
    if (scan.truncated) logger.warn(`Large repository — only the ${scan.scannedFileCount} most relevant source files were inspected.`);
}

async function resolveFormat(requested) {
    const { formats, defaultFormatId } = await fetchFormats();
    if (!requested) return defaultFormatId || DEFAULT_FORMAT_ID;

    if (formats.some(f => f.id === requested)) return requested;

    logger.warn(`Unknown format '${requested}'. Available: ${formats.map(f => f.id).join(', ')}. Using ${defaultFormatId}.`);
    return defaultFormatId || DEFAULT_FORMAT_ID;
}

/**
 * Pre-fill `verification_files` by matching each generated requirement group back to the
 * files the scan already read. The document was written *from* this codebase, so the
 * traceability links exist by construction — this just proposes them.
 *
 * @returns {Promise<number>} number of groups that got at least one link
 */
async function linkEvidence(scan, cwd) {
    let spec;
    try {
        spec = await readSpec();
    } catch {
        return 0;
    }

    let linked = 0;

    for (const feature of spec.features || []) {
        if (feature.verification_files?.length > 0) continue;

        const text = [
            feature.name,
            feature.description,
            ...(feature.functionalRequirements || []).map(r => (typeof r === 'string' ? r : r?.description || ''))
        ].join(' ');

        const evidence = findEvidence(scan, text, { limit: EVIDENCE_MAX_FILES })
            .filter(e => e.score >= EVIDENCE_MIN_SCORE);

        if (evidence.length === 0) continue;

        feature.verification_files = evidence.map(e =>
            // Paths are relative to the scanned root, which is not necessarily the
            // directory `sra check` will later run from.
            path.relative(process.cwd(), path.join(cwd, e.file)).split(path.sep).join('/')
        );
        feature.status = 'proposed';
        linked++;
    }

    if (linked > 0) await writeSpec(spec);
    return linked;
}
