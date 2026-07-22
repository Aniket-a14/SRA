import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

// This only confirms that each feature's `verification_files` exist on disk — it does
// not parse or check their contents, so a stub/empty file at the right path still
// counts as "verified". That's a deliberately cheap signal (fast, zero false negatives
// from formatting/language differences), not a claim that the feature is correctly
// implemented — the terminal output below is worded to reflect that.
export async function check() {
    logger.info('Scanning for expected files (existence check only — not a correctness check)...');

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

        if (verifiedCount > 0) logger.success(`${verifiedCount} features have their expected files present on disk.`);
        if (failedCount > 0) logger.error(`${failedCount} features are missing one or more expected files.`);

        const pendingCount = spec.features.length - verifiedCount - failedCount;
        if (pendingCount > 0) logger.warn(`${pendingCount} features have no verification files configured yet.`);

    } catch (error) {
        logger.error('Check Failed:', error.message);
        process.exitCode = 1;
    }
}
