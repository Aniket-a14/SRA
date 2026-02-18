import chalk from 'chalk';
import ora from 'ora';

class Logger {
    constructor() {
        this.spinner = null;
    }

    info(message) {
        console.log(chalk.blue('ℹ'), message);
    }

    success(message) {
        console.log(chalk.green('✔'), message);
    }

    warn(message) {
        console.log(chalk.yellow('⚠'), message);
    }

    error(message, details = null) {
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

    startSpinner(message) {
        this.spinner = ora(message).start();
    }

    stopSpinner(success = true, message = '') {
        if (!this.spinner) return;
        if (success) {
            this.spinner.succeed(message);
        } else {
            this.spinner.fail(message);
        }
        this.spinner = null;
    }
}

export const logger = new Logger();
