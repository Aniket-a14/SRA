import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { exportSrsToMarkdown } from "./markdown-export";
import { exportSrsToLatex } from "./latex-export";
import { exportSrsToTypst } from "./typst-export";
import { ieee830Fixture, iso29148Fixture, volereFixture, agilePrdFixture } from "./__fixtures__/comprehensive-fixture";

/**
 * markdown-export.ts, latex-export.ts, and typst-export.ts used to each carry their own
 * ~150-370 line `renderSectionToX` switch statement, independently reimplementing the same
 * data-extraction/iteration logic (see section-walker.ts). This test locks their output to
 * golden fixtures captured from the pre-refactor code across all 4 real FormatSpecs and a
 * fixture exercising every section kind and group-field kind each format actually uses —
 * so the shared walker introduced by that refactor can't silently change what ships in a
 * user's exported document.
 */

const GOLDEN_DIR = path.join(__dirname, "__fixtures__", "golden");
const readGolden = (name: string) => readFileSync(path.join(GOLDEN_DIR, name), "utf-8");

const cases = [
    { id: "ieee830", data: ieee830Fixture },
    { id: "iso29148", data: iso29148Fixture },
    { id: "volere", data: volereFixture },
    { id: "agile-prd", data: agilePrdFixture },
];

describe("export renderer parity with pre-refactor golden output", () => {
    it.each(cases)("markdown: $id matches golden output byte-for-byte", ({ id, data }) => {
        const { text } = exportSrsToMarkdown(data, "Golden Title", id);
        expect(text).toBe(readGolden(`${id}.md`));
    });

    it.each(cases)("latex: $id matches golden output byte-for-byte", ({ id, data }) => {
        const { tex } = exportSrsToLatex(data, "Golden Title", id);
        expect(tex).toBe(readGolden(`${id}.tex`));
    });

    it.each(cases)("typst: $id matches golden output byte-for-byte", ({ id, data }) => {
        const { typ } = exportSrsToTypst(data, "Golden Title", id);
        expect(typ).toBe(readGolden(`${id}.typ`));
    });
});
