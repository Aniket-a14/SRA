import inquirer from 'inquirer';
import chalk from 'chalk';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { logger } from '../utils/logger.js';
import { readSpec, writeSpec, SPEC_FILE, normalizeRequirement, reqToString } from '../lib/spec.js';
import { push } from './push.js';

const execFileAsync = promisify(execFile);

/** Who is signing off. Git identity first — that is what a reviewer is known by in a repo. */
async function getUserIdentity() {
    if (process.env.SRA_USER) return process.env.SRA_USER;

    try {
        const { stdout } = await execFileAsync('git', ['config', 'user.name']);
        const name = stdout.trim();
        if (name) return name;
    } catch {
        // Not a repo, or git unconfigured.
    }

    try {
        return os.userInfo().username || 'CLI_USER';
    } catch {
        return 'CLI_USER';
    }
}

/**
 * Walk the AI-generated requirements and record a human decision on each.
 *
 * Approvals are the one piece of spec state the platform cannot produce for itself, which
 * is why `--push` exists: leaving them on disk means the web app keeps showing every
 * requirement as unreviewed.
 *
 * @param {{ all?: boolean, push?: boolean }} [options]
 */
export async function review(options = {}) {
    if (!process.stdin.isTTY) {
        logger.error('`sra review` is interactive and needs a terminal.');
        process.exitCode = 1;
        return;
    }

    const user = await getUserIdentity();
    logger.info(`Interactive review as ${chalk.bold(user)}`);

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

    let changed = false;
    let reviewed = 0;
    let pending = 0;
    let quit = false;

    for (const feature of spec.features || []) {
        if (quit) break;
        if (!Array.isArray(feature.functionalRequirements)) continue;

        for (let i = 0; i < feature.functionalRequirements.length; i++) {
            // Bare strings carry nowhere to record a decision; promoting them to the object
            // form is itself a spec change, so it counts as a modification.
            const original = feature.functionalRequirements[i];
            const req = normalizeRequirement(original);
            if (typeof original === 'string') {
                feature.functionalRequirements[i] = req;
                changed = true;
            }

            const status = req.metadata?.verification_status;
            const needsReview = options.all || !status || status === 'DRAFT_AI';
            if (!needsReview) continue;

            pending++;

            logger.raw('');
            logger.raw(chalk.gray('─'.repeat(60)));
            logger.raw(chalk.cyan(`Feature: ${feature.name}`));
            logger.raw(chalk.gray(`ID: ${req.id}${status ? `  ·  current: ${status}` : ''}`));
            logger.raw(chalk.yellow(reqToString(req)));

            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'Decision:',
                choices: [
                    { name: 'Approve — mark as human verified', value: 'approve' },
                    { name: 'Reject — flag as not accepted', value: 'reject' },
                    { name: 'Skip', value: 'skip' },
                    new inquirer.Separator(),
                    { name: 'Save and quit', value: 'quit' }
                ]
            }]);

            if (action === 'quit') {
                quit = true;
                break;
            }
            if (action === 'skip') continue;

            req.metadata = {
                ...req.metadata,
                verification_status: action === 'approve' ? 'APPROVED_HUMAN' : 'REJECTED_HUMAN',
                verifiedAt: new Date().toISOString(),
                verifiedBy: user
            };
            feature.functionalRequirements[i] = req;
            changed = true;
            reviewed++;

            if (action === 'approve') logger.success('Approved.');
            else logger.warn('Rejected.');
        }
    }

    logger.raw('');

    if (!changed) {
        logger.info(pending === 0 ? 'Nothing left to review.' : 'Review ended without changes.');
        return;
    }

    await writeSpec(spec);
    logger.success(`Recorded ${reviewed} decision(s) in ${SPEC_FILE}.`);

    if (options.push) {
        await push();
    } else {
        logger.info(`Run ${chalk.bold('sra push')} to publish these decisions to the platform.`);
    }
}
