#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import dotenv from 'dotenv';

// Initialize Environment
dotenv.config();

// Enterprise Structure Imports
import { init } from '../src/commands/init.js';
import { sync } from '../src/commands/sync.js';
import { check } from '../src/commands/check.js';
import { reverse } from '../src/commands/reverse.js';
import { push } from '../src/commands/push.js';
import { doctor } from '../src/commands/doctor.js';

console.log(
    chalk.blue(
        figlet.textSync('SRA CLI', { horizontalLayout: 'full' })
    )
);

program
    .name('sra')
    .description('SRA CLI - Bridging Requirements and Code')
    .version('1.2.1');

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
    .description('Check local codebase compliance with specification')
    .action(check);

program
    .command('reverse')
    .description('Reverse engineer requirements from existing codebase (Beta)')
    .action(reverse);

program
    .command('push')
    .description('Push local verification status and file links back to server')
    .action(push);

program
    .command('doctor')
    .description('Run diagnostics to check SRA setup and connectivity')
    .action(doctor);

program.parse();
