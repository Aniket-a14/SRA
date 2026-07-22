#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Initialize Environment
dotenv.config();

// Read the version from package.json at runtime instead of hardcoding a literal here —
// a hardcoded string silently drifts from the real published version on every bump.
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

// Enterprise Structure Imports
import { init } from '../src/commands/init.js';
import { sync } from '../src/commands/sync.js';
import { check } from '../src/commands/check.js';
import { reverse } from '../src/commands/reverse.js';
import { push } from '../src/commands/push.js';
import { doctor } from '../src/commands/doctor.js';
import { review } from '../src/commands/review.js';

console.log(
    chalk.blue(
        figlet.textSync('SRA CLI', { horizontalLayout: 'full' })
    )
);

program
    .name('sra')
    .description('SRA CLI - Bridging Requirements and Code')
    .version(pkg.version);

program
    .command('init')
    .description('Initialize SRA project and link to remote analysis')
    .action(init);

program
    .command('sync')
    .description('Sync the latest specification from remote')
    .action(sync);

program
    .command('check')
    .description('Check that each feature\'s expected files exist on disk (presence check, not a correctness check)')
    .action(check);

program
    .command('reverse')
    .description('Reverse engineer requirements from existing codebase (not implemented yet)')
    .action(reverse);

program
    .command('push')
    .description('Push local verification status and file links back to server')
    .action(push);

program
    .command('doctor')
    .description('Run diagnostics to check SRA setup and connectivity')
    .action(doctor);

program
    .command('review')
    .description('Interactively review and approve AI-generated requirements')
    .action(review);

program.parse();
