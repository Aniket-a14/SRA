import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

export async function check() {
    logger.info('Verifying Local Compliance...');

    try {
        const specData = await fs.readFile('sra.spec.json', 'utf-8');
        const spec = JSON.parse(specData);

        let verifiedCount = 0;
        let failedCount = 0;

        logger.startSpinner('Scanning codebase...');

        for (const feature of spec.features) {
            const files = feature.verification_files || [];

            if (files.length === 0) {
                feature.status = 'pending';
                continue;
            }

            let allFilesExist = true;
            for (const file of files) {
                try {
                    await fs.access(path.resolve(file));
                } catch (e) {
                    allFilesExist = false;
                    break;
                }
            }

            if (allFilesExist) {
                feature.status = 'verified';
                verifiedCount++;
            } else {
                feature.status = 'failed';
                failedCount++;
            }
        }

        await fs.writeFile('sra.spec.json', JSON.stringify(spec, null, 2));

        logger.stopSpinner(true, 'Scan complete');

        if (verifiedCount > 0) logger.success(`${verifiedCount} features VERIFIED.`);
        if (failedCount > 0) logger.error(`${failedCount} features FAILED (missing files).`);

        const pendingCount = spec.features.length - verifiedCount - failedCount;
        if (pendingCount > 0) logger.warn(`${pendingCount} features still PENDING implementation.`);

    } catch (error) {
        logger.error('Check Failed:', error.message);
    }
}
