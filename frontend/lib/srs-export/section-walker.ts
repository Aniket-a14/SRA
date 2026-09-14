import type { FormatSection, FormatField } from "@/lib/formats/types";
import type { RequirementShell } from "@/lib/formats/types";

export type AnyData = Record<string, unknown>;

export const asArray = (v: unknown): AnyData[] => (Array.isArray(v) ? (v as AnyData[]) : []);
export const isShell = (r: unknown): r is RequirementShell =>
    !!r && typeof r === "object" && "description" in (r as object);

export const toStr = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(toStr).join("\n");
    if (v && typeof v === "object" && "content" in (v as Record<string, unknown>)) {
        return String((v as Record<string, unknown>).content || "");
    }
    return "";
};

export const getDiagramCode = (d: unknown): string => {
    if (typeof d === "string") return d;
    if (d && typeof d === "object" && "code" in (d as Record<string, unknown>)) {
        return String((d as Record<string, unknown>).code || "");
    }
    return "";
};

/**
 * One requirement item, normalized from either a plain string or a RequirementShell.
 *
 * `explicitId` is `shell.id` when the data supplied one — every renderer uses it verbatim,
 * with no prefix added. `bareFallbackId` is the position-derived id (e.g. "FR-1.1") used
 * only when there's no explicit id; latex/typst prepend their computed acronym to it,
 * markdown does not (a pre-existing per-format difference, preserved as-is — see
 * requirementItem's doc on the SectionRenderer interface for the sibling `source`-field
 * asymmetry this same id logic sits next to).
 */
export interface NormalizedRequirement {
    explicitId: string | null;
    bareFallbackId: string;
    shell: RequirementShell | null;
    plainText: string;
}

export const normalizeRequirement = (req: unknown, bareFallbackId: string): NormalizedRequirement | null => {
    if (typeof req === "string") return { explicitId: null, bareFallbackId, shell: null, plainText: req };
    if (isShell(req)) return { explicitId: req.id || null, bareFallbackId, shell: req, plainText: req.description };
    return null;
};

/**
 * Leaf renderer: every method returns the lines for ONE piece of content in that format's
 * own syntax. The walker below owns all data extraction, iteration, and id-numbering (which
 * was byte-identical across markdown/latex/typst); only the leaf syntax differs per format,
 * including a handful of deliberate per-format asymmetries (documented on each method) that
 * predate this refactor and are preserved exactly, not "fixed".
 */
export interface SectionRenderer {
    /** Section-level heading, e.g. "## 1. Introduction" / "\section{Introduction}". */
    sectionHeading(section: FormatSection): string[];
    /** Sub-heading for one field inside a `group` section. */
    fieldHeading(section: FormatSection, field: FormatField, fieldIndex: number): string[];
    /** "None specified." placeholder used by prose/list/group-field empty branches. */
    emptyNote(): string[];

    prose(text: string): string[];
    /**
     * Prose inside a `group` field. Markdown/typst always end with a blank line whether or
     * not `text` is empty, same as `emptyNote()`+`prose()` composed — but latex's group-field
     * prose always ends with a blank line even when empty, while its TOP-LEVEL prose (the
     * `prose` section kind) does not; a pre-existing asymmetry, preserved via this separate
     * method rather than folded into `prose`/`emptyNote`.
     */
    fieldProse(text: string): string[];
    /** Top-level `list` sections and a feature's stimulus-response sequences — latex renders these as `enumerate`. */
    list(items: string[]): string[];
    /** A `list`-kind field inside a `group` section — latex renders these as `itemize`, not `enumerate` (a pre-existing distinction, preserved). */
    fieldList(items: string[]): string[];
    /** Table/list of {userClass|name, characteristics|description} inside a `group` field — emits emptyNote() when empty. */
    userClassesField(items: AnyData[]): string[];
    /** Top-level `user-classes` section kind — emits NOTHING when empty (matches the pre-refactor asymmetry with the field variant above). */
    userClassesSection(items: AnyData[]): string[];
    /**
     * One requirement item. `context` distinguishes a `shell-list` group field / top-level
     * `requirement-group` from a feature's `functionalRequirements` — markdown shows a
     * shell's `source` attribution for `"feature"` but not `"group"` (a pre-existing
     * asymmetry in markdown-export.ts, preserved here rather than silently fixed; latex
     * shows it for both, typst for neither — see section-walker.ts's module doc).
     */
    requirementItem(req: NormalizedRequirement, label: string, context: "group" | "feature"): string[];
    /**
     * Emitted once after a `shell-list` group field's or a feature's requirement list
     * finishes. Markdown and typst push one blank line here (their `requirementItem` doesn't
     * add its own); latex's `requirementItem` already ends each item with a blank line, so
     * this is a no-op there. See section-walker.ts's module doc.
     */
    afterRequirementList(): string[];

    featureHeading(section: FormatSection, featureIndex: number, name: string): string[];
    /** Sub-heading before a feature's stimulus-response sequences — text differs per format. */
    srsHeading(): string[];
    /**
     * A feature's stimulus-response sequences. Typed `unknown[]` and NOT pre-stringified by
     * the walker on purpose: `AnalysisResult` declares this field `string[]`, but resultJson
     * isn't runtime-validated end to end, so a non-string item is possible on old/malformed
     * records. Each format's pre-refactor handling of that case was genuinely different
     * (markdown coerces via string interpolation, latex silently renders an empty line via
     * `toStr`'s fallback, typst throws a TypeError from calling `.replace` on a non-string) —
     * preserved exactly here rather than unified into one "improved" behavior, which would be
     * a silent behavior change smuggled into a refactor commit.
     */
    srsList(items: unknown[]): string[];
    /** Sub-heading before a feature's functional requirements — text differs per format. */
    featureReqsHeading(): string[];
    noFeaturesNote(): string[];

    stakeholdersTable(items: AnyData[]): string[];
    personaBlock(persona: AnyData): string[];
    userStoryBlock(story: AnyData, index: number): string[];
    issuesList(items: AnyData[]): string[];
    glossaryTable(items: AnyData[]): string[];
    diagramsBlock(models: AnyData | undefined): string[];
}

/**
 * Walks a FormatSpec's sections against format-shaped `data`, dispatching to `r` for every
 * piece of leaf content. Replaces the three near-identical `renderSectionToX` switch
 * statements previously duplicated across markdown-export.ts, latex-export.ts, and
 * typst-export.ts — this is the data-extraction/iteration logic that WAS byte-identical
 * across all three; only `r`'s methods vary per output format.
 *
 * `requirement-group` is a valid SectionKind (see lib/formats/types.ts and specDoc.ts, which
 * does handle it for DOCX) but no current FormatSpec uses it as a top-level section kind, and
 * none of the three pre-refactor string renderers had a case for it either — only a bare
 * heading was ever emitted for that kind here. Preserved as-is rather than newly implemented,
 * since adding real behavior for it now would be a scope change, not a refactor.
 */
export function walkSection(section: FormatSection, data: AnyData, r: SectionRenderer): string[] {
    const lines: string[] = [...r.sectionHeading(section)];
    const value = data[section.id];

    switch (section.kind) {
        case "prose":
            lines.push(...(value ? r.prose(toStr(value)) : r.emptyNote()));
            break;

        case "list": {
            const list = Array.isArray(value) ? value : [];
            lines.push(...(list.length > 0
                ? r.list(list.map((item) => (typeof item === "string" ? item : JSON.stringify(item))))
                : r.emptyNote()));
            break;
        }

        case "group": {
            const obj = (value || {}) as AnyData;
            (section.fields || []).forEach((field, fIdx) => {
                lines.push(...r.fieldHeading(section, field, fIdx));
                const fVal = obj[field.id];
                if (field.kind === "prose") {
                    lines.push(...r.fieldProse(toStr(fVal)));
                } else if (field.kind === "list") {
                    const fList = Array.isArray(fVal) ? fVal : [];
                    lines.push(...(fList.length > 0 ? r.fieldList(fList.map((it) => String(it))) : r.emptyNote()));
                } else if (field.kind === "user-classes") {
                    lines.push(...r.userClassesField(asArray(fVal)));
                } else if (field.kind === "shell-list") {
                    const shells = Array.isArray(fVal) ? fVal : [];
                    const prefix = field.id.slice(0, 3).toUpperCase();
                    shells.forEach((req, rIdx) => {
                        const normalized = normalizeRequirement(req, `${prefix}-${rIdx + 1}`);
                        if (normalized) lines.push(...r.requirementItem(normalized, field.label, "group"));
                    });
                    lines.push(...r.afterRequirementList());
                }
            });
            break;
        }

        case "requirement-group":
            // No pre-refactor string renderer had a case for this kind — only the section
            // heading (already pushed above) was ever emitted. See this function's doc.
            break;

        case "feature-list": {
            const feats = asArray(value);
            if (feats.length > 0) {
                feats.forEach((feat, idx) => {
                    lines.push(...r.featureHeading(section, idx, String(feat.name || `Feature ${idx + 1}`)));
                    if (feat.description) lines.push(...r.prose(String(feat.description)));

                    const srs = feat.stimulusResponseSequences;
                    if (Array.isArray(srs) && srs.length > 0) {
                        lines.push(...r.srsHeading());
                        lines.push(...r.srsList(srs));
                    }

                    const reqs = Array.isArray(feat.functionalRequirements) ? feat.functionalRequirements : [];
                    if (reqs.length > 0) {
                        lines.push(...r.featureReqsHeading());
                        reqs.forEach((req, reqIdx) => {
                            const normalized = normalizeRequirement(req, `FR-${idx + 1}.${reqIdx + 1}`);
                            if (normalized) lines.push(...r.requirementItem(normalized, String(feat.name || ""), "feature"));
                        });
                        lines.push(...r.afterRequirementList());
                    }
                });
            } else {
                lines.push(...r.noFeaturesNote());
            }
            break;
        }

        case "user-classes":
            lines.push(...r.userClassesSection(asArray(value)));
            break;

        case "stakeholders":
            lines.push(...r.stakeholdersTable(asArray(value)));
            break;

        case "personas":
            asArray(value).forEach((p) => lines.push(...r.personaBlock(p)));
            break;

        case "user-stories":
            asArray(value).forEach((s, i) => lines.push(...r.userStoryBlock(s, i)));
            break;

        case "issues":
            lines.push(...r.issuesList(asArray(value)));
            break;

        case "glossary":
            lines.push(...r.glossaryTable(asArray(value)));
            break;

        case "diagrams": {
            const models = ((data.appendices as AnyData)?.analysisModels || value) as AnyData | undefined;
            lines.push(...r.diagramsBlock(models));
            break;
        }
    }

    return lines;
}
