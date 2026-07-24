import { Paragraph, TextRun } from "docx";
import type { FormatSpec, FormatSection } from "@/lib/formats";
import type { RequirementShell } from "@/lib/formats/types";
import type { BuildContext, DocBlock } from "./types";
import {
    heading,
    prose,
    paragraph,
    bulletList,
    userClasses,
    glossaryTable,
    normalizeItem,
    richRuns,
} from "./blocks";
import { analysisModelsSection } from "./sections";

type AnyData = Record<string, unknown>;

const asArray = (v: unknown): AnyData[] => (Array.isArray(v) ? v as AnyData[] : []);
const isShell = (r: unknown): r is RequirementShell => !!r && typeof r === "object" && "description" in (r as object);

/** Render a requirement list whose items are plain strings (IEEE) or Volere shells. */
function requirementBlocks(items: unknown, prefix: string): DocBlock[] {
    const list = Array.isArray(items) ? items : [];
    if (list.length === 0) return [new Paragraph({ children: [new TextRun({ text: "None specified.", italics: true, color: "808080" })] })];
    const out: DocBlock[] = [];
    list.forEach((r, i) => {
        if (typeof r === "string") {
            out.push(new Paragraph({
                spacing: { after: 100 }, indent: { left: 360 },
                children: [new TextRun({ text: `${prefix}-${i + 1}: `, bold: true }), ...richRuns(normalizeItem(r))],
            }));
        } else if (isShell(r)) {
            out.push(new Paragraph({
                spacing: { after: 40 }, indent: { left: 360 },
                children: [new TextRun({ text: `${r.id || `${prefix}-${i + 1}`}: `, bold: true }), ...richRuns(normalizeItem(r.description))],
            }));
            if (r.rationale) out.push(new Paragraph({ spacing: { after: 20 }, indent: { left: 540 }, children: [new TextRun({ text: "Rationale: ", bold: true, size: 20 }), new TextRun({ text: r.rationale, size: 20 })] }));
            if (r.fitCriterion) out.push(new Paragraph({ spacing: { after: 20 }, indent: { left: 540 }, children: [new TextRun({ text: "Fit Criterion: ", bold: true, size: 20 }), new TextRun({ text: r.fitCriterion, size: 20 })] }));
            if (r.source) out.push(new Paragraph({ spacing: { after: 100 }, indent: { left: 540 }, children: [new TextRun({ text: "Source: ", bold: true, size: 20 }), new TextRun({ text: r.source, size: 20 })] }));
        }
    });
    return out;
}

function featureBlocks(section: FormatSection, items: unknown): DocBlock[] {
    const feats = asArray(items);
    if (feats.length === 0) return prose("");
    const out: DocBlock[] = [];
    feats.forEach((f, i) => {
        out.push(heading(`${section.number}.${i + 1}`, String(f.name || ""), 2));
        out.push(paragraph(String(f.description || "")));
        const srs = f.stimulusResponseSequences;
        if (Array.isArray(srs) && srs.length > 0) {
            srs.forEach((s) => out.push(new Paragraph({ spacing: { after: 40 }, indent: { left: 360 }, children: richRuns(String(s)) })));
        }
        out.push(...requirementBlocks(f.functionalRequirements, "FR"));
    });
    return out;
}

function groupBlocks(section: FormatSection, value: unknown): DocBlock[] {
    const obj = (value || {}) as AnyData;
    const out: DocBlock[] = [];
    (section.fields || []).forEach((field, idx) => {
        out.push(heading(`${section.number}.${idx + 1}`, field.label, 3));
        switch (field.kind) {
            case "prose": out.push(...prose(obj[field.id] as string)); break;
            case "list": out.push(...bulletList(obj[field.id] as string[])); break;
            case "user-classes": out.push(...userClasses(obj[field.id] as never)); break;
            case "shell-list": out.push(...requirementBlocks(obj[field.id], field.label.split(" ")[0].toUpperCase().slice(0, 3))); break;
        }
    });
    return out;
}

/** Render one section by its kind, reading the format-shaped data by section id. */
function sectionBlocks(section: FormatSection, ctx: BuildContext): DocBlock[] {
    const data = ctx.data as unknown as AnyData;
    const value = data[section.id];
    const label = section.appendix ? `Appendix ${section.number}:` : `${section.number}.`;

    const body: DocBlock[] = [heading(label, section.title, 1)];

    switch (section.kind) {
        case "prose": body.push(...prose(value as string)); break;
        case "list": body.push(...bulletList(value as string[])); break;
        case "group": body.push(...groupBlocks(section, value)); break;
        case "feature-list": body.push(...featureBlocks(section, value)); break;
        case "requirement-group": body.push(...requirementBlocks(value, "REQ")); break;
        case "user-classes": body.push(...userClasses(value as never)); break;
        case "glossary": body.push(glossaryTable(value as never)); break;
        case "diagrams": body.push(...analysisModelsSection(ctx, section.number)); break;
        case "stakeholders":
            asArray(value).forEach((s) => body.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `${s.role || ""}: `, bold: true }), new TextRun({ text: String(s.interest || "") })] })));
            break;
        case "personas":
            asArray(value).forEach((p) => {
                body.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: String(p.name || ""), bold: true })] }));
                if (p.description) body.push(paragraph(String(p.description)));
                if (Array.isArray(p.goals)) body.push(...bulletList(p.goals as string[]));
            });
            break;
        case "user-stories":
            asArray(value).forEach((s, i) => {
                body.push(new Paragraph({
                    spacing: { after: 40 }, indent: { left: 360 },
                    children: [new TextRun({ text: `US-${i + 1}: `, bold: true }), new TextRun({ text: `As a ${s.role || ""}, I want ${s.action || ""}, so that ${s.benefit || ""}.` })],
                }));
                if (Array.isArray(s.acceptanceCriteria)) body.push(...bulletList(s.acceptanceCriteria as string[]));
            });
            break;
        case "issues":
            asArray(value).forEach((it) => body.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: String(it.issue || ""), bold: true }), ...(it.impact ? [new TextRun({ text: ` — ${it.impact}`, size: 20 })] : [])] })));
            break;
    }
    return body;
}

/**
 * Build the ordered Word body for any format by walking its descriptor and rendering each
 * section from the format-shaped resultJson. One code path serves every format (IEEE, ISO,
 * Volere, Agile PRD) — the template is data.
 */
export function buildSpecDoc(spec: FormatSpec, ctx: BuildContext): DocBlock[] {
    return spec.sections.flatMap((section) => sectionBlocks(section, ctx));
}
