import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';

/**
 * The Vercel project builds the backend with `pnpm --filter backend build`. pnpm 10.28 treated
 * a missing `build` script as a notice; pnpm 10.34 (pinned via packageManager) fails the build
 * with ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT, and both production deploys after the pin errored.
 */
const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url)));
const rootPkg = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url)));

describe('backend deploy contract', () => {
    it('has the build script the Vercel build command runs', () => {
        expect(pkg.scripts.build).toBe('prisma generate');
    });

    it('pins pnpm exactly, so Vercel, CI and Docker run the same version', () => {
        expect(rootPkg.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
    });

    it('pins the deployed Node major, so Vercel does not silently jump majors', () => {
        expect(pkg.engines.node).toMatch(/^\d+\.x$/);
    });
});
