import fs from 'fs/promises';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';
import { api } from '../api/api-client.js';

export async function doctor() {
    logger.info('Running SRA System Diagnostics...');
    console.log('');

    // 1. Check Node Version
    const nodeVersion = process.version;
    logger.info(`Node.js Version: ${nodeVersion}`);

    // 2. Check Config
    const configExists = await configManager.exists();
    if (configExists) {
        logger.success('Local configuration found (sra.config.json)');
        const config = await configManager.load();
        logger.info(`  └─ Linked Project ID: ${config.projectId}`);
    } else {
        logger.warn('No local configuration found. Run "sra init".');
    }

    // 3. Check Manifest
    try {
        await fs.access('sra.spec.json');
        logger.success('Requirement manifest found (sra.spec.json)');
    } catch {
        logger.warn('No requirement manifest found. Run "sra sync".');
    }

    // 4. Check Connectivity
    logger.startSpinner('Testing connection to SRA Platform...');
    try {
        await api.get('/api/auth/me');
        logger.stopSpinner(true, 'Connectivity to Backend: OK');
    } catch (e) {
        logger.stopSpinner(false, 'Connectivity to Backend: FAILED');
    }

    // 5. Check API Key
    const apiKey = process.env.SRA_API_KEY;
    if (apiKey) {
        logger.success('Environment API Key (SRA_API_KEY): Present');
    } else {
        logger.error('Environment API Key (SRA_API_KEY): MISSING');
    }

    console.log('\n' + '─'.repeat(40) + '\n');
    logger.info('Diagnostics complete.');
}
