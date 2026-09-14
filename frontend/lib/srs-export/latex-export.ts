import type { AnalysisResult } from "@/types/analysis";
import { getFormatSpec, resolveFormatId } from "@/lib/formats";
import type { FormatSection, FormatField } from "@/lib/formats/types";
import {
    walkSection,
    toStr,
    getDiagramCode,
    type AnyData,
    type NormalizedRequirement,
    type SectionRenderer,
} from "./section-walker";

const LATEX_SPECIAL_MAP: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "&": "\\&",
    "%": "\\%",
    "$": "\\$",
    "#": "\\#",
    "_": "\\_",
    "{": "\\{",
    "}": "\\}",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
};

export function escapeLatex(text: string): string {
    if (!text) return "";
    return text.replace(/[\\&%$#_{}~^]/g, (match) => LATEX_SPECIAL_MAP[match] || match);
}

export function formatLatexText(text: string): string {
    if (!text) return "";
    const clean = toStr(text);
    const parts = clean.split(/(\*\*.*?\*\*|`.*?`)/g).filter(Boolean);
    return parts
        .map((part) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                return `\\textbf{${escapeLatex(part.slice(2, -2))}}`;
            }
            if (part.startsWith("`") && part.endsWith("`")) {
                return `\\texttt{${escapeLatex(part.slice(1, -1))}}`;
            }
            return escapeLatex(part);
        })
        .join("");
}

const EMPTY_NOTE = "\\textit{None specified.}\\par\\vspace{6pt}";

class LatexRenderer implements SectionRenderer {
    constructor(private readonly acronym: string) {}

    sectionHeading(section: FormatSection): string[] {
        const heading = section.appendix
            ? `\\section{Appendix ${section.number}: ${escapeLatex(section.title)}}`
            : `\\section{${escapeLatex(section.title)}}`;
        return [heading];
    }

    fieldHeading(_section: FormatSection, field: FormatField): string[] {
        return [`\\subsection{${escapeLatex(field.label)}}`];
    }

    emptyNote(): string[] {
        return [EMPTY_NOTE];
    }

    prose(text: string): string[] {
        return [formatLatexText(text), ""];
    }

    fieldProse(text: string): string[] {
        return text ? this.prose(text) : [EMPTY_NOTE, ""];
    }

    list(items: string[]): string[] {
        return ["\\begin{enumerate}[leftmargin=*]", ...items.map((item) => `    \\item ${formatLatexText(item)}`), "\\end{enumerate}", ""];
    }

    fieldList(items: string[]): string[] {
        return ["\\begin{itemize}[leftmargin=*]", ...items.map((item) => `    \\item ${formatLatexText(item)}`), "\\end{itemize}", ""];
    }

    userClassesField(items: AnyData[]): string[] {
        if (items.length === 0) return this.emptyNote();
        return this.userClassesTable("Class / Role", items);
    }

    userClassesSection(items: AnyData[]): string[] {
        if (items.length === 0) return [];
        return this.userClassesTable("User Class", items);
    }

    private userClassesTable(headerLabel: string, items: AnyData[]): string[] {
        return [
            "\\begin{table}[h!]",
            "\\centering",
            "\\begin{tabularx}{\\linewidth}{l X}",
            "\\toprule",
            `\\textbf{${headerLabel}} & \\textbf{Characteristics \\& Responsibilities} \\\\`,
            "\\midrule",
            ...items.map((u) => `\\textbf{${escapeLatex(String(u.userClass || u.name || "User"))}} & ${formatLatexText(String(u.characteristics || u.description || ""))} \\\\`),
            "\\bottomrule",
            "\\end{tabularx}",
            "\\end{table}",
            "",
        ];
    }

    private fallbackId(req: NormalizedRequirement): string {
        return `${this.acronym}-${req.bareFallbackId}`;
    }

    requirementItem(req: NormalizedRequirement, label: string, context: "group" | "feature"): string[] {
        const lines: string[] = [];
        const id = req.explicitId || this.fallbackId(req);
        // Plain-string feature requirements get a fixed title; every other case (shells, and
        // group shell-list items of either shape) uses the passed label. Matches the
        // pre-refactor split between the "Functional Requirement" literal and feat.name.
        const title = context === "feature" && !req.shell ? "Functional Requirement" : label;

        lines.push(`\\begin{requirementbox}{${escapeLatex(id)}}{${escapeLatex(title)}}{VERIFIED}`);
        lines.push(formatLatexText(req.shell ? req.shell.description : req.plainText));
        if (req.shell) {
            const shell = req.shell;
            if (shell.rationale || shell.fitCriterion || shell.verificationMethod || shell.source) {
                lines.push("\\begin{itemize}[leftmargin=*,itemsep=2pt,topsep=4pt]");
                if (shell.rationale) lines.push(`    \\item \\textbf{Rationale:} ${formatLatexText(shell.rationale)}`);
                if (shell.fitCriterion) lines.push(`    \\item \\textbf{Fit Criterion:} ${formatLatexText(shell.fitCriterion)}`);
                if (shell.verificationMethod) lines.push(`    \\item \\textbf{Verification:} ${formatLatexText(shell.verificationMethod)}`);
                if (shell.source) lines.push(`    \\item \\textbf{Source:} ${formatLatexText(shell.source)}`);
                lines.push("\\end{itemize}");
            }
        }
        lines.push("\\end{requirementbox}");
        lines.push("");
        return lines;
    }

    afterRequirementList(): string[] {
        return [];
    }

    featureHeading(_section: FormatSection, featureIndex: number, name: string): string[] {
        return [`\\subsection{${escapeLatex(name || `Feature ${featureIndex + 1}`)}}`];
    }

    srsHeading(): string[] {
        return ["\\subsubsection*{Stimulus-Response Sequences}"];
    }

    srsList(items: unknown[]): string[] {
        // formatLatexText takes the RAW item, matching the pre-refactor call exactly — its
        // internal toStr() silently returns "" for a non-string/array/`{content}` item,
        // which is the original (if surprising) behavior for a malformed item here.
        return [
            "\\begin{enumerate}[leftmargin=*]",
            ...items.map((item) => `    \\item ${formatLatexText(item as string)}`),
            "\\end{enumerate}",
            "",
        ];
    }

    featureReqsHeading(): string[] {
        return ["\\subsubsection*{Requirements Specifications}"];
    }

    noFeaturesNote(): string[] {
        return ["\\textit{No features specified.}\\par\\vspace{6pt}"];
    }

    stakeholdersTable(items: AnyData[]): string[] {
        if (items.length === 0) return [];
        return [
            "\\begin{table}[h!]",
            "\\centering",
            "\\begin{tabularx}{\\linewidth}{l X}",
            "\\toprule",
            "\\textbf{Stakeholder Role} & \\textbf{Core Interest \\& Success Measure} \\\\",
            "\\midrule",
            ...items.map((s) => `\\textbf{${escapeLatex(String(s.role || ""))}} & ${formatLatexText(String(s.interest || ""))} \\\\`),
            "\\bottomrule",
            "\\end{tabularx}",
            "\\end{table}",
            "",
        ];
    }

    personaBlock(persona: AnyData): string[] {
        const lines: string[] = [`\\begin{infobox}{Persona: ${escapeLatex(String(persona.name || ""))}}`];
        if (persona.description) lines.push(`\\textbf{Profile:} ${formatLatexText(String(persona.description))}\\\\`);
        if (Array.isArray(persona.goals) && persona.goals.length > 0) {
            lines.push("\\vspace{3pt}\\textbf{Primary Goals:}");
            lines.push("\\begin{itemize}[leftmargin=*,itemsep=1pt,topsep=2pt]");
            persona.goals.forEach((g) => lines.push(`    \\item ${formatLatexText(String(g))}`));
            lines.push("\\end{itemize}");
        }
        lines.push("\\end{infobox}", "");
        return lines;
    }

    userStoryBlock(story: AnyData, index: number): string[] {
        const lines: string[] = [
            `\\begin{requirementbox}{US-${index + 1}}{User Story: ${escapeLatex(String(story.role || "User"))}}{APPROVED}`,
            `\\textbf{As a} ${escapeLatex(String(story.role || ""))}, \\textbf{I want} ${formatLatexText(String(story.action || story.feature || ""))}, \\textbf{so that} ${formatLatexText(String(story.benefit || ""))}.`,
        ];
        if (Array.isArray(story.acceptanceCriteria) && story.acceptanceCriteria.length > 0) {
            lines.push("\\vspace{4pt}\\\\");
            lines.push("\\textbf{Acceptance Criteria:}");
            lines.push("\\begin{itemize}[leftmargin=*,itemsep=1pt,topsep=2pt]");
            story.acceptanceCriteria.forEach((ac) => lines.push(`    \\item ${formatLatexText(String(ac))}`));
            lines.push("\\end{itemize}");
        }
        lines.push("\\end{requirementbox}", "");
        return lines;
    }

    issuesList(items: AnyData[]): string[] {
        const lines: string[] = [];
        items.forEach((it) => {
            lines.push(`\\begin{warningbox}{Issue: ${escapeLatex(String(it.issue || ""))}}`);
            if (it.impact) lines.push(`\\textbf{Impact:} ${formatLatexText(String(it.impact))}\\\\`);
            if (it.mitigation) lines.push(`\\textbf{Mitigation:} ${formatLatexText(String(it.mitigation))}\\\\`);
            lines.push("\\end{warningbox}", "");
        });
        return lines;
    }

    glossaryTable(items: AnyData[]): string[] {
        if (items.length === 0) return [];
        return [
            "\\begin{table}[h!]",
            "\\centering",
            "\\begin{tabularx}{\\linewidth}{l X}",
            "\\toprule",
            "\\textbf{Term / Acronym} & \\textbf{Formal Definition} \\\\",
            "\\midrule",
            ...items.map((item) => `\\textbf{${escapeLatex(String(item.term || item.name || ""))}} & ${formatLatexText(String(item.definition || item.description || ""))} \\\\`),
            "\\bottomrule",
            "\\end{tabularx}",
            "\\end{table}",
            "",
        ];
    }

    diagramsBlock(models: AnyData | undefined): string[] {
        if (!models) return [];
        const lines: string[] = [];
        const push = (title: string, caption: string, code: string) => {
            if (!code) return;
            lines.push(
                `\\subsection{${title}}`,
                `\\begin{lstlisting}[language={},caption={${caption}}]`,
                code.trim(),
                "\\end{lstlisting}",
                ""
            );
        };
        push("System Architecture Flowchart", "Flowchart Model (Mermaid Source)", getDiagramCode(models.flowchartDiagram));
        push("Transaction Sequence Diagram", "Sequence Model (Mermaid Source)", getDiagramCode(models.sequenceDiagram));
        push("Entity Relationship Diagram", "Entity Relationship Model (Mermaid Source)", getDiagramCode(models.entityRelationshipDiagram));
        return lines;
    }
}

/**
 * Generates an exhaustive, production-grade LaTeX specification document (.tex) tailored for ANY format.
 */
export function exportSrsToLatex(
    data: AnalysisResult,
    title: string,
    formatId?: string
): { tex: string; filename: string } {
    const resolvedId = formatId || resolveFormatId(data);
    const spec = getFormatSpec(resolvedId);
    const safeTitle = (title || data.projectTitle || "SRS").trim();
    const acronym = safeTitle.split(/\s+/).map(w => w[0]).join("").toUpperCase() || "SRA";
    const anyData = data as unknown as AnyData;
    const renderer = new LatexRenderer(acronym);

    const lines: string[] = [];

    // Preamble
    lines.push("% ==========================================================================");
    lines.push(`% System Requirements Specification: ${safeTitle}`);
    lines.push(`% Specification Standard: ${spec.name} (${spec.id.toUpperCase()})`);
    lines.push(`% Generated with SRA (Smart Requirements Analyzer)`);
    lines.push(`% Date: ${new Date().toISOString().slice(0, 10)}`);
    lines.push("% ==========================================================================");
    lines.push("\\documentclass[11pt,a4paper]{article}");
    lines.push("\\usepackage[utf8]{inputenc}");
    lines.push("\\usepackage[T1]{fontenc}");
    lines.push("\\usepackage[margin=1in,headheight=15pt,footskip=30pt]{geometry}");
    lines.push("\\usepackage{booktabs}");
    lines.push("\\usepackage{tabularx}");
    lines.push("\\usepackage{tcolorbox}");
    lines.push("\\usepackage{fancyhdr}");
    lines.push("\\usepackage{xcolor}");
    lines.push("\\usepackage{enumitem}");
    lines.push("\\usepackage{microtype}");
    lines.push("\\usepackage{listings}");
    lines.push("\\usepackage{parskip}");
    lines.push("\\usepackage{lastpage}");
    lines.push("\\usepackage[hidelinks,colorlinks=true,linkcolor=sraprimary,urlcolor=sraaccent,citecolor=sraaccent]{hyperref}");
    lines.push("");

    // Colors
    lines.push("% Brand and Accent Palette");
    lines.push("\\definecolor{sraprimary}{HTML}{0F172A}");
    lines.push("\\definecolor{sraaccent}{HTML}{4F46E5}");
    lines.push("\\definecolor{slatebg}{HTML}{F8FAFC}");
    lines.push("\\definecolor{slateborder}{HTML}{E2E8F0}");
    lines.push("\\definecolor{darkslate}{HTML}{1E293B}");
    lines.push("\\definecolor{frcolor}{HTML}{6366F1}");
    lines.push("\\definecolor{prcolor}{HTML}{D97706}");
    lines.push("\\definecolor{statusgreen}{HTML}{16A34A}");
    lines.push("");

    // Custom Environments
    lines.push("% Custom Styled Environments");
    lines.push("\\tcbuselibrary{skins,breakable}");
    lines.push("\\newtcolorbox{requirementbox}[3]{");
    lines.push("    enhanced,");
    lines.push("    breakable,");
    lines.push("    colback=slatebg,");
    lines.push("    colframe=slateborder,");
    lines.push("    coltitle=darkslate,");
    lines.push("    fonttitle=\\bfseries\\sffamily,");
    lines.push("    title={\\textcolor{sraaccent}{\\texttt{#1}} \\quad #2 \\hfill \\footnotesize\\textsc{\\textcolor{statusgreen}{#3}}},");
    lines.push("    arc=2mm,");
    lines.push("    leftrule=4mm,");
    lines.push("    borderline west={4mm}{0pt}{frcolor},");
    lines.push("    boxrule=0.5pt,");
    lines.push("    top=8pt,");
    lines.push("    bottom=8pt,");
    lines.push("    left=10pt,");
    lines.push("    right=10pt,");
    lines.push("    before skip=10pt,");
    lines.push("    after skip=10pt");
    lines.push("}");
    lines.push("");
    lines.push("\\newtcolorbox{infobox}[1]{");
    lines.push("    enhanced,");
    lines.push("    breakable,");
    lines.push("    colback=slatebg,");
    lines.push("    colframe=sraaccent,");
    lines.push("    coltitle=sraprimary,");
    lines.push("    fonttitle=\\bfseries\\sffamily,");
    lines.push("    title={#1},");
    lines.push("    arc=1.5mm,");
    lines.push("    boxrule=0.8pt,");
    lines.push("    top=6pt,");
    lines.push("    bottom=6pt,");
    lines.push("    left=8pt,");
    lines.push("    right=8pt,");
    lines.push("    before skip=8pt,");
    lines.push("    after skip=8pt");
    lines.push("}");
    lines.push("");
    lines.push("\\newtcolorbox{warningbox}[1]{");
    lines.push("    enhanced,");
    lines.push("    breakable,");
    lines.push("    colback=white,");
    lines.push("    colframe=prcolor,");
    lines.push("    coltitle=prcolor,");
    lines.push("    fonttitle=\\bfseries\\sffamily,");
    lines.push("    title={#1},");
    lines.push("    arc=1.5mm,");
    lines.push("    leftrule=3mm,");
    lines.push("    boxrule=0.6pt,");
    lines.push("    top=6pt,");
    lines.push("    bottom=6pt,");
    lines.push("    left=8pt,");
    lines.push("    right=8pt,");
    lines.push("    before skip=8pt,");
    lines.push("    after skip=8pt");
    lines.push("}");
    lines.push("");

    // Listings Style
    lines.push("\\lstdefinestyle{sracodestyle}{");
    lines.push("    backgroundcolor=\\color{slatebg},");
    lines.push("    basicstyle=\\ttfamily\\footnotesize\\color{darkslate},");
    lines.push("    breakatwhitespace=false,");
    lines.push("    breaklines=true,");
    lines.push("    captionpos=b,");
    lines.push("    keepspaces=true,");
    lines.push("    numbers=none,");
    lines.push("    showspaces=false,");
    lines.push("    showstringspaces=false,");
    lines.push("    showtabs=false,");
    lines.push("    tabsize=2,");
    lines.push("    frame=single,");
    lines.push("    rulecolor=\\color{slateborder}");
    lines.push("}");
    lines.push("\\lstset{style=sracodestyle}");
    lines.push("");

    // Headers & Footers
    lines.push("\\pagestyle{fancy}");
    lines.push("\\fancyhf{}");
    lines.push(`\\fancyhead[L]{\\small\\textsl{${escapeLatex(safeTitle)} --- ${escapeLatex(spec.name)}}}`);
    lines.push(`\\fancyhead[R]{\\small\\textbf{\\textcolor{sraaccent}{${escapeLatex(spec.id.toUpperCase())}}}}`);
    lines.push("\\fancyfoot[L]{\\footnotesize\\textsc{\\textcolor{gray}{Confidential \\& Proprietary}}}");
    lines.push("\\fancyfoot[R]{\\footnotesize Page \\thepage\\ of \\pageref{LastPage}}");
    lines.push("\\renewcommand{\\headrulewidth}{0.4pt}");
    lines.push("\\renewcommand{\\footrulewidth}{0.4pt}");
    lines.push("");

    lines.push("\\begin{document}");
    lines.push("");

    // Title / Cover Page
    lines.push("% --- FORMAL COVER PAGE ---");
    lines.push("\\begin{titlepage}");
    lines.push("    \\centering");
    lines.push("    \\vspace*{1.5cm}");
    lines.push("    {\\Huge\\bfseries\\sffamily\\textcolor{sraprimary}{" + escapeLatex(safeTitle) + "} \\par}");
    lines.push("    \\vspace{0.6cm}");
    lines.push(`    {\\Large\\textsc{\\textcolor{sraaccent}{${escapeLatex(spec.coverSubtitle)}}} \\par}`);
    lines.push("    \\vspace{1.2cm}");
    lines.push("    {\\color{slateborder}\\rule{\\linewidth}{1.2pt}}\\\\[0.4cm]");
    lines.push(`    {\\large \\textbf{Standard:} ${escapeLatex(spec.name)} (${escapeLatex(spec.id.toUpperCase())}) \\quad \\textbf{Version:} 1.0.0}\\\\[0.2cm]`);
    lines.push("    {\\color{slateborder}\\rule{\\linewidth}{1.2pt}}");
    lines.push("    \\vspace{1.8cm}");
    lines.push("");
    lines.push("    \\begin{infobox}{Executive Scope \\& Purpose}");
    const introPurpose = toStr(anyData.overview || anyData.purpose || (anyData.introduction as AnyData)?.purpose) || "This formal engineering specification establishes the architectural, functional, non-functional, and verification baseline for the system.";
    lines.push(`        ${formatLatexText(introPurpose)}`);
    lines.push("    \\end{infobox}");
    lines.push("");
    lines.push("    \\vfill");
    lines.push("    \\begin{tabularx}{0.85\\linewidth}{rX}");
    lines.push("        \\textbf{Prepared By:} & Smart Requirements Analyzer (SRA) \\\\");
    lines.push(`        \\textbf{Standard Template:} & ${escapeLatex(spec.name)} \\\\`);
    lines.push(`        \\textbf{Release Date:} & ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} \\\\`);
    lines.push("        \\textbf{Classification:} & \\textsc{Confidential / Engineering Baseline} \\\\");
    lines.push("    \\end{tabularx}");
    lines.push("    \\vspace{1cm}");
    lines.push("\\end{titlepage}");
    lines.push("");

    // Table of Contents & Revision Table
    lines.push("\\tableofcontents");
    lines.push("\\newpage");
    lines.push("");

    lines.push("\\section*{Document Revision History}");
    lines.push("\\addcontentsline{toc}{section}{Document Revision History}");
    lines.push("\\begin{table}[h!]");
    lines.push("\\centering");
    lines.push("\\begin{tabularx}{\\linewidth}{l l X l}");
    lines.push("\\toprule");
    lines.push("\\textbf{Version} & \\textbf{Date} & \\textbf{Description of Changes} & \\textbf{Author / Source} \\\\");
    lines.push("\\midrule");
    if (Array.isArray(data.revisionHistory) && data.revisionHistory.length > 0) {
        data.revisionHistory.forEach(rev => {
            lines.push(`${escapeLatex(rev.version)} & ${escapeLatex(rev.date)} & ${formatLatexText(rev.description)} & ${escapeLatex(rev.author)} \\\\`);
        });
    } else {
        lines.push(`1.0.0 & ${new Date().toISOString().slice(0, 10)} & Baseline specification generated from architectural analysis & SRA Engine \\\\`);
    }
    lines.push("\\bottomrule");
    lines.push("\\end{tabularx}");
    lines.push("\\end{table}");
    lines.push("\\vspace{1cm}");
    lines.push("");

    // Dynamic Sections based on the chosen FormatSpec
    spec.sections.forEach((section) => {
        lines.push(...walkSection(section, anyData, renderer));
    });

    // Quality Audit & Compliance section (appended if present)
    if (data.qualityAudit || (Array.isArray(data.missingLogic) && data.missingLogic.length > 0) || (Array.isArray(data.contradictions) && data.contradictions.length > 0)) {
        lines.push("\\section{Quality Audit \\& Specification Integrity}");
        lines.push("");

        if (data.qualityAudit) {
            lines.push("\\begin{infobox}{Engineering Quality Score}");
            lines.push(`    \\textbf{Automated Compliance Score:} \\textcolor{sraaccent}{\\textbf{${data.qualityAudit.score}/100}}\\\\`);
            if (data.qualityAudit.ieeeCompliance?.status) {
                lines.push(`    \\textbf{Standard Adherence Status:} ${escapeLatex(data.qualityAudit.ieeeCompliance.status)}\\\\`);
            }
            lines.push("    \\vspace{4pt}");
            lines.push("    This score reflects automated verification of unambiguous phrasing, testability, non-contradiction, and section completeness.");
            lines.push("\\end{infobox}");
            lines.push("");
        }

        if (Array.isArray(data.contradictions) && data.contradictions.length > 0) {
            lines.push("\\begin{warningbox}{Identified Contradictions \\& Ambiguities}");
            lines.push("\\begin{itemize}[leftmargin=*]");
            data.contradictions.forEach(c => {
                lines.push(`    \\item ${formatLatexText(c)}`);
            });
            lines.push("\\end{itemize}");
            lines.push("\\end{warningbox}");
            lines.push("");
        }

        if (Array.isArray(data.missingLogic) && data.missingLogic.length > 0) {
            lines.push("\\begin{warningbox}{Missing Architectural Logic \\& Edge Cases}");
            lines.push("\\begin{itemize}[leftmargin=*]");
            data.missingLogic.forEach(m => {
                lines.push(`    \\item ${formatLatexText(m)}`);
            });
            lines.push("\\end{itemize}");
            lines.push("\\end{warningbox}");
            lines.push("");
        }
    }

    lines.push("\\end{document}");

    const tex = lines.join("\n");
    const filename = `${safeTitle.replace(/\s+/g, "_")}_${spec.id.toUpperCase()}.tex`;

    return { tex, filename };
}
