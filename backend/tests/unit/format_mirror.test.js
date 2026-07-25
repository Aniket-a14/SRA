import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listFormats, getFormat } from '../../src/formats/index.js';

/**
 * The frontend keeps its own copy of the format descriptors (`frontend/lib/formats/specs.ts`)
 * so it can render a document without a round-trip. Two copies of the same contract drift
 * silently: ISO 29148 was still declared `requirementModel: "ieee"` on the frontend after the
 * backend moved it to the attribute-carrying model, which is exactly the kind of mismatch that
 * shows up as a broken requirements table in production rather than as a failing build.
 *
 * Read textually, the way lib/changelog.test.ts reads MDX frontmatter — vitest owns the
 * frontend and Jest owns the backend, and neither transforms the other's sources.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIRROR = path.resolve(__dirname, '../../../frontend/lib/formats/specs.ts');

const readMirror = () => fs.readFileSync(MIRROR, 'utf8');

/** Requirement models declared at the top level of each exported const in the mirror. */
const topLevelModels = (source) => {
    const models = {};
    // export const <name>: FormatSpec = { ... id: "x", ... requirementModel: "y", ...
    const blocks = source.split(/export const /).slice(1);
    for (const block of blocks) {
        const id = block.match(/\bid:\s*"([^"]+)"/)?.[1];
        const model = block.match(/^\s*requirementModel:\s*"([^"]+)"/m)?.[1];
        if (id && model) models[id] = model;
    }
    return models;
};

describe('frontend format mirror', () => {
    const source = readMirror();

    it('exists where the test expects it', () => {
        expect(fs.existsSync(MIRROR)).toBe(true);
    });

    it('declares every format the backend registry serves', () => {
        const mirrored = topLevelModels(source);
        for (const { id } of listFormats()) {
            expect(Object.keys(mirrored)).toContain(id);
        }
    });

    it('agrees with the backend on each format\'s requirement model', () => {
        const mirrored = topLevelModels(source);
        for (const [id, model] of Object.entries(mirrored)) {
            expect({ id, model }).toEqual({ id, model: getFormat(id).requirementModel });
        }
    });

    it('agrees on the requirement model of each requirement-carrying section', () => {
        for (const { id } of listFormats()) {
            const spec = getFormat(id);
            for (const section of spec.sections) {
                if (!section.requirementModel) continue;
                // The mirror states section models inline: { id: "systemFunctions", ..., requirementModel: "iso-29148" }
                const line = source
                    .split('\n')
                    .find(l => l.includes(`id: "${section.id}"`) && l.includes('requirementModel'));
                if (!line) continue;
                const model = line.match(/requirementModel:\s*"([^"]+)"/)?.[1];
                expect({ section: section.id, model })
                    .toEqual({ section: section.id, model: section.requirementModel });
            }
        }
    });

    it('keeps the RequirementModel union able to express every backend model', () => {
        const types = fs.readFileSync(path.resolve(__dirname, '../../../frontend/lib/formats/types.ts'), 'utf8');
        const union = types.match(/export type RequirementModel = ([^;]+);/)?.[1] || '';
        const backendModels = new Set(
            listFormats().flatMap(({ id }) => {
                const spec = getFormat(id);
                return [spec.requirementModel, ...spec.sections.map(s => s.requirementModel)];
            }).filter(Boolean)
        );
        for (const model of backendModels) {
            expect(union).toContain(`'${model}'`);
        }
    });
});
