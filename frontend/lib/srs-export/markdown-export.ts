import type { AnalysisResult } from "@/types/analysis";
import { getFormatSpec, resolveFormatId } from "@/lib/formats";
import type { FormatSection, FormatField } from "@/lib/formats/types";
import {
    walkSection,
    getDiagramCode,
    type AnyData,
    type NormalizedRequirement,
    type SectionRenderer,
} from "./section-walker";

class MarkdownRenderer implements SectionRenderer {
    sectionHeading(section: FormatSection): string[] {
        const heading = section.appendix
            ? `## Appendix ${section.number}: ${section.title}`
            : `## ${section.number}. ${section.title}`;
        return [heading, ""];
    }

    fieldHeading(section: FormatSection, field: FormatField, fieldIndex: number): string[] {
        return [`### ${section.number}.${fieldIndex + 1} ${field.label}`];
    }

    emptyNote(): string[] {
        return ["*None specified.*", ""];
    }

    prose(text: string): string[] {
        return [text, ""];
    }

    fieldProse(text: string): string[] {
        return text ? this.prose(text) : this.emptyNote();
    }

    list(items: string[]): string[] {
        return [...items.map((item) => `- ${item}`), ""];
    }

    fieldList(items: string[]): string[] {
        return this.list(items);
    }

    userClassesField(items: AnyData[]): string[] {
        if (items.length === 0) return this.emptyNote();
        return [...items.map((u) => `- **${u.userClass || u.name || "User"}:** ${u.characteristics || u.description || ""}`), ""];
    }

    userClassesSection(items: AnyData[]): string[] {
        if (items.length === 0) return [];
        return [...items.map((uc) => `- **${uc.userClass || uc.name || "User"}:** ${uc.characteristics || uc.description || ""}`), ""];
    }

    requirementItem(req: NormalizedRequirement, _label: string, context: "group" | "feature"): string[] {
        const lines: string[] = [];
        if (req.shell) {
            const shell = req.shell;
            const id = req.explicitId || req.bareFallbackId;
            lines.push(`- **${id}:** ${shell.description}`);
            if (shell.rationale) lines.push(`  - *Rationale:* ${shell.rationale}`);
            if (shell.fitCriterion) lines.push(`  - *Fit Criterion:* ${shell.fitCriterion}`);
            if (shell.verificationMethod) lines.push(`  - *Verification:* ${shell.verificationMethod}`);
            // Source is only shown for feature-list requirements, not group shell-list fields —
            // a pre-existing asymmetry in this file, preserved rather than fixed here. See
            // requirementItem's doc on the SectionRenderer interface.
            if (context === "feature" && shell.source) lines.push(`  - *Source:* ${shell.source}`);
        } else {
            const id = req.explicitId || req.bareFallbackId;
            lines.push(`- **${id}:** ${req.plainText}`);
        }
        return lines;
    }

    afterRequirementList(): string[] {
        return [""];
    }

    featureHeading(section: FormatSection, featureIndex: number, name: string): string[] {
        return [`### ${section.number}.${featureIndex + 1} ${name}`];
    }

    srsHeading(): string[] {
        return ["#### Stimulus-Response Sequences"];
    }

    srsList(items: unknown[]): string[] {
        // Matches the old `- ${srs}` template-literal interpolation, which coerces any value
        // (including a non-string) via the same algorithm as String().
        return this.list(items.map((item) => String(item)));
    }

    featureReqsHeading(): string[] {
        return ["#### Functional Requirements"];
    }

    noFeaturesNote(): string[] {
        return ["*No features specified.*", ""];
    }

    stakeholdersTable(items: AnyData[]): string[] {
        if (items.length === 0) return [];
        return [...items.map((s) => `- **${s.role || "Stakeholder"}:** ${s.interest || ""}`), ""];
    }

    personaBlock(persona: AnyData): string[] {
        const lines: string[] = [`### Persona: ${persona.name || "User"}`];
        if (persona.description) lines.push(`${persona.description}`);
        if (Array.isArray(persona.goals) && persona.goals.length > 0) {
            lines.push("**Goals:**");
            persona.goals.forEach((g) => lines.push(`- ${g}`));
        }
        lines.push("");
        return lines;
    }

    userStoryBlock(story: AnyData, index: number): string[] {
        const lines: string[] = [
            `#### US-${index + 1}: ${story.role || "User"}`,
            `**As a** ${story.role || ""}, **I want** ${story.action || story.feature || ""}, **so that** ${story.benefit || ""}.`,
        ];
        if (Array.isArray(story.acceptanceCriteria) && story.acceptanceCriteria.length > 0) {
            lines.push("");
            lines.push("**Acceptance Criteria:**");
            story.acceptanceCriteria.forEach((ac) => lines.push(`- ${ac}`));
        }
        lines.push("");
        return lines;
    }

    issuesList(items: AnyData[]): string[] {
        if (items.length === 0) return [];
        return [...items.map((it) => `- **${it.issue || "Issue"}:** ${it.impact || ""} *(Mitigation: ${it.mitigation || "None specified"})*`), ""];
    }

    glossaryTable(items: AnyData[]): string[] {
        if (items.length === 0) return [];
        return [...items.map((item) => `- **${item.term || item.name || ""}:** ${item.definition || item.description || ""}`), ""];
    }

    diagramsBlock(models: AnyData | undefined): string[] {
        if (!models) return [];
        const lines: string[] = [];
        const push = (title: string, code: string) => {
            if (!code) return;
            lines.push(`### ${title}`, "```mermaid", code.trim(), "```", "");
        };
        push("System Architecture Flowchart", getDiagramCode(models.flowchartDiagram));
        push("Sequence Model", getDiagramCode(models.sequenceDiagram));
        push("Entity Relationship Model", getDiagramCode(models.entityRelationshipDiagram));
        return lines;
    }
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
    const renderer = new MarkdownRenderer();

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
        lines.push(...walkSection(section, anyData, renderer));
    });

    const outputText = lines.join("\n");
    const filename = `${safeTitle.replace(/\s+/g, "_")}_${spec.id.toUpperCase()}.md`;

    return { text: outputText, filename };
}
