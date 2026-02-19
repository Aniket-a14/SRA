import inquirer from 'inquirer';
import { api } from '../api/api-client.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../config/config-manager.js';
import { sync } from './sync.js';

export async function init() {
    logger.info('Initializing SRA Connection...');

    // 1. Authentication Check
    const apiKey = process.env.SRA_API_KEY;
    if (!apiKey) {
        logger.error('SRA_API_KEY not found in environment.');
        logger.info('Please create a .env file with SRA_API_KEY=sra_live_...');
        return;
    }

    logger.debug('Found SRA_API_KEY in environment.');

    // Use default URL or one from local config if it exists
    const currentConfig = await configManager.load();
    const backendUrl = currentConfig.backendUrl || 'https://sra-backend-six.vercel.app';

    // 2. Verify API Key
    logger.startSpinner('Verifying API Key...');
    try {
        const user = await api.get('/api/auth/me');
        logger.stopSpinner(true, `Verified API Key for ${user.email}`);
    } catch (error) {
        logger.stopSpinner(false, 'Invalid API Key');
        logger.info('Tip: You can generate an API Key in your SRA Dashboard.');
        return;
    }

    // 3. Fetch Projects
    logger.startSpinner('Fetching your projects...');
    let projects = [];
    try {
        const responseData = await api.get('/api/analyze');
        const rawProjects = Array.isArray(responseData.data) ? responseData.data : (Array.isArray(responseData) ? responseData : []);

        projects = rawProjects.slice(0, 10).map(p => ({
            name: `${p.title || 'Untitled Project'} (v${p.version}) - ${new Date(p.createdAt).toLocaleDateString()}`,
            value: p.id,
            short: p.title
        }));

        logger.stopSpinner(true, `Found ${projects.length} project(s)`);
        if (projects.length === 0) {
            logger.warn('No projects found using this account.');
            return;
        }
    } catch (error) {
        logger.stopSpinner(false, 'Failed to fetch projects');
        return;
    }

    // 4. Select Project
    const { projectId } = await inquirer.prompt([
        {
            type: 'list',
            name: 'projectId',
            message: 'Select the SRA Analysis to link to this folder:',
            choices: projects
        }
    ]);

    // 5. Save Configuration
    try {
        await configManager.save({
            backendUrl,
            projectId
        });
        logger.success('Connected! Configuration saved to sra.config.json');
        logger.debug('Tip: Add sra.config.json to .gitignore');

        // Trigger Sync
        logger.info('Auto-syncing spec...');
        await sync();
    } catch (error) {
        logger.error('Error saving configuration:', error.message);
    }
}
