import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';

export const SRA_HOOK_START = '# --- SRA Pre-Commit Verification Hook ---';
export const SRA_HOOK_END = '# --- End SRA Pre-Commit Hook ---';

export const SRA_HOOK_BODY = `${SRA_HOOK_START}
# Ensures linked requirements trace to code before committing.
if [ -f "./sra.spec.json" ] || [ -f "./.sra/spec.json" ]; then
    if command -v sra >/dev/null 2>&1; then
        sra check --strict || exit 1
    elif [ -f "./node_modules/.bin/sra" ]; then
        ./node_modules/.bin/sra check --strict || exit 1
    else
        npx --no-install @sra-srs/sra-cli check --strict || exit 1
    fi
fi
${SRA_HOOK_END}
`;

/**
 * Finds the nearest .git directory starting from the working directory.
 */
export async function findGitRoot(startDir = process.cwd()) {
    let current = path.resolve(startDir);
    while (true) {
        const gitPath = path.join(current, '.git');
        try {
            const stat = await fs.stat(gitPath);
            if (stat.isDirectory()) {
                return gitPath;
            }
        } catch {
            // keep searching up
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}

/**
 * Install, uninstall, or check the status of the SRA git pre-commit hook.
 * @param {'install'|'uninstall'|'status'} [action='install']
 * @param {{ json?: boolean }} [options]
 */
export async function hook(action = 'install', options = {}) {
    logger.setJsonMode(options.json);

    const gitDir = await findGitRoot();
    if (!gitDir) {
        logger.error('No .git repository found in this directory or any parent directory.');
        process.exitCode = 1;
        return;
    }

    const hooksDir = path.join(gitDir, 'hooks');
    const hookPath = path.join(hooksDir, 'pre-commit');

    if (action === 'install') {
        try {
            await fs.mkdir(hooksDir, { recursive: true });

            let existingContent = '';
            try {
                existingContent = await fs.readFile(hookPath, 'utf8');
            } catch {
                // file doesn't exist yet
            }

            if (existingContent.includes(SRA_HOOK_START)) {
                logger.info('SRA pre-commit hook is already installed in .git/hooks/pre-commit.');
                return;
            }

            let newContent = '';
            if (existingContent.trim().length > 0) {
                newContent = existingContent.endsWith('\n')
                    ? `${existingContent}\n${SRA_HOOK_BODY}\n`
                    : `${existingContent}\n\n${SRA_HOOK_BODY}\n`;
            } else {
                newContent = `#!/bin/sh\n\n${SRA_HOOK_BODY}\n`;
            }

            await fs.writeFile(hookPath, newContent, { mode: 0o755 });
            logger.success('Installed SRA pre-commit hook in .git/hooks/pre-commit.');
            logger.info(chalk.gray('Commits will now automatically verify requirement traceability before committing.'));
        } catch (error) {
            logger.error('Failed to install pre-commit hook', error.message);
            process.exitCode = 1;
        }
    } else if (action === 'uninstall') {
        try {
            let existingContent = '';
            try {
                existingContent = await fs.readFile(hookPath, 'utf8');
            } catch {
                logger.info('No pre-commit hook found.');
                return;
            }

            if (!existingContent.includes(SRA_HOOK_START) && !existingContent.includes('# SRA Pre-Commit Verification Hook')) {
                logger.info('SRA pre-commit hook is not installed.');
                return;
            }

            const cleaned = existingContent
                .replace(new RegExp(`${SRA_HOOK_START}[\\s\\S]*?${SRA_HOOK_END}\\n?`, 'g'), '')
                .replace(/# SRA Pre-Commit Verification Hook[\s\S]*?fi\n?/g, '')
                .trim();

            if (cleaned === '#!/bin/sh' || cleaned === '') {
                await fs.unlink(hookPath);
                logger.success('Removed .git/hooks/pre-commit hook file.');
            } else {
                await fs.writeFile(hookPath, `${cleaned}\n`, { mode: 0o755 });
                logger.success('Removed SRA verification check from .git/hooks/pre-commit.');
            }
        } catch (error) {
            logger.error('Failed to uninstall pre-commit hook', error.message);
            process.exitCode = 1;
        }
    } else if (action === 'status') {
        try {
            const existingContent = await fs.readFile(hookPath, 'utf8');
            if (existingContent.includes(SRA_HOOK_START) || existingContent.includes('# SRA Pre-Commit Verification Hook')) {
                logger.info(`${chalk.green('✔ Active:')} SRA pre-commit hook is installed.`);
            } else {
                logger.info(`${chalk.yellow('○ Inactive:')} SRA pre-commit hook is not configured.`);
            }
        } catch {
            logger.info(`${chalk.yellow('○ Inactive:')} No pre-commit hook found.`);
        }
    } else {
        logger.error(`Unknown action "${action}". Valid actions: install, uninstall, status.`);
        process.exitCode = 1;
    }
}
