import type { AnalysisResult } from "@/types/analysis";
import { getFormatSpec, resolveFormatId } from "@/lib/formats";
import type { FormatSection, FormatField } from "@/lib/formats/types";
import {
    walkSection,
    type AnyData,
    type NormalizedRequirement,
    type SectionRenderer,
} from "./section-walker";

const escapeTypst = (text: string): string => {
    if (!text) return "";
    return text
        .replace(/\\/g, "\\\\")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/#/g, "\\#")
        .replace(/\$/g, "\\$")
        .replace(/@/g, "\\@");
};

const EMPTY_NOTE = "_None specified._";

class TypstRenderer implements SectionRenderer {
    constructor(private readonly acronym: string) {}

    sectionHeading(section: FormatSection): string[] {
        const heading = section.appendix
            ? `= Appendix ${section.number}: ${escapeTypst(section.title)}`
            : `= ${escapeTypst(section.title)}`;
        return [heading];
    }

    fieldHeading(_section: FormatSection, field: FormatField): string[] {
        return [`== ${escapeTypst(field.label)}`];
    }

    emptyNote(): string[] {
        return [EMPTY_NOTE, ""];
    }

    prose(text: string): string[] {
        return [escapeTypst(text), ""];
    }

    fieldProse(text: string): string[] {
        return text ? this.prose(text) : this.emptyNote();
    }

    list(items: string[]): string[] {
        return [...items.map((item) => `- ${escapeTypst(item)}`), ""];
    }

    fieldList(items: string[]): string[] {
        return this.list(items);
    }

    private table(headerLeft: string, headerRight: string, rows: [string, string][]): string[] {
        return [
            "#table(",
            "  columns: (1fr, 2fr),",
            "  stroke: 0.5pt + rgb(\"#cbd5e1\"),",
            "  fill: (col, row) => if row == 0 { rgb(\"#f1f5f9\") } else { none },",
            `  [*${headerLeft}*], [*${headerRight}*],`,
            ...rows.map(([left, right]) => `  [${left}], [${right}],`),
            ")",
            "",
        ];
    }

    userClassesField(items: AnyData[]): string[] {
        if (items.length === 0) return [];
        return this.table(
            "Class / Role",
            "Characteristics & Responsibilities",
            items.map((u) => [escapeTypst(String(u.userClass || u.name || "User")), escapeTypst(String(u.characteristics || u.description || ""))])
        );
    }

    userClassesSection(items: AnyData[]): string[] {
        return this.userClassesField(items);
    }

    private fallbackId(req: NormalizedRequirement): string {
        return `${this.acronym}-${req.bareFallbackId}`;
    }

    requirementItem(req: NormalizedRequirement, label: string, context: "group" | "feature"): string[] {
        const id = req.explicitId || this.fallbackId(req);
        const title = context === "feature" && !req.shell ? "Functional Requirement" : label;
        const body = escapeTypst(req.shell ? req.shell.description : req.plainText);

        if (!req.shell) {
            return [`#requirement("${id}", "${escapeTypst(title)}", [${body}])`];
        }

        const shell = req.shell;
        const rationale = shell.rationale ? `"${escapeTypst(shell.rationale)}"` : "none";
        const fit = shell.fitCriterion ? `"${escapeTypst(shell.fitCriterion)}"` : "none";
        const verification = shell.verificationMethod ? `"${escapeTypst(shell.verificationMethod)}"` : "none";
        return [
            `#requirement("${id}", "${escapeTypst(title)}", [${body}], rationale: ${rationale}, fit: ${fit}, verification: ${verification})`,
        ];
    }

    afterRequirementList(): string[] {
        return [""];
    }

    featureHeading(_section: FormatSection, featureIndex: number, name: string): string[] {
        return [`== ${escapeTypst(name || `Feature ${featureIndex + 1}`)}`];
    }

    srsHeading(): string[] {
        return ["=== Stimulus-Response Sequences"];
    }

    featureReqsHeading(): string[] {
        // Same as srsHeading(): typst never emitted "Functional Requirements"/"Requirements
        // Specifications" here, unlike markdown/latex.
        return [];
    }

    noFeaturesNote(): string[] {
        return [];
    }

    stakeholdersTable(items: AnyData[]): string[] {
        if (items.length === 0) return [];
        return this.table(
            "Stakeholder Role",
            "Interest & Success Measure",
            items.map((s) => [escapeTypst(String(s.role || "Stakeholder")), escapeTypst(String(s.interest || ""))])
        );
    }

    personaBlock(persona: AnyData): string[] {
        const lines: string[] = [`== Persona: ${escapeTypst(String(persona.name || "User"))}`];
        if (persona.description) lines.push(escapeTypst(String(persona.description)));
        if (Array.isArray(persona.goals) && persona.goals.length > 0) {
            lines.push("*Goals:*");
            persona.goals.forEach((g) => lines.push(`- ${escapeTypst(String(g))}`));
        }
        lines.push("");
        return lines;
    }

    userStoryBlock(story: AnyData, index: number): string[] {
        const lines: string[] = [
            `=== US-${index + 1}: ${escapeTypst(String(story.role || "User"))}`,
            `*As a* ${escapeTypst(String(story.role || ""))}, *I want* ${escapeTypst(String(story.action || story.feature || ""))}, *so that* ${escapeTypst(String(story.benefit || ""))}.`,
        ];
        if (Array.isArray(story.acceptanceCriteria) && story.acceptanceCriteria.length > 0) {
            lines.push("*Acceptance Criteria:*");
            story.acceptanceCriteria.forEach((ac) => lines.push(`- ${escapeTypst(String(ac))}`));
        }
        lines.push("");
        return lines;
    }

    issuesList(items: AnyData[]): string[] {
        if (items.length === 0) return [];
        return [
            ...items.map((it) => `- *${escapeTypst(String(it.issue || "Issue"))}:* ${escapeTypst(String(it.impact || ""))} _(Mitigation: ${escapeTypst(String(it.mitigation || "None specified"))})_`),
            "",
        ];
    }

    glossaryTable(items: AnyData[]): string[] {
        if (items.length === 0) return [];
        return [
            "#table(",
            "  columns: (1fr, 2fr),",
            "  stroke: 0.5pt + rgb(\"#cbd5e1\"),",
            "  fill: (col, row) => if row == 0 { rgb(\"#f1f5f9\") } else { none },",
            "  [*Term / Acronym*], [*Definition*],",
            ...items.map((item) => `  [*${escapeTypst(String(item.term || item.name || ""))}*], [${escapeTypst(String(item.definition || item.description || ""))}],`),
            ")",
            "",
        ];
    }

    diagramsBlock(): string[] {
        // Diagrams are embedded separately in the export bundle for typst, not inline —
        // matches the pre-refactor placeholder comment exactly.
        return ["// Architecture diagrams embedded in export bundle", ""];
    }
}

/**
 * Generates an executive, academic-grade Typst specification document (.typ) for ANY format.
 */
export function exportSrsToTypst(
    data: AnalysisResult,
    title: string,
    formatId?: string
): { typ: string; filename: string } {
    const resolvedId = formatId || resolveFormatId(data);
    const spec = getFormatSpec(resolvedId);
    const safeTitle = (title || data.projectTitle || "SRS").trim();
    const acronym = safeTitle.split(/\s+/).map(w => w[0]).join("").toUpperCase() || "SRA";
    const anyData = data as unknown as AnyData;
    const renderer = new TypstRenderer(acronym);

    const lines: string[] = [];

    // Document setup & Styling
    lines.push(`// System Requirements Specification: ${safeTitle}`);
    lines.push(`// Standard: ${spec.name} (${spec.id.toUpperCase()})`);
    lines.push(`// Generated with SRA (Smart Requirements Analyzer)`);
    lines.push("");
    lines.push("#set page(");
    lines.push("  paper: \"a4\",");
    lines.push("  margin: (x: 2cm, y: 2.5cm),");
    lines.push("  header: context {");
    lines.push("    if counter(page).get().first() > 1 [");
    lines.push(`      #text(size: 8pt, fill: rgb(\"#64748b\"), italic: true)[${escapeTypst(safeTitle)} --- ${escapeTypst(spec.name)}]`);
    lines.push("      #h(1fr)");
    lines.push(`      #text(size: 8pt, fill: rgb(\"#64748b\"), weight: \"bold\")[${escapeTypst(spec.id.toUpperCase())}]`);
    lines.push("    ]");
    lines.push("  },");
    lines.push("  footer: context {");
    lines.push("    if counter(page).get().first() > 1 [");
    lines.push("      #text(size: 8pt, fill: rgb(\"#64748b\"))[CONFIDENTIAL]");
    lines.push("      #h(1fr)");
    lines.push("      #text(size: 8pt, fill: rgb(\"#64748b\"))[Page #counter(page).display()]");
    lines.push("    ]");
    lines.push("  }");
    lines.push(")");
    lines.push("#set text(font: \"Liberation Sans\", size: 10pt, fill: rgb(\"#0f172a\"))");
    lines.push("#set par(justify: true, leading: 0.7em)");
    lines.push("");

    // Requirement Callout Box Function
    lines.push("#let requirement(id, title, body, rationale: none, fit: none, verification: none) = {");
    lines.push("  block(");
    lines.push("    width: 100%,");
    lines.push("    fill: rgb(\"#f8fafc\"),");
    lines.push("    stroke: (left: 3pt + rgb(\"#6366f1\"), rest: 0.5pt + rgb(\"#e2e8f0\")),");
    lines.push("    radius: (right: 4pt),");
    lines.push("    inset: (x: 10pt, y: 8pt),");
    lines.push("    spacing: 10pt,");
    lines.push("    [");
    lines.push("      #text(size: 9pt, weight: \"bold\", fill: rgb(\"#4f46e5\"))[#id]");
    lines.push("      #h(6pt)");
    lines.push("      #text(weight: \"bold\")[#title]");
    lines.push("      #v(4pt)");
    lines.push("      #body");
    lines.push("      #if rationale != none or fit != none or verification != none [");
    lines.push("        #v(4pt)");
    lines.push("        #line(length: 100%, stroke: 0.5pt + rgb(\"#e2e8f0\"))");
    lines.push("        #text(size: 8.5pt, fill: rgb(\"#475569\"))[");
    lines.push("          #if rationale != none [*Rationale:* #rationale \\ ]");
    lines.push("          #if fit != none [*Fit Criterion:* #fit \\ ]");
    lines.push("          #if verification != none [*Verification:* #verification]");
    lines.push("        ]");
    lines.push("      ]");
    lines.push("    ]");
    lines.push("  )");
    lines.push("}");
    lines.push("");

    // Cover Page
    lines.push("// --- COVER PAGE ---");
    lines.push("#align(center + horizon)[");
    lines.push(`  #text(size: 24pt, weight: \"bold\")[${escapeTypst(safeTitle)}]`);
    lines.push("  #v(8pt)");
    lines.push(`  #text(size: 14pt, fill: rgb(\"#475569\"))[${escapeTypst(spec.coverSubtitle)}]`);
    lines.push("  #v(20pt)");
    lines.push("  #line(length: 60%, stroke: 1pt + rgb(\"#cbd5e1\"))");
    lines.push("  #v(10pt)");
    lines.push(`  #text(size: 11pt, weight: \"medium\")[*Standard:* ${escapeTypst(spec.name)} (${escapeTypst(spec.id.toUpperCase())}) --- *Version:* 1.0.0]`);
    lines.push("  #v(10pt)");
    lines.push("  #line(length: 60%, stroke: 1pt + rgb(\"#cbd5e1\"))");
    lines.push("  #v(30pt)");
    lines.push("  #block(width: 80%, fill: rgb(\"#f1f5f9\"), radius: 4pt, inset: 12pt)[");
    lines.push("    #align(left)[");
    lines.push("      #text(weight: \"bold\")[Executive Brief:] \\");
    lines.push(`      This formal specification establishes the engineering and verification baseline for *${escapeTypst(safeTitle)}* according to the *${escapeTypst(spec.name)}* standard.`);
    lines.push("    ]");
    lines.push("  ]");
    lines.push("  #v(50pt)");
    lines.push("  #text(size: 10pt, fill: rgb(\"#64748b\"))[Prepared with *SRA (Smart Requirements Analyzer)*] \\");
    lines.push(`  #text(size: 10pt, fill: rgb(\"#64748b\"))[${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}]`);
    lines.push("]");
    lines.push("#pagebreak()");
    lines.push("");

    // Table of Contents
    lines.push("#outline(title: \"Table of Contents\", indent: auto)");
    lines.push("#pagebreak()");
    lines.push("");

    // Walk all sections defined by the chosen format
    spec.sections.forEach((section) => {
        lines.push(...walkSection(section, anyData, renderer));
    });

    const typ = lines.join("\n");
    const filename = `${safeTitle.replace(/\s+/g, "_")}_${spec.id.toUpperCase()}.typ`;

    return { typ, filename };
}
