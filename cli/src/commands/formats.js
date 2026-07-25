import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { fetchFormats } from '../lib/formats.js';

/**
 * Show the specification formats the platform can generate.
 *
 * Read from the platform's own registry so the CLI offers exactly what the web app
 * offers — a hardcoded list here would go stale the moment a format is added.
 *
 * @param {{ json?: boolean }} [options]
 */
export async function formats(options = {}) {
    logger.setJsonMode(options.json);

    const { formats: available, defaultFormatId, live } = await fetchFormats();

    logger.raw('');
    logger.table(
        available.map(f => [
            f.id === defaultFormatId ? chalk.green('●') : ' ',
            f.id,
            f.name,
            f.tier || '—',
            f.description || ''
        ]),
        ['', 'ID', 'NAME', 'TIER', 'DESCRIPTION']
    );
    logger.raw('');

    logger.info(`${chalk.green('●')} default. Choose one with: ${chalk.bold('sra analyze <file> --format <id>')}`);
    if (!live) {
        logger.warn('Could not reach the platform registry — showing the built-in list, which may be out of date.');
    }

    if (options.json) logger.json({ defaultFormatId, formats: available, live });
}
