import { api, describeError } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';
import { readSpec, SPEC_FILE } from '../lib/spec.js';
import { buildTraceability } from '../lib/traceability.js';

const reqText = (r) => (typeof r === 'string' ? r : String(r?.description || '')).trim();
const reqId = (r) => (typeof r === 'string' ? null : r?.id || null);

/**
 * Merge local verification state into the remote requirement list.
 *
 * Ownership is split: the platform owns requirement *content* (it is where the document is
 * authored and edited), the CLI owns *verification state*. Push used to replace the whole
 * array with the local copy, so any edit made on the website after the last sync was silently
 * reverted by the next push.
 *
 * A requirement present remotely but not locally was added since the sync and is left alone.
 * One present locally but not remotely was deleted or renamed on the website and is not
 * resurrected.
 *
 * An approval is given to specific words. When a requirement is matched by id but its text has
 * changed since it was reviewed, the decision is deliberately NOT carried across — silently
 * moving an APPROVED_HUMAN stamp onto rewritten text would assert a human verified something
 * nobody has read.
 */
function mergeRequirements(remoteList, localList) {
    const remote = Array.isArray(remoteList) ? remoteList : [];
    const locals = Array.isArray(localList) ? localList : [];
    const stale = [];

    const byId = new Map();
    const byText = new Map();
    for (const local of locals) {
        const id = reqId(local);
        if (id && !byId.has(id)) byId.set(id, local);
        const text = reqText(local);
        if (text && !byText.has(text)) byText.set(text, local);
    }

    const merged = remote.map((item) => {
        const id = reqId(item);
        const text = reqText(item);
        const local = (id && byId.get(id)) || byText.get(text);

        if (!local || !local.metadata) return item;

        if (reqText(local) !== text) {
            stale.push(id || text);
            return item;
        }

        // Promote a bare string only when there is state to record against it.
        const base = typeof item === 'string' ? { description: item } : { ...item };
        return { ...base, metadata: { ...(base.metadata || {}), ...local.metadata } };
    });

    return { merged, stale };
}

/**
 * Patch verification state onto a feature-shaped section without disturbing the rest of
 * the document. Feature objects carry fields the CLI never sees (stimulus/response
 * sequences, priority), so the remote object is the base and only the CLI-owned fields are
 * written.
 */
function patchFeatureSection(remoteSection, entries) {
    const section = Array.isArray(remoteSection) ? [...remoteSection] : [];
    const skipped = [];
    const staleAll = [];

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

        const { merged, stale } = mergeRequirements(
            section[index].functionalRequirements,
            entry.functionalRequirements
        );
        staleAll.push(...stale);

        section[index] = {
            ...section[index],
            status: entry.status,
            verification_files: entry.verification_files || [],
            functionalRequirements: merged
        };
    }

    return { section, skipped, stale: staleAll };
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

    // Group by the section each entry was extracted from. Only feature-shaped sections are
    // touched at all: `metadata.cliTraceability` is the format-independent channel for
    // everything else, and writing into a flat section (Volere shells, Agile stories) would
    // reshape content the CLI does not own.
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
    const staleAll = [];
    for (const [section, entries] of bySection) {
        const { section: patched, skipped, stale } = patchFeatureSection(remoteJson[section], entries);
        payload[section] = patched;
        skippedAll.push(...skipped);
        staleAll.push(...stale);
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

    if (staleAll.length > 0) {
        logger.warn(
            `${staleAll.length} requirement(s) changed on the platform since you reviewed them, so their decisions were not applied: ${staleAll.join(', ')}`
        );
        logger.info(`Run "sra sync" then "sra review" to re-approve them against the current wording.`);
    }

    if (options.json) logger.json(payload.metadata.cliTraceability.summary);
}
