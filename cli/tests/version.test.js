import fs from 'node:fs';
import { MIN_NODE_VERSION, satisfiesMinimum } from '../src/lib/version.js';

describe('Node.js minimum', () => {
    it('comes from package.json engines, so doctor and the manifest cannot drift', () => {
        const engines = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).engines.node;
        expect(engines).toBe(`>=${MIN_NODE_VERSION}`);
        expect(MIN_NODE_VERSION).toBe('22.12.0');
    });

    it.each([
        ['v22.12.0', true], ['v22.13.1', true], ['v24.22.1', true], ['v26.9.0', true],
        ['v22.11.9', false], ['v20.19.0', false], ['v18.20.4', false]
    ])('%s satisfies >=22.12.0: %s', (v, ok) => {
        expect(satisfiesMinimum(v)).toBe(ok);
    });
});
