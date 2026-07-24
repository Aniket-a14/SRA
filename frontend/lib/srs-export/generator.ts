import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    TableOfContents,
    Header,
    Footer,
    PageNumber,
} from "docx";
import type { AnalysisResult } from "@/types/analysis";
import { getAcronym } from "@/lib/utils";
import { RequirementCounter, type BuildContext } from "./types";
import { getFormatSpec } from "@/lib/formats";
import { buildSpecDoc } from "./specDoc";
import { revisionTable } from "./blocks";

/** Shared document styles — Times New Roman body, distinct heading weights (also drive the ToC). */
const documentStyles = {
    default: {
        document: { run: { font: "Times New Roman", size: 24 } },
        heading1: {
            run: { font: "Times New Roman", size: 32, bold: true, color: "111111" },
            paragraph: { spacing: { before: 280, after: 140 } },
        },
        heading2: {
            run: { font: "Times New Roman", size: 26, bold: true, color: "1a1a1a" },
            paragraph: { spacing: { before: 200, after: 100 } },
        },
        heading3: {
            run: { font: "Times New Roman", size: 24, bold: true, color: "1a1a1a" },
            paragraph: { spacing: { before: 160, after: 80 } },
        },
        heading4: {
            run: { font: "Times New Roman", size: 24, italics: true },
            paragraph: { spacing: { before: 120, after: 60 } },
        },
    },
};

const coverParagraphs = (projectTitle: string, subtitle: string): Paragraph[] => [
    new Paragraph({ spacing: { before: 2400 } }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: subtitle, bold: true, size: 44, font: "Arial" })],
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "for", size: 28, font: "Arial" })],
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 1200 },
        children: [new TextRun({ text: projectTitle, bold: true, size: 40, font: "Arial" })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "Version 1.0", size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "Prepared with Smart Requirements Analyzer", size: 24 })] }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), size: 24 })],
    }),
];

/**
 * Render an AnalysisResult into an editable Word (.docx) Blob using the chosen SRS format
 * template. Diagrams (`images`) are the captured PNG data URLs keyed by diagram id.
 */
export async function generateSrsDocx(
    data: AnalysisResult,
    title: string,
    formatId: string,
    images: Record<string, string> = {},
): Promise<Blob> {
    const spec = getFormatSpec(formatId);
    const projectTitle = data.introduction?.projectName || data.projectTitle || title || "Project";
    const acronym = getAcronym(projectTitle) || "SRA";

    const ctx: BuildContext = {
        data,
        images,
        projectTitle,
        acronym,
        counters: new RequirementCounter(),
    };

    const body = buildSpecDoc(spec, ctx);

    const headerText = `${spec.coverSubtitle} — ${projectTitle}`;

    const doc = new Document({
        styles: documentStyles,
        sections: [
            // Cover page — no header/footer.
            {
                properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
                children: coverParagraphs(projectTitle, spec.coverSubtitle),
            },
            // Body — restart page numbering, add running header + page footer, lead with a ToC.
            {
                properties: {
                    page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, pageNumbers: { start: 1 } },
                },
                headers: {
                    default: new Header({
                        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: headerText, italics: true, size: 18, color: "666666" })] })],
                    }),
                },
                footers: {
                    default: new Footer({
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: "Page ", size: 18, color: "666666" }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "666666" })],
                        })],
                    }),
                },
                children: [
                    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 120 }, children: [new TextRun({ text: "Table of Contents" })] }),
                    new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
                    new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 120 }, children: [new TextRun({ text: "Revision History" })] }),
                    ...revisionBlocks(data),
                    ...body,
                ],
            },
        ],
    });

    return Packer.toBlob(doc);
}

const revisionBlocks = (data: AnalysisResult) => [revisionTable(data.revisionHistory)];
