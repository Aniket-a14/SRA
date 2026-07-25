import { api, describeError } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';
import { fetchFormatSpec, DEFAULT_FORMAT_ID } from '../lib/formats.js';
import { extractFeatures, mergeLocalState, readSpec, writeSpec, SPEC_FILE } from '../lib/spec.js';

/**
 * Pull the linked analysis down to `sra.spec.json`.
 *
 * @param {{ analysis?: string, json?: boolean }} [options]
 */
export async function sync(options = {}) {
    logger.setJsonMode(options.json);
    logger.info('Syncing specification from remote...');

    const config = await configManager.load();
    const analysisId = options.analysis || config.analysisId;

    if (!analysisId) {
        logger.error("No analysis linked. Run 'sra init' first, or pass --analysis <id>.");
        process.exitCode = 1;
        return null;
    }

    logger.startSpinner('Fetching spec...');

    let analysis;
    try {
        const response = await api.get(`/api/analyze/${analysisId}?mode=sync`);
        analysis = response?.data || response;
    } catch (error) {
        logger.stopSpinner(false, 'Sync failed');
        logger.error('Could not fetch the analysis', describeError(error));
        process.exitCode = 1;
        return null;
    }

    if (!analysis || !analysis.resultJson) {
        logger.stopSpinner(false, 'Incomplete spec data.');
        logger.error(
            analysis?.status && analysis.status !== 'COMPLETED'
                ? `The analysis is ${analysis.status} — there is no generated document to sync yet.`
                : 'The analysis has no result document.'
        );
        process.exitCode = 1;
        return null;
    }

    const srs = analysis.resultJson;
    const formatId = srs.formatId || DEFAULT_FORMAT_ID;

    // Ask the platform what this format's sections are rather than assuming IEEE's. This
    // is what keeps `push` from writing verification into a section the format lacks.
    const formatSpec = await fetchFormatSpec(formatId);

    const spec = {
        analysisId: analysis.id,
        projectId: analysis.projectId || null,
        rootId: analysis.rootId || analysis.id,
        projectTitle: srs.projectTitle || analysis.title || 'Untitled Project',
        formatId,
        formatName: srs.formatName || formatSpec?.name || 'IEEE 830-1998',
        version: analysis.version,
        status: analysis.status,
        resultQuality: analysis.resultQuality,
        isFinalized: Boolean(analysis.isFinalized),
        lastSynced: new Date().toISOString(),
        introduction: srs.introduction || {},
        overallDescription: srs.overallDescription || {},
        features: extractFeatures(srs, formatSpec),
        externalInterfaceRequirements: srs.externalInterfaceRequirements || {},
        nonFunctionalRequirements: srs.nonFunctionalRequirements || {},
        otherRequirements: srs.otherRequirements || []
    };

    try {
        const existing = await readSpec();
        spec.features = mergeLocalState(spec.features, existing.features || []);
        logger.debug('Merged with existing local spec.');
    } catch {
        logger.debug(`Creating new ${SPEC_FILE}`);
    }

    await writeSpec(spec);

    // Persist the link so a one-off `--analysis` sync makes later commands work without
    // repeating the flag.
    if (options.analysis && options.analysis !== config.analysisId) {
        await configManager.save({ analysisId: options.analysis, projectId: spec.projectId });
    }

    logger.stopSpinner(true, `Synced ${spec.features.length} requirement group(s) from "${spec.projectTitle}" [${spec.formatName}] (v${spec.version})`);

    if (!formatSpec) {
        logger.debug('Format descriptor unavailable — extraction fell back to shape detection.');
    }
    if (analysis.resultQuality === 'PARTIAL') {
        logger.warn('This analysis finished with a PARTIAL result — some sections were skipped upstream.');
    }

    if (options.json) {
        logger.json({ analysisId: spec.analysisId, formatId, version: spec.version, features: spec.features.length });
    }

    return spec;
}
