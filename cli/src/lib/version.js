import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));

// Read at runtime rather than hardcoding a literal — a hardcoded string silently drifts
// from the real published version on every bump.
export const CLI_VERSION = JSON.parse(
    readFileSync(join(here, '../../package.json'), 'utf-8')
).version;
