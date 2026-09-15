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

// The golden fixtures embed the "generated on" date each renderer prints in its cover
// page/header, so it has to be pinned to whatever instant the fixtures were captured at
// (2026-09-14) rather than left to read the real wall clock — otherwise this test is a
// coin flip around every UTC midnight and fails outright on every later day.
const GOLDEN_GENERATED_AT = new Date("2026-09-14T00:00:00Z");

const cases = [
    { id: "ieee830", data: ieee830Fixture },
    { id: "iso29148", data: iso29148Fixture },
    { id: "volere", data: volereFixture },
    { id: "agile-prd", data: agilePrdFixture },
];

describe("export renderer parity with pre-refactor golden output", () => {
    it.each(cases)("markdown: $id matches golden output byte-for-byte", ({ id, data }) => {
        const { text } = exportSrsToMarkdown(data, "Golden Title", id, GOLDEN_GENERATED_AT);
        expect(text).toBe(readGolden(`${id}.md`));
    });

    it.each(cases)("latex: $id matches golden output byte-for-byte", ({ id, data }) => {
        const { tex } = exportSrsToLatex(data, "Golden Title", id, GOLDEN_GENERATED_AT);
        expect(tex).toBe(readGolden(`${id}.tex`));
    });

    it.each(cases)("typst: $id matches golden output byte-for-byte", ({ id, data }) => {
        const { typ } = exportSrsToTypst(data, "Golden Title", id, GOLDEN_GENERATED_AT);
        expect(typ).toBe(readGolden(`${id}.typ`));
    });
});
