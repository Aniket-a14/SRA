import fs from 'fs/promises';
import { api } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';

export async function push() {
    logger.info('Pushing Local Spec to Remote...');

    try {
        const config = await configManager.load();
        if (!config.projectId) {
            logger.error("Project ID missing. Run 'sra init' first.");
            return;
        }

        const specData = await fs.readFile('sra.spec.json', 'utf-8');
        const spec = JSON.parse(specData);

        const payload = {
            systemFeatures: spec.features.map(f => ({
                id: f.id,
                name: f.name,
                description: f.description,
                functionalRequirements: f.functionalRequirements,
                status: f.status,
                verification_files: f.verification_files
            })),
            inPlace: true
        };

        logger.startSpinner(`Syncing ${spec.features.length} features to platform...`);

        await api.put(`/api/analyze/${config.projectId}`, payload);

        logger.stopSpinner(true, 'Successfully pushed changes to remote.');

    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.error('sra.spec.json not found. Run "sra sync" first.');
        } else {
            logger.stopSpinner(false, 'Push Failed');
        }
    }
}
