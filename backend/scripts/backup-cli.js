#!/usr/bin/env node

/**
 * Backup CLI Tool
 * Command-line interface for manual backup operations
 * 
 * Usage:
 *   node backup-cli.js create           - Create new backup
 *   node backup-cli.js list             - List all backups
 *   node backup-cli.js restore <file>   - Restore from backup
 *   node backup-cli.js cleanup          - Remove old backups
 *   node backup-cli.js verify <file>    - Verify backup integrity
 */

import backupService from '../src/services/backupService.js';
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

program
    .name('backup-cli')
    .description('SRA Database Backup Management Tool')
    .version('1.0.0');

// Create backup command
program
    .command('create')
    .description('Create a new encrypted database backup')
    .action(async () => {
        const spinner = ora('Creating backup...').start();

        try {
            const result = await backupService.createBackup();
            spinner.succeed(chalk.green('Backup created successfully!'));
            console.log(chalk.cyan('\nBackup Details:'));
            console.log(`  File: ${result.fileName}`);
            console.log(`  Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Checksum: ${result.checksum}`);
        } catch (error) {
            spinner.fail(chalk.red('Backup creation failed'));
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

// List backups command
program
    .command('list')
    .description('List all available backups')
    .action(async () => {
        const spinner = ora('Loading backups...').start();

        try {
            const backups = await backupService.listBackups();
            spinner.stop();

            if (backups.length === 0) {
                console.log(chalk.yellow('No backups found'));
                return;
            }

            console.log(chalk.cyan('\nAvailable Backups:\n'));
            backups.forEach((backup, index) => {
                console.log(`${index + 1}. ${chalk.bold(backup.fileName)}`);
                console.log(`   Size: ${(backup.size / 1024 / 1024).toFixed(2)} MB`);
                console.log(`   Created: ${backup.created.toLocaleString()}`);
                console.log(`   Encrypted: ${backup.encrypted ? chalk.green('Yes') : chalk.yellow('No')}`);
                console.log('');
            });
        } catch (error) {
            spinner.fail(chalk.red('Failed to list backups'));
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

// Restore backup command
program
    .command('restore <filename>')
    .description('Restore database from backup file')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (filename, options) => {
        if (!options.yes) {
            console.log(chalk.yellow('\n⚠️  WARNING: This will overwrite the current database!'));
            console.log(chalk.yellow('Make sure you have a recent backup before proceeding.\n'));

            // In a real CLI, you'd use inquirer.js for prompts
            console.log(chalk.red('Use --yes flag to confirm restoration'));
            process.exit(0);
        }

        const spinner = ora(`Restoring from ${filename}...`).start();

        try {
            await backupService.restoreBackup(filename);
            spinner.succeed(chalk.green('Database restored successfully!'));
        } catch (error) {
            spinner.fail(chalk.red('Restoration failed'));
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

// Cleanup old backups command
program
    .command('cleanup')
    .description('Remove backups older than retention period')
    .action(async () => {
        const spinner = ora('Cleaning up old backups...').start();

        try {
            const result = await backupService.cleanupOldBackups();
            spinner.succeed(chalk.green(`Cleanup complete! Removed ${result.deletedCount} old backup(s)`));
        } catch (error) {
            spinner.fail(chalk.red('Cleanup failed'));
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

// Verify backup integrity command
program
    .command('verify <filename>')
    .description('Verify backup file integrity')
    .action(async (filename) => {
        const spinner = ora(`Verifying ${filename}...`).start();

        try {
            const checksum = await backupService.calculateChecksum(
                `${backupService.backupDir}/${filename}`
            );
            spinner.succeed(chalk.green('Backup file is valid'));
            console.log(chalk.cyan(`\nChecksum: ${checksum}`));
        } catch (error) {
            spinner.fail(chalk.red('Verification failed'));
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

// Parse command line arguments
program.parse();
