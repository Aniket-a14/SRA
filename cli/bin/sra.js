#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import dotenv from 'dotenv';

// Initialize Environment. `quiet` because dotenv otherwise prints a tip banner to stdout,
// which corrupts `--json` output for anything reading the CLI programmatically.
dotenv.config({ quiet: true });

import { CLI_VERSION } from '../src/lib/version.js';
import { init } from '../src/commands/init.js';
import { sync } from '../src/commands/sync.js';
import { check } from '../src/commands/check.js';
import { reverse } from '../src/commands/reverse.js';
import { push } from '../src/commands/push.js';
import { doctor } from '../src/commands/doctor.js';
import { review } from '../src/commands/review.js';
import { analyze } from '../src/commands/analyze.js';
import { status } from '../src/commands/status.js';
import { list, projects } from '../src/commands/list.js';
import { formats } from '../src/commands/formats.js';
import { hook } from '../src/commands/hook.js';

// The banner is decoration. It must never land in a `--json` pipe, and it is noise in a
// CI log, so it is drawn only for a human at an interactive terminal.
const wantsJson = process.argv.includes('--json');
if (!wantsJson && process.stdout.isTTY) {
    console.log(chalk.blue(figlet.textSync('SRA CLI', { horizontalLayout: 'full' })));
}

program
    .name('sra')
    .description('SRA CLI — bridging requirements and code')
    .version(CLI_VERSION);

program
    .command('init')
    .description('Link this folder to an analysis on the SRA platform')
    .option('-a, --analysis <id>', 'link a specific analysis without prompting')
    .option('-p, --project <id>', 'restrict the choice to one project')
    .option('--backend-url <url>', 'override the platform URL')
    .action(init);

program
    .command('analyze [source]')
    .description('Start an analysis from a file (or stdin) and wait for the spec')
    .option('-f, --format <id>', 'output format (see `sra formats`)')
    .option('-p, --project <id>', 'attach the analysis to a project')
    .option('--provider <name>', 'gemini | openai | claude | grok')
    .option('--model <name>', 'model id to run on (must belong to your key)')
    .option('--profile <name>', 'generation persona')
    .option('--depth <n>', 'detail level, 1-5')
    .option('--strictness <n>', 'quality strictness, 1-5')
    .option('--no-wait', 'queue and exit instead of following the run')
    .option('--json', 'machine-readable output')
    .action(analyze);

program
    .command('reverse')
    .description('Generate a requirements spec from an existing codebase')
    .option('--path <dir>', 'directory to scan (defaults to the working directory)')
    .option('-f, --format <id>', 'output format (see `sra formats`)')
    .option('-p, --project <id>', 'attach the analysis to a project')
    .option('-n, --notes <text>', 'context the code cannot convey (audience, domain, goals)')
    .option('-y, --yes', 'skip the confirmation prompt')
    .option('--dry-run', 'write the digest locally without calling the platform')
    .option('--provider <name>', 'gemini | openai | claude | grok')
    .option('--model <name>', 'model id to run on (must belong to your key)')
    .option('--no-wait', 'queue and exit instead of following the run')
    .option('--json', 'machine-readable output')
    .action(reverse);

program
    .command('sync')
    .description('Pull the latest specification from the platform')
    .option('-a, --analysis <id>', 'sync a specific analysis and link it')
    .option('--json', 'machine-readable output')
    .action(sync);

program
    .command('check')
    .description('Verify that requirements trace to files in this working tree')
    .option('-d, --deep', 'also confirm linked files mention the requirement\'s own terms')
    .option('-s, --suggest', 'propose files for requirement groups that have none')
    .option('--strict', 'exit non-zero on any unlinked, missing or rotted link')
    .option('--json', 'machine-readable output')
    .action(check);

program
    .command('push')
    .description('Publish local verification results and review decisions')
    .option('--new-version', 'create a new analysis version instead of updating in place')
    .option('--json', 'machine-readable output')
    .action(push);

program
    .command('review')
    .description('Interactively approve or reject AI-generated requirements')
    .option('--all', 'revisit requirements that were already decided')
    .option('--push', 'publish the decisions when the review ends')
    .action(review);

program
    .command('status')
    .description('Show the linked analysis, and optionally follow it live')
    .option('-a, --analysis <id>', 'inspect a specific analysis')
    .option('-w, --watch', 'stream pipeline progress until the run finishes')
    .option('--json', 'machine-readable output')
    .action(status);

program
    .command('list')
    .description('List the analyses on your account')
    .option('-l, --limit <n>', 'how many to show', '20')
    .option('--json', 'machine-readable output')
    .action(list);

program
    .command('projects')
    .description('List your projects')
    .option('--json', 'machine-readable output')
    .action(projects);

program
    .command('formats')
    .description('Show the specification formats the platform can generate')
    .option('--json', 'machine-readable output')
    .action(formats);

program
    .command('doctor')
    .description('Diagnose local setup, credentials and platform connectivity')
    .option('--json', 'machine-readable output')
    .action(doctor);

program
    .command('hook [action]')
    .description('Install or manage git pre-commit verification hooks (install | uninstall | status)')
    .option('--json', 'machine-readable output')
    .action(hook);

program.parse();
