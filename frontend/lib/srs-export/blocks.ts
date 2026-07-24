import {
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    ImageRun,
    BorderStyle,
} from "docx";
import type { AnalysisResult, Requirement, GlossaryItem, RevisionHistoryItem, UserCharacteristic } from "@/types/analysis";
import type { DocBlock, RequirementCounter } from "./types";

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const clean = (text?: string): string => (text || "").replace(/\s+/g, " ").trim();

/** Strip leading bullets/numbering and any pre-existing requirement ID prefix. */
export const normalizeItem = (text: string): string => {
    let out = text.replace(/^\s*(?:[-•\d.)]+\s*|\*(?!\*)\s*)/, "");
    out = out.replace(/^[A-Z]+-[A-Z]+-\d+\s*:?\s*/, "");
    return out.trim();
};

/** Parse a lightweight **bold** markdown span sequence into docx TextRuns. */
export const richRuns = (text: string, opts: { size?: number } = {}): TextRun[] => {
    const size = opts.size;
    const parts = clean(text).split(/(\*\*.*?\*\*)/g).filter(Boolean);
    if (parts.length === 0) return [new TextRun({ text: "", size })];
    return parts.map((part) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return new TextRun({ text: part.slice(2, -2), bold: true, size });
        }
        return new TextRun({ text: part, size });
    });
};

// ---------------------------------------------------------------------------
// Structural blocks
// ---------------------------------------------------------------------------

const HEADING_LEVELS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
];

export const heading = (numberOrTitle: string, title?: string, level = 1): Paragraph => {
    const text = title ? `${numberOrTitle}  ${title}` : numberOrTitle;
    return new Paragraph({
        heading: HEADING_LEVELS[Math.min(level, HEADING_LEVELS.length) - 1],
        pageBreakBefore: level === 1,
        spacing: { before: level === 1 ? 240 : 180, after: 120 },
        children: [new TextRun({ text })],
    });
};

export const paragraph = (text?: string): Paragraph =>
    new Paragraph({ spacing: { after: 160, line: 276 }, alignment: AlignmentType.JUSTIFIED, children: richRuns(text || "") });

/** Simple prose paragraph, or a graceful placeholder when the field is empty. */
export const prose = (text?: string): Paragraph[] => {
    const c = clean(text);
    if (!c) return [new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "Not specified.", italics: true, color: "808080" })] })];
    return [paragraph(c)];
};

export const bulletList = (items?: (string | Requirement)[]): Paragraph[] => {
    if (!items || items.length === 0) {
        return [new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "None specified.", italics: true, color: "808080" })] })];
    }
    return items.map((item) => {
        const text = typeof item === "string" ? item : item.description;
        return new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80 },
            children: richRuns(normalizeItem(clean(text))),
        });
    });
};

const CATEGORY_PREFIX: Record<string, string> = {
    functional: "FR",
    performance: "PR",
    safety: "SR",
    security: "SE",
    quality: "QA",
    business: "BR",
    other: "OR",
};

/** Numbered "ACRONYM-FR-1: The system shall…" requirement list with bold IDs. */
export const requirementList = (
    items: (string | Requirement)[] | undefined,
    category: keyof typeof CATEGORY_PREFIX,
    acronym: string,
    counters: RequirementCounter,
): Paragraph[] => {
    if (!items || items.length === 0) {
        return [new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "None specified.", italics: true, color: "808080" })] })];
    }
    const prefix = CATEGORY_PREFIX[category];
    return items.map((item) => {
        const text = normalizeItem(clean(typeof item === "string" ? item : item.description));
        const n = counters.next(category);
        const id = `${acronym}-${prefix}-${n}`;
        return new Paragraph({
            spacing: { after: 100 },
            indent: { left: 360 },
            children: [new TextRun({ text: `${id}: `, bold: true }), ...richRuns(text)],
        });
    });
};

/** Stimulus/Response sequences with the two keywords bolded. */
export const stimulusResponseList = (items?: string[]): Paragraph[] => {
    if (!items || items.length === 0) return [];
    const out: Paragraph[] = [];
    for (const raw of items) {
        const text = clean(raw);
        const m = text.match(/Stimulus:(.*?)Response:(.*)/i);
        if (m) {
            out.push(new Paragraph({
                spacing: { after: 40 }, indent: { left: 360 },
                children: [new TextRun({ text: "Stimulus: ", bold: true }), ...richRuns(m[1].trim())],
            }));
            out.push(new Paragraph({
                spacing: { after: 120 }, indent: { left: 360 },
                children: [new TextRun({ text: "Response: ", bold: true }), ...richRuns(m[2].trim())],
            }));
        } else {
            out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: richRuns(text) }));
        }
    }
    return out;
};

export const userClasses = (list?: UserCharacteristic[]): Paragraph[] => {
    if (!list || list.length === 0) return prose("");
    const out: Paragraph[] = [];
    for (const uc of list) {
        out.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: uc.userClass, bold: true })] }));
        out.push(new Paragraph({ spacing: { after: 120 }, indent: { left: 360 }, children: richRuns(clean(uc.characteristics)) }));
    }
    return out;
};

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

const cell = (children: Paragraph[], opts: { header?: boolean; width?: number } = {}): TableCell =>
    new TableCell({
        width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
        shading: opts.header ? { fill: "F2F2F2" } : undefined,
        children,
    });

const textCell = (text: string, opts: { header?: boolean; width?: number } = {}): TableCell =>
    cell([new Paragraph({ children: [new TextRun({ text: clean(text), bold: opts.header })] })], opts);

const FULL_BORDER = {
    top: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
    bottom: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
    left: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
    right: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
    insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "999999" },
};

export const genericTable = (head: string[], rows: string[][], widths?: number[]): Table =>
    new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: FULL_BORDER,
        rows: [
            new TableRow({
                tableHeader: true,
                children: head.map((h, i) => textCell(h, { header: true, width: widths?.[i] })),
            }),
            ...rows.map((r) => new TableRow({ children: r.map((c, i) => textCell(c, { width: widths?.[i] })) })),
        ],
    });

export const glossaryTable = (glossary?: GlossaryItem[]): DocBlock => {
    if (!glossary || glossary.length === 0) {
        return new Paragraph({ children: [new TextRun({ text: "No glossary terms defined.", italics: true, color: "808080" })] });
    }
    const sorted = [...glossary].sort((a, b) => a.term.localeCompare(b.term));
    return genericTable(["Term", "Definition"], sorted.map((g) => [g.term, clean(g.definition)]), [30, 70]);
};

export const revisionTable = (history?: RevisionHistoryItem[]): Table => {
    const rows = history && history.length > 0
        ? history.map((r) => [r.version, r.date, r.description, r.author])
        : [["1.0", new Date().toLocaleDateString("en-GB"), "Initial version", "Smart Requirements Analyzer"]];
    return genericTable(["Version", "Date", "Description", "Author"], rows, [15, 20, 45, 20]);
};

// ---------------------------------------------------------------------------
// Figures (diagram images)
// ---------------------------------------------------------------------------

/** Read intrinsic pixel dimensions from a PNG's IHDR chunk (bytes 16-23, big-endian). */
const pngDimensions = (bytes: Uint8Array): { width: number; height: number } | null => {
    if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
    const readU32 = (o: number) => (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];
    const width = readU32(16) >>> 0;
    const height = readU32(20) >>> 0;
    if (!width || !height) return null;
    return { width, height };
};

const dataUrlToUint8 = (dataUrl: string): Uint8Array | null => {
    try {
        const base64 = dataUrl.split(",")[1];
        if (!base64) return null;
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    } catch {
        return null;
    }
};

/** Embed a captured PNG diagram as a centered figure with a numbered caption. */
export const figure = (
    images: Record<string, string>,
    key: string,
    figureLabel: string,
    caption: string,
    fallbackCode?: string,
): DocBlock[] => {
    const dataUrl = images[key];
    const bytes = dataUrl ? dataUrlToUint8(dataUrl) : null;

    if (bytes) {
        // Fit within a portrait content column (~600px), preserving the diagram's true aspect
        // ratio read straight from the PNG IHDR header.
        const maxW = 600;
        const maxH = 760;
        const intrinsic = pngDimensions(bytes);
        let width = maxW;
        let height = Math.round(maxW * 0.62);
        if (intrinsic) {
            const ratio = intrinsic.height / intrinsic.width;
            width = Math.min(maxW, intrinsic.width);
            height = Math.round(width * ratio);
            if (height > maxH) {
                height = maxH;
                width = Math.round(height / ratio);
            }
        }
        return [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 60 },
                children: [new ImageRun({ type: "png", data: bytes, transformation: { width, height } })],
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 160 },
                children: [new TextRun({ text: `${figureLabel}: ${caption}`, italics: true, size: 20 })],
            }),
        ];
    }

    // Fallback: render the raw Mermaid source in a monospaced block so nothing is lost.
    const blocks: DocBlock[] = [];
    if (fallbackCode) {
        blocks.push(new Paragraph({
            spacing: { after: 60 },
            shading: { fill: "F7F7F7" },
            children: [new TextRun({ text: fallbackCode, font: "Consolas", size: 16 })],
        }));
    }
    blocks.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [new TextRun({ text: `${figureLabel}: ${caption}`, italics: true, size: 20 })],
    }));
    return blocks;
};

// ---------------------------------------------------------------------------
// Diagram extraction helpers (canonical + AI-selected dynamic set)
// ---------------------------------------------------------------------------

export const diagramCode = (d: unknown): string => {
    if (!d) return "";
    if (typeof d === "string") return d;
    if (typeof d === "object" && d !== null && "code" in d) return String((d as { code?: string }).code || "");
    return "";
};

export const diagramCaption = (d: unknown, fallback: string): string => {
    if (d && typeof d === "object" && "caption" in d) {
        const c = (d as { caption?: string }).caption;
        if (c) return c;
    }
    return fallback;
};

export interface DynamicDiagram {
    type: string;
    title: string;
    appliesTo?: string;
    code: string;
    caption?: string;
}

export const getAdditionalDiagrams = (data: AnalysisResult): DynamicDiagram[] => {
    const models = data.appendices?.analysisModels as { additionalDiagrams?: DynamicDiagram[] } | undefined;
    const list = models?.additionalDiagrams;
    if (!Array.isArray(list)) return [];
    return list.filter((d) => d && typeof d.code === "string" && d.code.trim().length > 0);
};
