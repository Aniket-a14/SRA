import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { readSpec, writeSpec, SPEC_FILE, reqToString } from '../lib/spec.js';
import { scanCodebase, findEvidence, extractTerms } from '../lib/scanner.js';

const SUGGEST_MIN_SCORE = 6;
const SUGGEST_MAX_FILES = 5;

const STATUS_LABEL = {
    verified: chalk.green('verified'),
    partial: chalk.yellow('partial'),
    proposed: chalk.blue('proposed'),
    failed: chalk.red('missing'),
    pending: chalk.gray('unlinked')
};

/**
 * Verify that the linked requirements are traceable to code in this working tree.
 *
 * Two levels, because they answer different questions and cost differently:
 *   - default: do the linked files exist? Cheap, and enough for a pre-commit hook.
 *   - `--deep`: do those files actually mention the requirement's own terms? Catches a
 *     link that pointed somewhere real and then rotted as the code moved.
 *
 * Neither level is a correctness proof, and the output says so — a file existing, or
 * containing a matching identifier, does not mean the requirement is implemented right.
 *
 * @param {{ deep?: boolean, suggest?: boolean, strict?: boolean, json?: boolean }} [options]
 */
export async function check(options = {}) {
    logger.setJsonMode(options.json);

    let spec;
    try {
        spec = await readSpec();
    } catch (error) {
        logger.error(
            error.code === 'ENOENT'
                ? `${SPEC_FILE} not found. Run "sra sync" first.`
                : `Could not read ${SPEC_FILE}`,
            error.code === 'ENOENT' ? null : error.message
        );
        process.exitCode = 1;
        return;
    }

    const features = spec.features || [];
    if (features.length === 0) {
        logger.warn('The local spec has no requirement groups to check.');
        return;
    }

    // The scan is only needed for the modes that read file *contents*.
    let scan = null;
    if (options.deep || options.suggest) {
        logger.startSpinner('Scanning codebase...');
        scan = await scanCodebase();
        logger.stopSpinner(true, `Scanned ${scan.scannedFileCount} source files.`);
    }

    logger.startSpinner(options.deep ? 'Tracing requirements to source...' : 'Checking linked files...');

    const rows = [];
    let changed = false;

    for (const feature of features) {
        const files = feature.verification_files || [];

        if (files.length === 0) {
            const suggestions = options.suggest ? suggestFiles(scan, feature) : [];
            if (suggestions.length > 0) {
                feature.verification_files = suggestions;
                feature.status = 'proposed';
                changed = true;
                rows.push([feature.name, STATUS_LABEL.proposed, `${suggestions.length} proposed`]);
            } else {
                feature.status = 'pending';
                rows.push([feature.name, STATUS_LABEL.pending, 'no files linked']);
            }
            continue;
        }

        const missing = [];
        const unsupported = [];

        for (const file of files) {
            try {
                await fs.access(path.resolve(file));
            } catch {
                missing.push(file);
                continue;
            }

            if (options.deep && !(await fileSupports(file, feature))) unsupported.push(file);
        }

        if (missing.length > 0) {
            feature.status = 'failed';
            rows.push([feature.name, STATUS_LABEL.failed, `${missing.length}/${files.length} file(s) not on disk`]);
        } else if (unsupported.length > 0) {
            feature.status = 'partial';
            rows.push([feature.name, STATUS_LABEL.partial, `${unsupported.length}/${files.length} file(s) show no matching identifiers`]);
        } else {
            feature.status = 'verified';
            rows.push([feature.name, STATUS_LABEL.verified, `${files.length} file(s)`]);
        }
        changed = true;
    }

    await writeSpec(spec);
    logger.stopSpinner(true, 'Check complete');

    logger.raw('');
    logger.table(rows, ['REQUIREMENT GROUP', 'STATUS', 'DETAIL']);
    logger.raw('');

    const tally = features.reduce((acc, f) => {
        acc[f.status] = (acc[f.status] || 0) + 1;
        return acc;
    }, {});

    const summary = {
        total: features.length,
        verified: tally.verified || 0,
        partial: tally.partial || 0,
        proposed: tally.proposed || 0,
        failed: tally.failed || 0,
        pending: tally.pending || 0,
        mode: options.deep ? 'deep' : 'existence'
    };

    if (summary.verified) logger.success(`${summary.verified} group(s) trace to files that exist${options.deep ? ' and mention their own terms' : ''}.`);
    if (summary.partial) logger.warn(`${summary.partial} group(s) link to files with no matching identifiers — the link may have rotted.`);
    if (summary.proposed) logger.info(`${summary.proposed} group(s) got proposed links. Review them in ${SPEC_FILE} before pushing.`);
    if (summary.failed) logger.error(`${summary.failed} group(s) link to files that are not on disk.`);
    if (summary.pending) logger.warn(`${summary.pending} group(s) have no files linked yet.${options.suggest ? '' : ' Try --suggest.'}`);

    if (!options.deep) {
        logger.info('This checks that links resolve, not that requirements are correctly implemented. Use --deep for identifier tracing.');
    }
    if (changed) logger.debug(`Updated statuses in ${SPEC_FILE}.`);

    if (options.json) logger.json(summary);

    // Only --strict fails the process, so `sra check` stays usable as an informational
    // step while a team is still filling in links.
    if (options.strict && (summary.failed > 0 || summary.pending > 0 || summary.partial > 0)) {
        process.exitCode = 1;
    } else if (summary.failed > 0) {
        process.exitCode = 1;
    }
}

/** Does this file mention any of the requirement group's distinctive terms? */
async function fileSupports(file, feature) {
    let content;
    try {
        content = await fs.readFile(path.resolve(file), 'utf-8');
    } catch {
        return false;
    }

    const haystack = `${file}\n${content}`.toLowerCase();
    const terms = extractTerms([
        feature.name,
        feature.description,
        ...(feature.functionalRequirements || []).map(reqToString)
    ].join(' '));

    return terms.some(term => haystack.includes(term));
}

function suggestFiles(scan, feature) {
    if (!scan) return [];

    const text = [
        feature.name,
        feature.description,
        ...(feature.functionalRequirements || []).map(reqToString)
    ].join(' ');

    return findEvidence(scan, text, { limit: SUGGEST_MAX_FILES })
        .filter(e => e.score >= SUGGEST_MIN_SCORE)
        .map(e => e.file);
}
