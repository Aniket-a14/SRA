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

function renderSectionToTypst(section: FormatSection, data: AnyData, acronym: string): string[] {
    const lines: string[] = [];
    const value = data[section.id];
    const sectionNum = section.number;
    const isAppendix = Boolean(section.appendix);
    const heading = isAppendix ? `= Appendix ${sectionNum}: ${escapeTypst(section.title)}` : `= ${escapeTypst(section.title)}`;

    lines.push(heading);

    switch (section.kind) {
        case "prose":
            if (value) {
                lines.push(escapeTypst(toStr(value)));
                lines.push("");
            } else {
                lines.push("_None specified._");
                lines.push("");
            }
            break;

        case "list": {
            const list = Array.isArray(value) ? value : [];
            if (list.length > 0) {
                list.forEach((item) => {
                    lines.push(`- ${escapeTypst(typeof item === "string" ? item : JSON.stringify(item))}`);
                });
                lines.push("");
            } else {
                lines.push("_None specified._");
                lines.push("");
            }
            break;
        }

        case "group": {
            const obj = (value || {}) as AnyData;
            (section.fields || []).forEach((field) => {
                lines.push(`== ${escapeTypst(field.label)}`);
                const fVal = obj[field.id];
                if (field.kind === "prose") {
                    lines.push(escapeTypst(toStr(fVal)) || "_None specified._");
                    lines.push("");
                } else if (field.kind === "list") {
                    const fList = Array.isArray(fVal) ? fVal : [];
                    if (fList.length > 0) {
                        fList.forEach((it) => lines.push(`- ${escapeTypst(String(it))}`));
                        lines.push("");
                    } else {
                        lines.push("_None specified._");
                        lines.push("");
                    }
                } else if (field.kind === "user-classes") {
                    const ucs = asArray(fVal);
                    if (ucs.length > 0) {
                        lines.push("#table(");
                        lines.push("  columns: (1fr, 2fr),");
                        lines.push("  stroke: 0.5pt + rgb(\"#cbd5e1\"),");
                        lines.push("  fill: (col, row) => if row == 0 { rgb(\"#f1f5f9\") } else { none },");
                        lines.push("  [*Class / Role*], [*Characteristics & Responsibilities*],");
                        ucs.forEach((u) => {
                            lines.push(`  [${escapeTypst(String(u.userClass || u.name || "User"))}], [${escapeTypst(String(u.characteristics || u.description || ""))}],`);
                        });
                        lines.push(")");
                        lines.push("");
                    }
                } else if (field.kind === "shell-list") {
                    const shells = Array.isArray(fVal) ? fVal : [];
                    shells.forEach((req, rIdx) => {
                        if (typeof req === "string") {
                            const reqId = `${acronym}-${field.id.slice(0, 3).toUpperCase()}-${rIdx + 1}`;
                            lines.push(`#requirement("${reqId}", "${escapeTypst(field.label)}", [${escapeTypst(req)}])`);
                        } else if (isShell(req)) {
                            const shell = req as RequirementShell;
                            const reqId = shell.id || `${acronym}-${field.id.slice(0, 3).toUpperCase()}-${rIdx + 1}`;
                            const rationale = shell.rationale ? `"${escapeTypst(shell.rationale)}"` : "none";
                            const fit = shell.fitCriterion ? `"${escapeTypst(shell.fitCriterion)}"` : "none";
                            const verification = shell.verificationMethod ? `"${escapeTypst(shell.verificationMethod)}"` : "none";
                            lines.push(
                                `#requirement("${reqId}", "${escapeTypst(field.label)}", [${escapeTypst(shell.description)}], rationale: ${rationale}, fit: ${fit}, verification: ${verification})`
                            );
                        }
                    });
                    lines.push("");
                }
            });
            break;
        }

        case "feature-list": {
            const feats = asArray(value);
            if (feats.length > 0) {
                feats.forEach((feat, idx) => {
                    lines.push(`== ${escapeTypst(String(feat.name || `Feature ${idx + 1}`))}`);
                    if (feat.description) {
                        lines.push(escapeTypst(String(feat.description)));
                        lines.push("");
                    }

                    if (Array.isArray(feat.stimulusResponseSequences) && feat.stimulusResponseSequences.length > 0) {
                        lines.push("=== Stimulus-Response Sequences");
                        (feat.stimulusResponseSequences as string[]).forEach((srs) => {
                            lines.push(`- ${escapeTypst(srs)}`);
                        });
                        lines.push("");
                    }

                    const reqs = Array.isArray(feat.functionalRequirements) ? feat.functionalRequirements : [];
                    if (reqs.length > 0) {
                        reqs.forEach((req, reqIdx) => {
                            if (typeof req === "string") {
                                const reqId = `${acronym}-FR-${idx + 1}.${reqIdx + 1}`;
                                lines.push(`#requirement("${reqId}", "Functional Requirement", [${escapeTypst(req)}])`);
                            } else if (isShell(req)) {
                                const shell = req as RequirementShell;
                                const reqId = shell.id || `${acronym}-FR-${idx + 1}.${reqIdx + 1}`;
                                const rationale = shell.rationale ? `"${escapeTypst(shell.rationale)}"` : "none";
                                const fit = shell.fitCriterion ? `"${escapeTypst(shell.fitCriterion)}"` : "none";
                                const verification = shell.verificationMethod ? `"${escapeTypst(shell.verificationMethod)}"` : "none";
                                lines.push(
                                    `#requirement("${reqId}", "${escapeTypst(String(feat.name || ""))}", [${escapeTypst(shell.description)}], rationale: ${rationale}, fit: ${fit}, verification: ${verification})`
                                );
                            }
                        });
                        lines.push("");
                    }
                });
            }
            break;
        }

        case "user-classes": {
            const ucs = asArray(value);
            if (ucs.length > 0) {
                lines.push("#table(");
                lines.push("  columns: (1fr, 2fr),");
                lines.push("  stroke: 0.5pt + rgb(\"#cbd5e1\"),");
                lines.push("  fill: (col, row) => if row == 0 { rgb(\"#f1f5f9\") } else { none },");
                lines.push("  [*Class / Role*], [*Characteristics & Responsibilities*],");
                ucs.forEach((uc) => {
                    lines.push(`  [${escapeTypst(String(uc.userClass || uc.name || "User"))}], [${escapeTypst(String(uc.characteristics || uc.description || ""))}],`);
                });
                lines.push(")");
                lines.push("");
            }
            break;
        }

        case "stakeholders": {
            const list = asArray(value);
            if (list.length > 0) {
                lines.push("#table(");
                lines.push("  columns: (1fr, 2fr),");
                lines.push("  stroke: 0.5pt + rgb(\"#cbd5e1\"),");
                lines.push("  fill: (col, row) => if row == 0 { rgb(\"#f1f5f9\") } else { none },");
                lines.push("  [*Stakeholder Role*], [*Interest & Success Measure*],");
                list.forEach((s) => {
                    lines.push(`  [${escapeTypst(String(s.role || "Stakeholder"))}], [${escapeTypst(String(s.interest || ""))}],`);
                });
                lines.push(")");
                lines.push("");
            }
            break;
        }

        case "personas": {
            const list = asArray(value);
            list.forEach((p) => {
                lines.push(`== Persona: ${escapeTypst(String(p.name || "User"))}`);
                if (p.description) lines.push(escapeTypst(String(p.description)));
                if (Array.isArray(p.goals) && p.goals.length > 0) {
                    lines.push("*Goals:*");
                    p.goals.forEach((g) => lines.push(`- ${escapeTypst(String(g))}`));
                }
                lines.push("");
            });
            break;
        }

        case "user-stories": {
            const list = asArray(value);
            list.forEach((s, i) => {
                lines.push(`=== US-${i + 1}: ${escapeTypst(String(s.role || "User"))}`);
                lines.push(`*As a* ${escapeTypst(String(s.role || ""))}, *I want* ${escapeTypst(String(s.action || s.feature || ""))}, *so that* ${escapeTypst(String(s.benefit || ""))}.`);
                if (Array.isArray(s.acceptanceCriteria) && s.acceptanceCriteria.length > 0) {
                    lines.push("*Acceptance Criteria:*");
                    s.acceptanceCriteria.forEach((ac) => lines.push(`- ${escapeTypst(String(ac))}`));
                }
                lines.push("");
            });
            break;
        }

        case "issues": {
            const list = asArray(value);
            if (list.length > 0) {
                list.forEach((it) => {
                    lines.push(`- *${escapeTypst(String(it.issue || "Issue"))}:* ${escapeTypst(String(it.impact || ""))} _(Mitigation: ${escapeTypst(String(it.mitigation || "None specified"))})_`);
                });
                lines.push("");
            }
            break;
        }

        case "glossary": {
            const list = asArray(value);
            if (list.length > 0) {
                lines.push("#table(");
                lines.push("  columns: (1fr, 2fr),");
                lines.push("  stroke: 0.5pt + rgb(\"#cbd5e1\"),");
                lines.push("  fill: (col, row) => if row == 0 { rgb(\"#f1f5f9\") } else { none },");
                lines.push("  [*Term / Acronym*], [*Definition*],");
                list.forEach((item) => {
                    lines.push(`  [*${escapeTypst(String(item.term || item.name || ""))}*], [${escapeTypst(String(item.definition || item.description || ""))}],`);
                });
                lines.push(")");
                lines.push("");
            }
            break;
        }

        case "diagrams":
            lines.push("// Architecture diagrams embedded in export bundle");
            lines.push("");
            break;
    }

    return lines;
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
        lines.push(...renderSectionToTypst(section, anyData, acronym));
    });

    const typ = lines.join("\n");
    const filename = `${safeTitle.replace(/\s+/g, "_")}_${spec.id.toUpperCase()}.typ`;

    return { typ, filename };
}
