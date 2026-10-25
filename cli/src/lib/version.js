import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '../../package.json'), 'utf-8'));

// Read at runtime rather than hardcoding a literal — a hardcoded string silently drifts
// from the real published version on every bump.
export const CLI_VERSION = pkg.version;

/**
 * The minimum Node.js version, taken from package.json `engines.node` (a `>=X.Y.Z` range) so
 * `sra doctor` and the published manifest cannot disagree. `sra doctor` used to hardcode 18
 * while the dependencies needed more, and reported a Node the CLI cannot run on as fine.
 */
export const MIN_NODE_VERSION = (String(pkg.engines?.node || '').match(/>=\s*(\d+(?:\.\d+){0,2})/) || [])[1] || '0.0.0';

const parts = (v) => String(v).replace(/^v/, '').split('.').map((n) => Number(n) || 0);

/** True when `version` (e.g. process.version) satisfies `minimum` (e.g. "22.12.0"). */
export function satisfiesMinimum(version, minimum = MIN_NODE_VERSION) {
    const a = parts(version);
    const b = parts(minimum);
    for (let i = 0; i < 3; i++) {
        if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
    }
    return true;
}
