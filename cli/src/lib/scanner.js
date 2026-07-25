import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

// Directories that are never source: build output, vendored dependencies, VCS metadata.
// Only consulted when the project isn't a git repo — inside one, `.gitignore` decides.
const IGNORED_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', '.turbo',
    'vendor', 'target', '__pycache__', '.venv', 'venv', '.pytest_cache', '.mypy_cache',
    '.gradle', '.idea', '.vscode', 'bin', 'obj', '.cache', '.parcel-cache', '.svelte-kit'
]);

const LANGUAGES = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.py': 'Python', '.go': 'Go',
    '.java': 'Java', '.kt': 'Kotlin', '.rb': 'Ruby', '.php': 'PHP', '.cs': 'C#',
    '.rs': 'Rust', '.swift': 'Swift', '.scala': 'Scala', '.ex': 'Elixir', '.exs': 'Elixir',
    '.c': 'C', '.h': 'C', '.cpp': 'C++', '.hpp': 'C++', '.sql': 'SQL', '.prisma': 'Prisma',
    '.vue': 'Vue', '.svelte': 'Svelte'
};

const MANIFESTS = [
    'package.json', 'requirements.txt', 'pyproject.toml', 'Pipfile', 'go.mod',
    'pom.xml', 'build.gradle', 'build.gradle.kts', 'Cargo.toml', 'composer.json',
    'Gemfile', 'mix.exs', '*.csproj'
];

// Content scanning is the expensive half of a scan; these bound it so `sra reverse` on a
// large monorepo stays in seconds rather than minutes.
const MAX_FILES_SCANNED = 600;
const MAX_FILE_BYTES = 96 * 1024;

const SOURCE_EXTENSIONS = new Set(Object.keys(LANGUAGES));

const toPosix = (p) => p.split(path.sep).join('/');

/**
 * List candidate source files.
 *
 * Prefers `git ls-files`, which applies the repository's own `.gitignore` — reproducing
 * that ruleset by hand gets build output and secrets wrong in both directions. Falls back
 * to a bounded walk outside a repo.
 */
export async function collectFiles(cwd = process.cwd()) {
    let files = null;

    try {
        const { stdout } = await execFileAsync(
            'git',
            ['ls-files', '--cached', '--others', '--exclude-standard'],
            { cwd, maxBuffer: 32 * 1024 * 1024 }
        );
        files = stdout.split('\n').map(f => f.trim()).filter(Boolean);
        logger.debug(`Scanner: git listed ${files.length} files.`);
    } catch {
        logger.debug('Scanner: not a git repository (or git unavailable) — walking the tree.');
    }

    if (!files) files = await walk(cwd);

    return files
        .map(toPosix)
        .filter(f => !f.split('/').some(part => IGNORED_DIRS.has(part)));
}

async function walk(root, dir = root, acc = [], depth = 0) {
    if (depth > 12 || acc.length > 20000) return acc;

    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return acc;
    }

    for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue;
            await walk(root, full, acc, depth + 1);
        } else if (entry.isFile()) {
            acc.push(path.relative(root, full));
        }
    }
    return acc;
}

const PATTERNS = {
    // Express/Koa/Fastify, Flask/FastAPI, Spring, Go net/http, Rails, Laravel.
    routes: [
        // `api` is deliberately not in this list: it is the conventional name for an HTTP
        // *client*, so including it made every `api.get('/api/analyze')` call site read as
        // an endpoint the codebase serves.
        /\b(?:router|app|server)\s*\.\s*(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
        /@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi,
        /@(Get|Post|Put|Patch|Delete)Mapping\s*\(\s*(?:value\s*=\s*)?"([^"]+)"/g,
        /http\.HandleFunc\s*\(\s*"([^"]+)"/g,
        /Route::(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/gi
    ],
    // Prisma, Mongoose, SQLAlchemy/Django, TypeORM, ActiveRecord.
    models: [
        /^\s*model\s+([A-Z]\w*)\s*\{/gm,
        /(?:new\s+(?:mongoose\.)?Schema|mongoose\.model)\s*\(\s*['"`]?(\w+)?/g,
        /^\s*class\s+(\w+)\s*\(\s*(?:models\.Model|Base|db\.Model)\s*\)/gm,
        /@Entity\s*\(\s*\)?\s*(?:\r?\n)\s*export\s+class\s+(\w+)/g
    ],
    exports: [
        /^\s*export\s+(?:async\s+)?function\s+(\w+)/gm,
        /^\s*export\s+(?:const|let|class)\s+(\w+)/gm,
        /^\s*export\s+default\s+(?:async\s+)?(?:function|class)\s+(\w+)/gm,
        /^\s*(?:public\s+|private\s+)?(?:static\s+)?class\s+([A-Z]\w*)/gm,
        /^\s*def\s+(\w+)\s*\(/gm,
        /^\s*func\s+(?:\([^)]*\)\s*)?([A-Z]\w*)\s*\(/gm
    ]
};

const runPatterns = (patterns, text, sink) => {
    for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            // The capture holding the value differs by pattern (a verb may come first);
            // the last non-empty group is the name/path in every case above.
            const value = match.slice(1).filter(Boolean).pop();
            if (value) sink(value, match[1]);
        }
    }
};

/**
 * Read the codebase and pull out the structural facts a requirements document is written
 * against: what it exposes, what it stores, and what it is built from.
 *
 * @param {{ cwd?: string }} [options]
 * @returns {Promise<object>} structured scan result
 */
export async function scanCodebase({ cwd = process.cwd() } = {}) {
    const allFiles = await collectFiles(cwd);
    const sourceFiles = allFiles.filter(f => SOURCE_EXTENSIONS.has(path.extname(f)));

    const languages = {};
    for (const file of sourceFiles) {
        const language = LANGUAGES[path.extname(file)];
        if (language) languages[language] = (languages[language] || 0) + 1;
    }

    // Biggest-language-first: on a mixed repo the files that define the product's
    // behaviour are far likelier to be in the dominant language than in a stray script.
    const languageRank = Object.fromEntries(
        Object.entries(languages).sort((a, b) => b[1] - a[1]).map(([lang], i) => [lang, i])
    );
    const scanTargets = [...sourceFiles]
        .sort((a, b) => (languageRank[LANGUAGES[path.extname(a)]] ?? 99) - (languageRank[LANGUAGES[path.extname(b)]] ?? 99))
        .slice(0, MAX_FILES_SCANNED);

    const routes = new Map();
    const models = new Set();
    const exportsByFile = new Map();
    const fileContents = new Map();

    for (const file of scanTargets) {
        let text;
        try {
            const handle = await fs.open(path.join(cwd, file), 'r');
            try {
                const buffer = Buffer.alloc(MAX_FILE_BYTES);
                const { bytesRead } = await handle.read(buffer, 0, MAX_FILE_BYTES, 0);
                text = buffer.subarray(0, bytesRead).toString('utf-8');
            } finally {
                await handle.close();
            }
        } catch {
            continue;
        }

        if (text.includes('\0')) continue; // binary
        fileContents.set(file, text);

        runPatterns(PATTERNS.routes, text, (route, verb) => {
            if (!route.startsWith('/')) return;
            // A template literal or a concatenation is a request being built, not a route
            // being declared — `/api/analyze/${id}` is a call site, and reporting it as an
            // endpoint would put the source's own placeholders in the spec.
            if (route.includes('${') || route.includes("' +") || route.includes('" +')) return;
            const method = /^(get|post|put|patch|delete|all)$/i.test(verb) ? verb.toUpperCase() : 'ANY';
            routes.set(`${method} ${route}`, file);
        });
        runPatterns(PATTERNS.models, text, (name) => {
            if (name && /^[A-Z]/.test(name)) models.add(name);
        });

        const names = new Set();
        runPatterns(PATTERNS.exports, text, (name) => {
            if (name && !name.startsWith('_')) names.add(name);
        });
        if (names.size > 0) exportsByFile.set(file, [...names].slice(0, 20));
    }

    // Next.js/Nuxt file-system routing has no call site to match — the path is the folder.
    for (const file of allFiles) {
        const match = file.match(/(?:^|\/)app\/(.+)\/route\.[tj]sx?$/);
        if (match) routes.set(`ANY /${match[1].replace(/\(.*?\)\//g, '').replace(/\[([^\]]+)]/g, ':$1')}`, file);
    }

    return {
        root: path.basename(path.resolve(cwd)),
        cwd,
        fileCount: allFiles.length,
        sourceFileCount: sourceFiles.length,
        scannedFileCount: scanTargets.length,
        truncated: sourceFiles.length > MAX_FILES_SCANNED,
        languages,
        manifests: await readManifests(cwd, allFiles),
        directories: summarizeDirectories(sourceFiles),
        routes: [...routes.entries()].map(([signature, file]) => ({ signature, file })),
        models: [...models],
        exportsByFile,
        fileContents,
        files: allFiles
    };
}

/** Dependency manifests, reduced to the facts that describe the product. */
async function readManifests(cwd, files) {
    const found = [];

    for (const file of files) {
        const base = path.basename(file);
        const isManifest = MANIFESTS.some(m =>
            m.startsWith('*') ? base.endsWith(m.slice(1)) : base === m
        );
        if (!isManifest) continue;
        if (found.length >= 8) break;

        try {
            const raw = await fs.readFile(path.join(cwd, file), 'utf-8');
            found.push({ file, ...summarizeManifest(base, raw) });
        } catch {
            // Unreadable manifest is not worth failing a scan over.
        }
    }

    return found;
}

function summarizeManifest(base, raw) {
    if (base === 'package.json' || base === 'composer.json') {
        try {
            const parsed = JSON.parse(raw);
            return {
                name: parsed.name,
                description: parsed.description,
                scripts: Object.keys(parsed.scripts || {}).slice(0, 15),
                dependencies: Object.keys({ ...parsed.dependencies, ...parsed.require }).slice(0, 40)
            };
        } catch {
            return { dependencies: [] };
        }
    }

    const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    return { dependencies: lines.slice(0, 40) };
}

/** Top-level and second-level directories with their source-file counts. */
function summarizeDirectories(sourceFiles) {
    const counts = new Map();
    for (const file of sourceFiles) {
        const parts = file.split('/');
        if (parts.length < 2) continue;
        const key = parts.slice(0, Math.min(2, parts.length - 1)).join('/');
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([dir, count]) => ({ dir, count }));
}

/**
 * Render a scan as text for the analysis pipeline.
 *
 * Hard-bounded: `POST /api/analyze` caps input at 50,000 characters and rejects anything
 * larger outright, so the digest is assembled section by section against a budget and
 * truncated with an explicit note rather than being sent and refused.
 *
 * @param {object} scan - result of {@link scanCodebase}
 * @param {{ budget?: number, notes?: string }} [options]
 */
export function buildDigest(scan, { budget = 28000, notes = '' } = {}) {
    const parts = [];
    let used = 0;

    const add = (text) => {
        if (!text) return false;
        if (used + text.length > budget) return false;
        parts.push(text);
        used += text.length;
        return true;
    };

    const languageLine = Object.entries(scan.languages)
        .sort((a, b) => b[1] - a[1])
        .map(([lang, count]) => `${lang} (${count} file${count === 1 ? '' : 's'})`)
        .join(', ');

    add([
        `# Codebase: ${scan.root}`,
        '',
        'This is a structural digest of an existing software repository, extracted automatically.',
        'Infer the requirements this system already satisfies, and write them as a specification.',
        '',
        `Files: ${scan.fileCount} total, ${scan.sourceFileCount} source files.`,
        `Languages: ${languageLine || 'unknown'}.`,
        notes ? `\nProject notes from the maintainer:\n${notes}\n` : ''
    ].join('\n'));

    for (const manifest of scan.manifests) {
        const lines = [`\n## Manifest: ${manifest.file}`];
        if (manifest.name) lines.push(`Name: ${manifest.name}`);
        if (manifest.description) lines.push(`Description: ${manifest.description}`);
        if (manifest.scripts?.length) lines.push(`Scripts: ${manifest.scripts.join(', ')}`);
        if (manifest.dependencies?.length) lines.push(`Dependencies: ${manifest.dependencies.join(', ')}`);
        if (!add(lines.join('\n'))) break;
    }

    if (scan.directories.length) {
        add(`\n## Module layout\n${scan.directories.map(d => `${d.dir}/ — ${d.count} source files`).join('\n')}`);
    }

    if (scan.routes.length) {
        const shown = scan.routes.slice(0, 120);
        add(`\n## HTTP interface (${scan.routes.length} endpoints detected)\n${shown.map(r => `${r.signature}  [${r.file}]`).join('\n')}`);
    }

    if (scan.models.length) {
        add(`\n## Data entities\n${scan.models.slice(0, 80).join(', ')}`);
    }

    if (scan.exportsByFile.size) {
        const lines = [];
        for (const [file, names] of scan.exportsByFile) {
            lines.push(`${file}: ${names.join(', ')}`);
        }
        // Added incrementally so the section fills whatever budget is left instead of
        // being dropped whole for being one line too long.
        let header = '\n## Public symbols by module\n';
        for (const line of lines) {
            if (!add(header + line + '\n')) break;
            header = '';
        }
    }

    if (scan.truncated) {
        add(`\n(Note: only the ${scan.scannedFileCount} most relevant source files were inspected.)`);
    }

    return parts.join('');
}

/**
 * Rank files by how strongly they look like the implementation of a requirement.
 *
 * Deliberately a heuristic over identifiers and paths, not a semantic judgement: it
 * proposes candidates for a human to confirm, which is why `reverse`/`check` present the
 * result as evidence rather than proof.
 *
 * @param {object} scan
 * @param {string} text - requirement or feature text
 * @param {{ limit?: number }} [options]
 * @returns {Array<{file: string, score: number}>}
 */
export function findEvidence(scan, text, { limit = 5 } = {}) {
    const terms = extractTerms(text);
    if (terms.length === 0) return [];

    const scores = new Map();

    for (const [file, content] of scan.fileContents) {
        const haystackPath = file.toLowerCase();
        const lowered = content.toLowerCase();
        let score = 0;

        for (const term of terms) {
            // A term in the path is a much stronger signal than one in a comment.
            if (haystackPath.includes(term)) score += 3;
            const occurrences = lowered.split(term).length - 1;
            if (occurrences > 0) score += Math.min(occurrences, 4);
        }

        if (score > 0) scores.set(file, score);
    }

    return [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([file, score]) => ({ file, score }));
}

const STOPWORDS = new Set([
    'the', 'system', 'shall', 'must', 'should', 'will', 'user', 'users', 'allow', 'allows',
    'able', 'provide', 'provides', 'support', 'supports', 'with', 'from', 'that', 'this',
    'and', 'for', 'are', 'can', 'has', 'have', 'when', 'then', 'want', 'need', 'their',
    'they', 'them', 'all', 'any', 'each', 'into', 'via', 'been', 'being', 'such', 'data',
    'application', 'software', 'product', 'feature', 'requirement', 'requirements'
]);

/** Distinctive lowercase terms from requirement prose — the search keys for evidence. */
export function extractTerms(text) {
    const words = String(text || '')
        .replace(/[^a-zA-Z0-9\s-]/g, ' ')
        // Split camelCase/PascalCase so "resetPassword" also yields "reset" and "password".
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/[\s-]+/)
        .filter(w => w.length >= 4 && !STOPWORDS.has(w));

    return [...new Set(words)].slice(0, 12);
}
