import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import inquirer from 'inquirer';

/**
 * Every prompt `type` the CLI asks inquirer for must be registered in the installed inquirer.
 * inquirer 14 throws on an unknown type (before it silently fell back to `input`), and it no
 * longer registers `list` (now `select`): `sra init` and `sra review` would have crashed at
 * their first prompt after the upgrade. Read from source so a new prompt is covered as well.
 */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith('.js') ? [full] : [];
});

describe('inquirer prompt types', () => {
    const files = walk(SRC).filter((f) => fs.readFileSync(f, 'utf8').includes('inquirer.prompt('));
    const used = files.flatMap((f) => {
        const text = fs.readFileSync(f, 'utf8');
        return [...text.matchAll(/type:\s*['"]([a-z]+)['"]/g)].map((m) => ({ file: path.relative(SRC, f), type: m[1] }));
    });

    it('finds the prompts it is meant to check', () => {
        expect(files.length).toBeGreaterThanOrEqual(3);
        expect(used.length).toBeGreaterThanOrEqual(4);
    });

    it('uses only types the installed inquirer registers', () => {
        const registered = new Set(Object.keys(inquirer.prompt.prompts));
        const unknown = used.filter((u) => !registered.has(u.type));
        expect(unknown).toEqual([]);
    });

    it('still exposes Separator, which review uses', () => {
        expect(typeof inquirer.Separator).toBe('function');
    });
});
