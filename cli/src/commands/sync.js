import fs from 'fs/promises';
import { api } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';

const randId = () => Math.random().toString(36).slice(2, 7).toUpperCase();

/** Coerce a requirement item (IEEE string, Volere shell object, or story object) to a string. */
function reqToString(item) {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
        if (item.description) return String(item.description);
        if (item.action || item.role) return `As a ${item.role || 'user'}, I want ${item.action || ''}${item.benefit ? `, so that ${item.benefit}` : ''}.`;
        if (item.requirement) return String(item.requirement);
    }
    return '';
}

const asArray = (v) => (Array.isArray(v) ? v : []);
const looksLikeFeature = (f) => f && typeof f === 'object' && ('functionalRequirements' in f || 'requirements' in f);

/**
 * Extract verifiable features from a spec regardless of its format. The pipeline persists
 * `formatId`, but rather than hardcode every format's section ids we normalise across the
 * known shapes: IEEE/ISO system features, Volere/ISO requirement groups, and Agile PRD
 * user stories — so `sra check` always has functional requirements to trace to source.
 */
function extractFeatures(srs) {
    const features = [];

    // 1. Feature-shaped arrays (IEEE `systemFeatures`, and any other section holding
    //    objects with a name + functional requirements — e.g. ISO system functions).
    const featureArrays = [srs.systemFeatures, srs.systemFunctions, srs.specificRequirements]
        .filter(Array.isArray);
    for (const key of Object.keys(srs)) {
        const val = srs[key];
        if (Array.isArray(val) && val.some(looksLikeFeature) && !featureArrays.includes(val)) {
            featureArrays.push(val);
        }
    }
    const seen = new Set();
    for (const arr of featureArrays) {
        for (const f of arr) {
            if (!looksLikeFeature(f)) continue;
            const frs = asArray(f.functionalRequirements ?? f.requirements).map(reqToString).filter(Boolean);
            if (frs.length === 0 && !f.name) continue;
            const name = f.name || f.title || `Feature ${features.length + 1}`;
            if (seen.has(name)) continue;
            seen.add(name);
            features.push({ id: f.id || `FEAT-${randId()}`, name, description: f.description || '', functionalRequirements: frs, status: 'pending', verification_files: [] });
        }
    }

    // 2. Agile PRD — user stories are the verifiable unit.
    const stories = asArray(srs.userStories).map(reqToString).filter(Boolean);
    if (stories.length > 0) {
        features.push({ id: `FEAT-${randId()}`, name: 'User Stories', description: 'Agile user stories.', functionalRequirements: stories, status: 'pending', verification_files: [] });
    }

    // 3. Flat functional requirement groups (Volere/ISO) not already captured as features.
    if (features.length === 0) {
        const flat = [];
        for (const key of Object.keys(srs)) {
            if (!/requirement|functional/i.test(key)) continue;
            const val = srs[key];
            if (Array.isArray(val)) flat.push(...val.map(reqToString).filter(Boolean));
            else if (val && typeof val === 'object') {
                for (const sub of Object.values(val)) {
                    if (Array.isArray(sub)) flat.push(...sub.map(reqToString).filter(Boolean));
                }
            }
        }
        if (flat.length > 0) {
            features.push({ id: `FEAT-${randId()}`, name: 'Functional Requirements', description: '', functionalRequirements: flat, status: 'pending', verification_files: [] });
        }
    }

    return features;
}

export async function sync() {
    logger.info('Syncing Specification from Remote...');

    try {
        const config = await configManager.load();
        if (!config.projectId) {
            logger.error("Project ID missing. Run 'sra init' first.");
            process.exitCode = 1;
            return;
        }

        logger.startSpinner('Fetching spec...');
        const responseData = await api.get(`/api/analyze/${config.projectId}?mode=sync`);
        const analysis = responseData.data || responseData;

        if (!analysis || !analysis.resultJson) {
            logger.stopSpinner(false, 'Incomplete spec data.');
            process.exitCode = 1;
            return;
        }

        const srs = analysis.resultJson;
        const spec = {
            projectId: analysis.id,
            projectTitle: srs.projectTitle || 'Untitled Project',
            formatId: srs.formatId || 'ieee830',
            formatName: srs.formatName || 'IEEE 830-1998',
            version: analysis.version,
            lastSynced: new Date().toISOString(),
            introduction: srs.introduction || {},
            overallDescription: srs.overallDescription || {},
            features: extractFeatures(srs),
            externalInterfaceRequirements: srs.externalInterfaceRequirements || {},
            nonFunctionalRequirements: srs.nonFunctionalRequirements || {},
            otherRequirements: srs.otherRequirements || []
        };

        // Merge logic
        try {
            const existingData = await fs.readFile('sra.spec.json', 'utf-8');
            const existingSpec = JSON.parse(existingData);

            spec.features = spec.features.map(newFeat => {
                const existingFeat = (existingSpec.features || []).find(ef => ef.name === newFeat.name);
                if (existingFeat) {
                    return {
                        ...newFeat,
                        verification_files: existingFeat.verification_files || [],
                        status: existingFeat.status || 'pending'
                    };
                }
                return newFeat;
            });
            logger.debug('Merged with existing local spec.');
        } catch {
            logger.debug('Creating new sra.spec.json');
        }

        await fs.writeFile('sra.spec.json', JSON.stringify(spec, null, 2));
        logger.stopSpinner(true, `Synced ${spec.features.length} features from "${spec.projectTitle}" [${spec.formatName}] (v${spec.version})`);

    } catch (error) {
        logger.stopSpinner(false, 'Sync failed');
        logger.error('Sync failed:', error.message);
        process.exitCode = 1;
    }
}
