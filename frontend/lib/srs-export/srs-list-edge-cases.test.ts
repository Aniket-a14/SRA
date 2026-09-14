import { describe, it, expect } from "vitest";
import { exportSrsToMarkdown } from "./markdown-export";
import { exportSrsToLatex } from "./latex-export";
import { exportSrsToTypst } from "./typst-export";
import type { AnalysisResult } from "@/types/analysis";

/**
 * Regression test for a defect caught in review of the section-walker refactor: a feature's
 * `stimulusResponseSequences` is typed `string[]`, but `resultJson` isn't runtime-validated
 * end to end, so a non-string item is possible on an older or malformed record. Before the
 * refactor, the three formats handled that case in three genuinely different ways (see
 * section-walker.ts's `srsList` doc). An early version of the refactor collapsed all three to
 * a uniform `String(item)`, silently changing latex's (empty line) and typst's (throws)
 * behavior. This locks in the original, format-specific behavior instead.
 */
const nonStringSrsData = {
    projectTitle: "Edge Case Test",
    systemFeatures: [
        {
            name: "Weird Feature",
            description: "Has a malformed SRS entry.",
            stimulusResponseSequences: [{ notAString: true }],
            functionalRequirements: [],
        },
    ],
} as unknown as AnalysisResult;

describe("stimulusResponseSequences with a non-string item (malformed/legacy data)", () => {
    it("markdown coerces the item via String() — no crash, best-effort text", () => {
        const { text } = exportSrsToMarkdown(nonStringSrsData, "Edge Case", "ieee830");
        expect(text).toContain("- [object Object]");
    });

    it("latex silently renders an empty line for the item — no crash", () => {
        const { tex } = exportSrsToLatex(nonStringSrsData, "Edge Case", "ieee830");
        expect(() => exportSrsToLatex(nonStringSrsData, "Edge Case", "ieee830")).not.toThrow();
        expect(tex).toContain("\\item ");
    });

    it("typst throws — matches the pre-refactor crash rather than silently succeeding with different output", () => {
        expect(() => exportSrsToTypst(nonStringSrsData, "Edge Case", "ieee830")).toThrow();
    });
});
