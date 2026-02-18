import fs from 'fs/promises';
import { api } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';

export async function sync() {
    logger.info('Syncing Specification from Remote...');

    try {
        const config = await configManager.load();
        if (!config.projectId) {
            logger.error("Project ID missing. Run 'sra init' first.");
            return;
        }

        logger.startSpinner('Fetching spec...');
        const responseData = await api.get(`/api/analyze/${config.projectId}?mode=sync`);
        const analysis = responseData.data || responseData;

        if (!analysis || !analysis.resultJson) {
            logger.stopSpinner(false, 'Incomplete spec data.');
            return;
        }

        const srs = analysis.resultJson;
        const spec = {
            projectId: analysis.id,
            projectTitle: srs.projectTitle || 'Untitled Project',
            version: analysis.version,
            lastSynced: new Date().toISOString(),
            introduction: srs.introduction || {},
            overallDescription: srs.overallDescription || {},
            features: (srs.systemFeatures || []).map(f => ({
                id: f.id || `FEAT-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                name: f.name,
                description: f.description,
                functionalRequirements: f.functionalRequirements || [],
                status: 'pending',
                verification_files: []
            })),
            externalInterfaceRequirements: srs.externalInterfaceRequirements || {},
            nonFunctionalRequirements: srs.nonFunctionalRequirements || {},
            otherRequirements: srs.otherRequirements || []
        };

        // Merge logic
        try {
            const existingData = await fs.readFile('sra.spec.json', 'utf-8');
            const existingSpec = JSON.parse(existingData);

            spec.features = spec.features.map(newFeat => {
                const existingFeat = existingSpec.features.find(ef => ef.name === newFeat.name);
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
        } catch (e) {
            logger.debug('Creating new sra.spec.json');
        }

        await fs.writeFile('sra.spec.json', JSON.stringify(spec, null, 2));
        logger.stopSpinner(true, `Synced ${spec.features.length} features from "${spec.projectTitle}" (v${spec.version})`);

    } catch (error) {
        logger.stopSpinner(false, 'Sync failed');
    }
}
