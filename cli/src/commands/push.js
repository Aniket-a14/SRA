import { api, describeError } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';
import { readSpec, SPEC_FILE } from '../lib/spec.js';
import { buildTraceability } from '../lib/traceability.js';

/**
 * Patch verification state onto a feature-shaped section without disturbing the rest of
 * the document. Feature objects carry fields the CLI never sees (stimulus/response
 * sequences, priority), so the remote object is the base and only the CLI-owned fields —
 * plus reviewed requirement text — are overwritten.
 */
function patchFeatureSection(remoteSection, entries) {
    const section = Array.isArray(remoteSection) ? [...remoteSection] : [];
    const skipped = [];

    for (const entry of entries) {
        let index = entry.source?.index;

        // Index is only a hint: the document may have been edited on the website since the
        // last sync. Fall back to the name, and skip rather than write to the wrong feature.
        if (typeof index !== 'number' || section[index]?.name !== entry.name) {
            index = section.findIndex(f => f?.name === entry.name);
        }
        if (index < 0 || !section[index]) {
            skipped.push(entry.name);
            continue;
        }

        section[index] = {
            ...section[index],
            status: entry.status,
            verification_files: entry.verification_files || [],
            // Reviewed requirements are objects carrying an approval; unreviewed ones stay
            // exactly as the platform sent them.
            functionalRequirements: entry.functionalRequirements
        };
    }

    return { section, skipped };
}

/**
 * Send local verification results back to the platform.
 *
 * @param {{ json?: boolean, newVersion?: boolean }} [options] - `newVersion` records the
 *   results as a new analysis version instead of updating the current one in place.
 */
export async function push(options = {}) {
    logger.setJsonMode(options.json);
    logger.info('Pushing local verification results to the platform...');

    const config = await configManager.load();
    const analysisId = config.analysisId;

    if (!analysisId) {
        logger.error("No analysis linked. Run 'sra init' first.");
        process.exitCode = 1;
        return;
    }

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

    logger.startSpinner('Fetching the current remote document...');

    let remote;
    try {
        const response = await api.get(`/api/analyze/${analysisId}?mode=sync`);
        remote = response?.data || response;
    } catch (error) {
        logger.stopSpinner(false, 'Push failed');
        logger.error('Could not fetch the current document', describeError(error));
        process.exitCode = 1;
        return;
    }

    const remoteJson = remote?.resultJson || {};

    if (remote?.version && spec.version && remote.version !== spec.version) {
        logger.warn(`Remote is at v${remote.version} but the local spec was synced from v${spec.version}. Verification will be matched by name where positions have moved.`);
    }

    // Group by the section each entry was extracted from. Only feature-shaped sections get
    // content writeback: for flat sections (Volere shells, Agile stories) the local
    // requirement strings are *flattened renderings* of structured objects, and writing
    // them back would replace those objects with prose.
    const bySection = new Map();
    for (const feature of spec.features || []) {
        const section = feature.source?.section;
        const kind = feature.source?.kind;
        if (!section || kind !== 'feature-list') continue;
        if (!bySection.has(section)) bySection.set(section, []);
        bySection.get(section).push(feature);
    }

    const payload = {
        inPlace: !options.newVersion,
        // Alignment re-runs a full LLM check on the user's own key. A verification push
        // changes no requirement *content*, so paying for that check would be pure waste.
        skipAlignment: true,
        metadata: { cliTraceability: buildTraceability(spec) }
    };

    const skippedAll = [];
    for (const [section, entries] of bySection) {
        const { section: patched, skipped } = patchFeatureSection(remoteJson[section], entries);
        payload[section] = patched;
        skippedAll.push(...skipped);
    }

    logger.updateSpinner(`Pushing ${(spec.features || []).length} requirement group(s)...`);

    try {
        await api.put(`/api/analyze/${analysisId}`, payload);
    } catch (error) {
        logger.stopSpinner(false, 'Push failed');
        logger.error('The platform rejected the update', describeError(error));
        process.exitCode = 1;
        return;
    }

    const sections = [...bySection.keys()];
    logger.stopSpinner(true, 'Verification results pushed.');

    if (sections.length > 0) {
        logger.info(`Updated section(s): ${sections.join(', ')}`);
    } else {
        logger.info(`This ${spec.formatName || spec.formatId} document has no feature-shaped section — traceability was recorded against the document as a whole.`);
    }

    if (skippedAll.length > 0) {
        logger.warn(`Could not locate ${skippedAll.length} group(s) in the remote document (renamed or removed): ${skippedAll.join(', ')}`);
    }

    if (options.json) logger.json(payload.metadata.cliTraceability.summary);
}
