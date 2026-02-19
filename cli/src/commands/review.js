import fs from 'fs/promises';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';

import { execSync } from 'child_process';
import os from 'os';

async function getUserIdentity() {
    if (process.env.SRA_USER) return process.env.SRA_USER;

    try {
        const gitName = execSync('git config user.name', { encoding: 'utf8' }).trim();
        if (gitName) return gitName;
    } catch (e) { /* ignore */ }

    try {
        const osUser = os.userInfo().username;
        if (osUser) return osUser;
    } catch (e) { /* ignore */ }

    return 'CLI_USER';
}

export async function review() {
    const user = await getUserIdentity();
    logger.info(`Starting Interactive Review Mode as "${chalk.bold(user)}"...`);

    try {
        const specPath = 'sra.spec.json';
        const data = await fs.readFile(specPath, 'utf-8');
        const spec = JSON.parse(data);

        let changed = false;
        let pendingCount = 0;

        if (spec.features) {
            for (const feature of spec.features) {
                if (!feature.functionalRequirements) continue;

                for (let i = 0; i < feature.functionalRequirements.length; i++) {
                    let req = feature.functionalRequirements[i];

                    if (typeof req === 'string') {
                        const idMatch = req.match(/^([A-Z]+-[A-Z]+-\d+(\.\d+)?)/);
                        const id = idMatch ? idMatch[1] : `REQ-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                        req = {
                            id: id,
                            description: req,
                            metadata: { verification_status: 'DRAFT_AI' }
                        };
                        feature.functionalRequirements[i] = req;
                        changed = true;
                    }
                    const status = req.metadata?.verification_status;
                    if (!status || status === 'DRAFT_AI') {
                        pendingCount++;

                        console.log('\n------------------------------------------------');
                        console.log(chalk.cyan(`Feature: ${feature.name}`));
                        console.log(chalk.yellow(`Requirement: ${req.description}`));
                        console.log(chalk.gray(`ID: ${req.id}`));

                        const answer = await inquirer.prompt([
                            {
                                type: 'list',
                                name: 'action',
                                message: 'Review this requirement:',
                                choices: [
                                    { name: 'Approve (Mark as Human Verified)', value: 'approve' },
                                    { name: 'Reject (Remove from Spec)', value: 'reject' },
                                    { name: 'Skip', value: 'skip' }
                                ]
                            }
                        ]);

                        if (answer.action === 'approve') {
                            req.metadata = req.metadata || {};
                            req.metadata.verification_status = 'APPROVED_HUMAN';
                            req.metadata.verifiedAt = new Date().toISOString();
                            req.metadata.verifiedBy = user;
                            logger.success('Approved.');
                            changed = true;
                        } else if (answer.action === 'reject') {
                            req.metadata = req.metadata || {};
                            req.metadata.verification_status = 'REJECTED_HUMAN';
                            logger.warn('Rejected.');
                            changed = true;
                        }
                    }
                }
            }
        }

        if (changed) {
            await fs.writeFile(specPath, JSON.stringify(spec, null, 2));
            logger.success('Spec updated with review results.');
        } else {
            if (pendingCount === 0) {
                logger.info('No pending requirements to review. Great job!');
            } else {
                logger.info('Review session ended without changes.');
            }
        }

    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.error('sra.spec.json not found. Run "sra sync" first.');
        } else {
            logger.error(`Review failed: ${error.message}`);
        }
    }
}
