import chalk from 'chalk';
import ora from 'ora';

class Logger {
    constructor() {
        this.spinner = null;
        // In JSON mode the only thing on stdout is the machine-readable payload, so every
        // human-facing line is suppressed and errors are routed to stderr. Without this a
        // caller doing `sra status --json | jq` gets a banner and a spinner in the pipe.
        this.jsonMode = false;
    }

    setJsonMode(enabled) {
        this.jsonMode = Boolean(enabled);
    }

    info(message) {
        if (this.jsonMode) return;
        console.log(chalk.blue('ℹ'), message);
    }

    success(message) {
        if (this.jsonMode) return;
        console.log(chalk.green('✔'), message);
    }

    warn(message) {
        if (this.jsonMode) return;
        console.log(chalk.yellow('⚠'), message);
    }

    error(message, details = null) {
        // Errors survive JSON mode — a silent failure is worse than a stray stderr line,
        // and stderr never pollutes a stdout pipe.
        console.error(chalk.red('✖'), chalk.bold(message));
        if (details) {
            console.error(chalk.red('  └─'), details);
        }
    }

    debug(message) {
        if (process.env.DEBUG || process.argv.includes('--verbose')) {
            console.log(chalk.gray('DEBUG:'), message);
        }
    }

    /** Unadorned line — for content the user reads rather than status the CLI reports. */
    raw(message = '') {
        if (this.jsonMode) return;
        console.log(message);
    }

    /** The machine-readable payload for `--json`. Always printed, mode notwithstanding. */
    json(payload) {
        console.log(JSON.stringify(payload, null, 2));
    }

    /**
     * Fixed-width table.
     *
     * @param {Array<Array<string>>} rows
     * @param {Array<string>} [headers]
     */
    table(rows, headers = null) {
        if (this.jsonMode || rows.length === 0) return;

        const all = headers ? [headers, ...rows] : rows;
        const widths = all[0].map((_, col) =>
            Math.max(...all.map(row => String(row[col] ?? '').length))
        );

        const render = (row, dim = false) => {
            const line = row
                .map((cell, i) => String(cell ?? '').padEnd(widths[i]))
                .join('  ')
                .trimEnd();
            console.log(dim ? chalk.gray(line) : line);
        };

        if (headers) {
            render(headers.map(h => chalk.bold(h)));
            render(widths.map(w => '─'.repeat(w)), true);
        }
        rows.forEach(row => render(row));
    }

    startSpinner(message) {
        // ora repaints in place; piped into a file or a CI log that becomes hundreds of
        // near-identical lines. Fall back to a single static line off a TTY.
        if (this.jsonMode) return;
        if (!process.stdout.isTTY) {
            console.log(chalk.blue('…'), message);
            return;
        }
        this.spinner = ora(message).start();
    }

    stopSpinner(success = true, message = '') {
        if (!this.spinner) {
            if (message && !this.jsonMode && !process.stdout.isTTY) {
                console.log(success ? chalk.green('✔') : chalk.red('✖'), message);
            }
            return;
        }
        if (success) {
            this.spinner.succeed(message);
        } else {
            this.spinner.fail(message);
        }
        this.spinner = null;
    }

    /** Update the running spinner's text without ending it (live progress stages). */
    updateSpinner(message) {
        if (this.spinner) {
            this.spinner.text = message;
        } else if (!this.jsonMode && !process.stdout.isTTY) {
            console.log(chalk.blue('…'), message);
        }
    }
}

export const logger = new Logger();
