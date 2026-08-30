import type { AnalysisResult } from "@/types/analysis";
import { getFormatSpec, resolveFormatId } from "@/lib/formats";
import type { FormatSection } from "@/lib/formats/types";
import type { RequirementShell } from "@/lib/formats/types";

type AnyData = Record<string, unknown>;

const asArray = (v: unknown): AnyData[] => (Array.isArray(v) ? v as AnyData[] : []);
const isShell = (r: unknown): r is RequirementShell =>
    !!r && typeof r === "object" && "description" in (r as object);

const toStr = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(toStr).join("\n");
    if (v && typeof v === "object" && "content" in (v as Record<string, unknown>)) {
        return String((v as Record<string, unknown>).content || "");
    }
    return "";
};

const getDiagramCode = (d: unknown): string => {
    if (typeof d === "string") return d;
    if (d && typeof d === "object" && "code" in (d as Record<string, unknown>)) {
        return String((d as Record<string, unknown>).code || "");
    }
    return "";
};

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

/**
 * Builds LaTeX section blocks dynamically for ANY SRS standard (IEEE 830, ISO 29148, Volere, Agile PRD).
 */
function renderSectionToLatex(section: FormatSection, data: AnyData, acronym: string): string[] {
    const lines: string[] = [];
    const value = data[section.id];
    const sectionNum = section.number;
    const isAppendix = Boolean(section.appendix);
    const headingCmd = isAppendix ? `\\section{Appendix ${sectionNum}: ${escapeLatex(section.title)}}` : `\\section{${escapeLatex(section.title)}}`;

    lines.push(headingCmd);

    switch (section.kind) {
        case "prose":
            if (value) {
                lines.push(formatLatexText(toStr(value)));
                lines.push("");
            } else {
                lines.push("\\textit{None specified.}\\par\\vspace{6pt}");
            }
            break;

        case "list": {
            const list = Array.isArray(value) ? value : [];
            if (list.length > 0) {
                lines.push("\\begin{enumerate}[leftmargin=*]");
                list.forEach((item) => {
                    lines.push(`    \\item ${formatLatexText(typeof item === "string" ? item : JSON.stringify(item))}`);
                });
                lines.push("\\end{enumerate}");
                lines.push("");
            } else {
                lines.push("\\textit{None specified.}\\par\\vspace{6pt}");
            }
            break;
        }

        case "group": {
            const obj = (value || {}) as AnyData;
            (section.fields || []).forEach((field) => {
                lines.push(`\\subsection{${escapeLatex(field.label)}}`);
                const fVal = obj[field.id];
                if (field.kind === "prose") {
                    lines.push(formatLatexText(toStr(fVal)) || "\\textit{None specified.}\\par\\vspace{6pt}");
                    lines.push("");
                } else if (field.kind === "list") {
                    const fList = Array.isArray(fVal) ? fVal : [];
                    if (fList.length > 0) {
                        lines.push("\\begin{itemize}[leftmargin=*]");
                        fList.forEach((it) => lines.push(`    \\item ${formatLatexText(String(it))}`));
                        lines.push("\\end{itemize}");
                        lines.push("");
                    } else {
                        lines.push("\\textit{None specified.}\\par\\vspace{6pt}");
                    }
                } else if (field.kind === "user-classes") {
                    const ucs = asArray(fVal);
                    if (ucs.length > 0) {
                        lines.push("\\begin{table}[h!]");
                        lines.push("\\centering");
                        lines.push("\\begin{tabularx}{\\linewidth}{l X}");
                        lines.push("\\toprule");
                        lines.push("\\textbf{Class / Role} & \\textbf{Characteristics \\& Responsibilities} \\\\");
                        lines.push("\\midrule");
                        ucs.forEach((u) => {
                            lines.push(`\\textbf{${escapeLatex(String(u.userClass || u.name || "User"))}} & ${formatLatexText(String(u.characteristics || u.description || ""))} \\\\`);
                        });
                        lines.push("\\bottomrule");
                        lines.push("\\end{tabularx}");
                        lines.push("\\end{table}");
                        lines.push("");
                    } else {
                        lines.push("\\textit{None specified.}\\par\\vspace{6pt}");
                    }
                } else if (field.kind === "shell-list") {
                    const shells = Array.isArray(fVal) ? fVal : [];
                    shells.forEach((req, rIdx) => {
                        if (typeof req === "string") {
                            const reqId = `${acronym}-${field.id.slice(0, 3).toUpperCase()}-${rIdx + 1}`;
                            lines.push(`\\begin{requirementbox}{${escapeLatex(reqId)}}{${escapeLatex(field.label)}}{VERIFIED}`);
                            lines.push(formatLatexText(req));
                            lines.push("\\end{requirementbox}");
                            lines.push("");
                        } else if (isShell(req)) {
                            const shell = req as RequirementShell;
                            const reqId = shell.id || `${acronym}-${field.id.slice(0, 3).toUpperCase()}-${rIdx + 1}`;
                            lines.push(`\\begin{requirementbox}{${escapeLatex(reqId)}}{${escapeLatex(field.label)}}{VERIFIED}`);
                            lines.push(formatLatexText(shell.description));
                            if (shell.rationale || shell.fitCriterion || shell.verificationMethod || shell.source) {
                                lines.push("\\begin{itemize}[leftmargin=*,itemsep=2pt,topsep=4pt]");
                                if (shell.rationale) lines.push(`    \\item \\textbf{Rationale:} ${formatLatexText(shell.rationale)}`);
                                if (shell.fitCriterion) lines.push(`    \\item \\textbf{Fit Criterion:} ${formatLatexText(shell.fitCriterion)}`);
                                if (shell.verificationMethod) lines.push(`    \\item \\textbf{Verification:} ${formatLatexText(shell.verificationMethod)}`);
                                if (shell.source) lines.push(`    \\item \\textbf{Source:} ${formatLatexText(shell.source)}`);
                                lines.push("\\end{itemize}");
                            }
                            lines.push("\\end{requirementbox}");
                            lines.push("");
                        }
                    });
                }
            });
            break;
        }

        case "feature-list": {
            const feats = asArray(value);
            if (feats.length > 0) {
                feats.forEach((feat, idx) => {
                    lines.push(`\\subsection{${escapeLatex(String(feat.name || `Feature ${idx + 1}`))}}`);
                    if (feat.description) {
                        lines.push(formatLatexText(String(feat.description)));
                        lines.push("");
                    }

                    if (Array.isArray(feat.stimulusResponseSequences) && feat.stimulusResponseSequences.length > 0) {
                        lines.push("\\subsubsection*{Stimulus-Response Sequences}");
                        lines.push("\\begin{enumerate}[leftmargin=*]");
                        (feat.stimulusResponseSequences as string[]).forEach((srs) => {
                            lines.push(`    \\item ${formatLatexText(srs)}`);
                        });
                        lines.push("\\end{enumerate}");
                        lines.push("");
                    }

                    const reqs = Array.isArray(feat.functionalRequirements) ? feat.functionalRequirements : [];
                    if (reqs.length > 0) {
                        lines.push("\\subsubsection*{Requirements Specifications}");
                        reqs.forEach((req, reqIdx) => {
                            if (typeof req === "string") {
                                const reqId = `${acronym}-FR-${idx + 1}.${reqIdx + 1}`;
                                lines.push(`\\begin{requirementbox}{${escapeLatex(reqId)}}{Functional Requirement}{VERIFIED}`);
                                lines.push(formatLatexText(req));
                                lines.push("\\end{requirementbox}");
                                lines.push("");
                            } else if (isShell(req)) {
                                const shell = req as RequirementShell;
                                const reqId = shell.id || `${acronym}-FR-${idx + 1}.${reqIdx + 1}`;
                                lines.push(`\\begin{requirementbox}{${escapeLatex(reqId)}}{${escapeLatex(String(feat.name || ""))}}{VERIFIED}`);
                                lines.push(formatLatexText(shell.description));
                                if (shell.rationale || shell.fitCriterion || shell.verificationMethod || shell.source) {
                                    lines.push("\\begin{itemize}[leftmargin=*,itemsep=2pt,topsep=4pt]");
                                    if (shell.rationale) lines.push(`    \\item \\textbf{Rationale:} ${formatLatexText(shell.rationale)}`);
                                    if (shell.fitCriterion) lines.push(`    \\item \\textbf{Fit Criterion:} ${formatLatexText(shell.fitCriterion)}`);
                                    if (shell.verificationMethod) lines.push(`    \\item \\textbf{Verification:} ${formatLatexText(shell.verificationMethod)}`);
                                    if (shell.source) lines.push(`    \\item \\textbf{Source:} ${formatLatexText(shell.source)}`);
                                    lines.push("\\end{itemize}");
                                }
                                lines.push("\\end{requirementbox}");
                                lines.push("");
                            }
                        });
                    }
                });
            } else {
                lines.push("\\textit{No features specified.}\\par\\vspace{6pt}");
            }
            break;
        }

        case "user-classes": {
            const ucs = asArray(value);
            if (ucs.length > 0) {
                lines.push("\\begin{table}[h!]");
                lines.push("\\centering");
                lines.push("\\begin{tabularx}{\\linewidth}{l X}");
                lines.push("\\toprule");
                lines.push("\\textbf{User Class} & \\textbf{Characteristics \\& Responsibilities} \\\\");
                lines.push("\\midrule");
                ucs.forEach((uc) => {
                    lines.push(`\\textbf{${escapeLatex(String(uc.userClass || uc.name || "User"))}} & ${formatLatexText(String(uc.characteristics || uc.description || ""))} \\\\`);
                });
                lines.push("\\bottomrule");
                lines.push("\\end{tabularx}");
                lines.push("\\end{table}");
                lines.push("");
            }
            break;
        }

        case "stakeholders": {
            const list = asArray(value);
            if (list.length > 0) {
                lines.push("\\begin{table}[h!]");
                lines.push("\\centering");
                lines.push("\\begin{tabularx}{\\linewidth}{l X}");
                lines.push("\\toprule");
                lines.push("\\textbf{Stakeholder Role} & \\textbf{Core Interest \\& Success Measure} \\\\");
                lines.push("\\midrule");
                list.forEach((s) => {
                    lines.push(`\\textbf{${escapeLatex(String(s.role || ""))}} & ${formatLatexText(String(s.interest || ""))} \\\\`);
                });
                lines.push("\\bottomrule");
                lines.push("\\end{tabularx}");
                lines.push("\\end{table}");
                lines.push("");
            }
            break;
        }

        case "personas": {
            const list = asArray(value);
            list.forEach((p) => {
                lines.push(`\\begin{infobox}{Persona: ${escapeLatex(String(p.name || ""))}}`);
                if (p.description) lines.push(`\\textbf{Profile:} ${formatLatexText(String(p.description))}\\\\`);
                if (Array.isArray(p.goals) && p.goals.length > 0) {
                    lines.push("\\vspace{3pt}\\textbf{Primary Goals:}");
                    lines.push("\\begin{itemize}[leftmargin=*,itemsep=1pt,topsep=2pt]");
                    p.goals.forEach((g) => lines.push(`    \\item ${formatLatexText(String(g))}`));
                    lines.push("\\end{itemize}");
                }
                lines.push("\\end{infobox}");
                lines.push("");
            });
            break;
        }

        case "user-stories": {
            const list = asArray(value);
            list.forEach((s, i) => {
                lines.push(`\\begin{requirementbox}{US-${i + 1}}{User Story: ${escapeLatex(String(s.role || "User"))}}{APPROVED}`);
                lines.push(`\\textbf{As a} ${escapeLatex(String(s.role || ""))}, \\textbf{I want} ${formatLatexText(String(s.action || s.feature || ""))}, \\textbf{so that} ${formatLatexText(String(s.benefit || ""))}.`);
                if (Array.isArray(s.acceptanceCriteria) && s.acceptanceCriteria.length > 0) {
                    lines.push("\\vspace{4pt}\\\\");
                    lines.push("\\textbf{Acceptance Criteria:}");
                    lines.push("\\begin{itemize}[leftmargin=*,itemsep=1pt,topsep=2pt]");
                    s.acceptanceCriteria.forEach((ac) => lines.push(`    \\item ${formatLatexText(String(ac))}`));
                    lines.push("\\end{itemize}");
                }
                lines.push("\\end{requirementbox}");
                lines.push("");
            });
            break;
        }

        case "issues": {
            const list = asArray(value);
            if (list.length > 0) {
                list.forEach((it) => {
                    lines.push(`\\begin{warningbox}{Issue: ${escapeLatex(String(it.issue || ""))}}`);
                    if (it.impact) lines.push(`\\textbf{Impact:} ${formatLatexText(String(it.impact))}\\\\`);
                    if (it.mitigation) lines.push(`\\textbf{Mitigation:} ${formatLatexText(String(it.mitigation))}\\\\`);
                    lines.push("\\end{warningbox}");
                    lines.push("");
                });
            }
            break;
        }

        case "glossary": {
            const list = asArray(value);
            if (list.length > 0) {
                lines.push("\\begin{table}[h!]");
                lines.push("\\centering");
                lines.push("\\begin{tabularx}{\\linewidth}{l X}");
                lines.push("\\toprule");
                lines.push("\\textbf{Term / Acronym} & \\textbf{Formal Definition} \\\\");
                lines.push("\\midrule");
                list.forEach((item) => {
                    lines.push(`\\textbf{${escapeLatex(String(item.term || item.name || ""))}} & ${formatLatexText(String(item.definition || item.description || ""))} \\\\`);
                });
                lines.push("\\bottomrule");
                lines.push("\\end{tabularx}");
                lines.push("\\end{table}");
                lines.push("");
            }
            break;
        }

        case "diagrams": {
            const models = ((data.appendices as AnyData)?.analysisModels || value) as Record<string, unknown> | undefined;
            if (models) {
                const flowchart = getDiagramCode(models.flowchartDiagram);
                if (flowchart) {
                    lines.push("\\subsection{System Architecture Flowchart}");
                    lines.push("\\begin{lstlisting}[language={},caption={Flowchart Model (Mermaid Source)}]");
                    lines.push(flowchart.trim());
                    lines.push("\\end{lstlisting}");
                    lines.push("");
                }
                const sequence = getDiagramCode(models.sequenceDiagram);
                if (sequence) {
                    lines.push("\\subsection{Transaction Sequence Diagram}");
                    lines.push("\\begin{lstlisting}[language={},caption={Sequence Model (Mermaid Source)}]");
                    lines.push(sequence.trim());
                    lines.push("\\end{lstlisting}");
                    lines.push("");
                }
                const erd = getDiagramCode(models.entityRelationshipDiagram);
                if (erd) {
                    lines.push("\\subsection{Entity Relationship Diagram}");
                    lines.push("\\begin{lstlisting}[language={},caption={Entity Relationship Model (Mermaid Source)}]");
                    lines.push(erd.trim());
                    lines.push("\\end{lstlisting}");
                    lines.push("");
                }
            }
            break;
        }
    }

    return lines;
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
        lines.push(...renderSectionToLatex(section, anyData, acronym));
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
