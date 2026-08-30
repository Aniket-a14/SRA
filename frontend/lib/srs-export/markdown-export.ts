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

function renderSectionToMarkdown(section: FormatSection, data: AnyData): string[] {
    const lines: string[] = [];
    const value = data[section.id];
    const sectionNum = section.number;
    const isAppendix = Boolean(section.appendix);
    const heading = isAppendix ? `## Appendix ${sectionNum}: ${section.title}` : `## ${sectionNum}. ${section.title}`;

    lines.push(heading);
    lines.push("");

    switch (section.kind) {
        case "prose":
            if (value) {
                lines.push(toStr(value));
                lines.push("");
            } else {
                lines.push("*None specified.*");
                lines.push("");
            }
            break;

        case "list": {
            const list = Array.isArray(value) ? value : [];
            if (list.length > 0) {
                list.forEach((item) => {
                    lines.push(`- ${typeof item === "string" ? item : JSON.stringify(item)}`);
                });
                lines.push("");
            } else {
                lines.push("*None specified.*");
                lines.push("");
            }
            break;
        }

        case "group": {
            const obj = (value || {}) as AnyData;
            (section.fields || []).forEach((field, fIdx) => {
                lines.push(`### ${sectionNum}.${fIdx + 1} ${field.label}`);
                const fVal = obj[field.id];
                if (field.kind === "prose") {
                    lines.push(toStr(fVal) || "*None specified.*");
                    lines.push("");
                } else if (field.kind === "list") {
                    const fList = Array.isArray(fVal) ? fVal : [];
                    if (fList.length > 0) {
                        fList.forEach((it) => lines.push(`- ${String(it)}`));
                        lines.push("");
                    } else {
                        lines.push("*None specified.*");
                        lines.push("");
                    }
                } else if (field.kind === "user-classes") {
                    const ucs = asArray(fVal);
                    if (ucs.length > 0) {
                        ucs.forEach((u) => {
                            lines.push(`- **${u.userClass || u.name || "User"}:** ${u.characteristics || u.description || ""}`);
                        });
                        lines.push("");
                    } else {
                        lines.push("*None specified.*");
                        lines.push("");
                    }
                } else if (field.kind === "shell-list") {
                    const shells = Array.isArray(fVal) ? fVal : [];
                    shells.forEach((req, rIdx) => {
                        if (typeof req === "string") {
                            lines.push(`- **${field.id.slice(0, 3).toUpperCase()}-${rIdx + 1}:** ${req}`);
                        } else if (isShell(req)) {
                            const shell = req as RequirementShell;
                            lines.push(`- **${shell.id || `${field.id.slice(0, 3).toUpperCase()}-${rIdx + 1}`}:** ${shell.description}`);
                            if (shell.rationale) lines.push(`  - *Rationale:* ${shell.rationale}`);
                            if (shell.fitCriterion) lines.push(`  - *Fit Criterion:* ${shell.fitCriterion}`);
                            if (shell.verificationMethod) lines.push(`  - *Verification:* ${shell.verificationMethod}`);
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
                    lines.push(`### ${sectionNum}.${idx + 1} ${feat.name || `Feature ${idx + 1}`}`);
                    if (feat.description) {
                        lines.push(String(feat.description));
                        lines.push("");
                    }

                    if (Array.isArray(feat.stimulusResponseSequences) && feat.stimulusResponseSequences.length > 0) {
                        lines.push("#### Stimulus-Response Sequences");
                        (feat.stimulusResponseSequences as string[]).forEach((srs) => {
                            lines.push(`- ${srs}`);
                        });
                        lines.push("");
                    }

                    const reqs = Array.isArray(feat.functionalRequirements) ? feat.functionalRequirements : [];
                    if (reqs.length > 0) {
                        lines.push("#### Functional Requirements");
                        reqs.forEach((req, reqIdx) => {
                            if (typeof req === "string") {
                                lines.push(`- **FR-${idx + 1}.${reqIdx + 1}:** ${req}`);
                            } else if (isShell(req)) {
                                const shell = req as RequirementShell;
                                lines.push(`- **${shell.id || `FR-${idx + 1}.${reqIdx + 1}`}:** ${shell.description}`);
                                if (shell.rationale) lines.push(`  - *Rationale:* ${shell.rationale}`);
                                if (shell.fitCriterion) lines.push(`  - *Fit Criterion:* ${shell.fitCriterion}`);
                                if (shell.verificationMethod) lines.push(`  - *Verification:* ${shell.verificationMethod}`);
                                if (shell.source) lines.push(`  - *Source:* ${shell.source}`);
                            }
                        });
                        lines.push("");
                    }
                });
            } else {
                lines.push("*No features specified.*");
                lines.push("");
            }
            break;
        }

        case "user-classes": {
            const ucs = asArray(value);
            if (ucs.length > 0) {
                ucs.forEach((uc) => {
                    lines.push(`- **${uc.userClass || uc.name || "User"}:** ${uc.characteristics || uc.description || ""}`);
                });
                lines.push("");
            }
            break;
        }

        case "stakeholders": {
            const list = asArray(value);
            if (list.length > 0) {
                list.forEach((s) => {
                    lines.push(`- **${s.role || "Stakeholder"}:** ${s.interest || ""}`);
                });
                lines.push("");
            }
            break;
        }

        case "personas": {
            const list = asArray(value);
            list.forEach((p) => {
                lines.push(`### Persona: ${p.name || "User"}`);
                if (p.description) lines.push(`${p.description}`);
                if (Array.isArray(p.goals) && p.goals.length > 0) {
                    lines.push("**Goals:**");
                    p.goals.forEach((g) => lines.push(`- ${g}`));
                }
                lines.push("");
            });
            break;
        }

        case "user-stories": {
            const list = asArray(value);
            list.forEach((s, i) => {
                lines.push(`#### US-${i + 1}: ${s.role || "User"}`);
                lines.push(`**As a** ${s.role || ""}, **I want** ${s.action || s.feature || ""}, **so that** ${s.benefit || ""}.`);
                if (Array.isArray(s.acceptanceCriteria) && s.acceptanceCriteria.length > 0) {
                    lines.push("");
                    lines.push("**Acceptance Criteria:**");
                    s.acceptanceCriteria.forEach((ac) => lines.push(`- ${ac}`));
                }
                lines.push("");
            });
            break;
        }

        case "issues": {
            const list = asArray(value);
            if (list.length > 0) {
                list.forEach((it) => {
                    lines.push(`- **${it.issue || "Issue"}:** ${it.impact || ""} *(Mitigation: ${it.mitigation || "None specified"})*`);
                });
                lines.push("");
            }
            break;
        }

        case "glossary": {
            const list = asArray(value);
            if (list.length > 0) {
                list.forEach((item) => {
                    lines.push(`- **${item.term || item.name || ""}:** ${item.definition || item.description || ""}`);
                });
                lines.push("");
            }
            break;
        }

        case "diagrams": {
            const models = ((data.appendices as AnyData)?.analysisModels || value) as Record<string, unknown> | undefined;
            if (models) {
                const flowchart = getDiagramCode(models.flowchartDiagram);
                if (flowchart) {
                    lines.push("### System Architecture Flowchart");
                    lines.push("```mermaid");
                    lines.push(flowchart.trim());
                    lines.push("```");
                    lines.push("");
                }
                const sequence = getDiagramCode(models.sequenceDiagram);
                if (sequence) {
                    lines.push("### Sequence Model");
                    lines.push("```mermaid");
                    lines.push(sequence.trim());
                    lines.push("```");
                    lines.push("");
                }
                const erd = getDiagramCode(models.entityRelationshipDiagram);
                if (erd) {
                    lines.push("### Entity Relationship Model");
                    lines.push("```mermaid");
                    lines.push(erd.trim());
                    lines.push("```");
                    lines.push("");
                }
            }
            break;
        }
    }

    return lines;
}

/**
 * Generates clean, standard-compliant Markdown for ANY SRS specification standard.
 */
export function exportSrsToMarkdown(
    data: AnalysisResult,
    title: string,
    formatId?: string
): { text: string; filename: string } {
    const resolvedId = formatId || resolveFormatId(data);
    const spec = getFormatSpec(resolvedId);
    const safeTitle = (title || data.projectTitle || "SRS").trim();
    const anyData = data as unknown as AnyData;

    const lines: string[] = [];

    // Header & Metadata
    lines.push(`# ${safeTitle}`);
    lines.push(`**Specification Standard:** ${spec.name} (${spec.id.toUpperCase()})  `);
    lines.push(`**Document Type:** ${spec.coverSubtitle}  `);
    lines.push(`**Generated by:** SRA (Smart Requirements Analyzer)  `);
    lines.push(`**Date:** ${new Date().toISOString().slice(0, 10)}  `);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Walk all sections defined by the chosen format
    spec.sections.forEach((section) => {
        lines.push(...renderSectionToMarkdown(section, anyData));
    });

    const outputText = lines.join("\n");
    const filename = `${safeTitle.replace(/\s+/g, "_")}_${spec.id.toUpperCase()}.md`;

    return { text: outputText, filename };
}
