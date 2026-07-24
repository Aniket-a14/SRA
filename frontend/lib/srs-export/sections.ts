import { Paragraph, TextRun } from "docx";
import type { BuildContext, DocBlock } from "./types";
import {
    heading,
    prose,
    paragraph,
    requirementList,
    stimulusResponseList,
    figure,
    diagramCode,
    diagramCaption,
    getAdditionalDiagrams,
} from "./blocks";

/**
 * System Features (IEEE §4-style). Each feature becomes a numbered subsection with
 * Description & Priority, Stimulus/Response, and its atomic functional requirements.
 * `chapterNum` is the parent chapter number (e.g. "4" or "6").
 */
export function systemFeaturesSection(ctx: BuildContext, chapterNum: string): DocBlock[] {
    const { data, acronym, counters } = ctx;
    const blocks: DocBlock[] = [];
    const features = data.systemFeatures || [];
    if (features.length === 0) {
        blocks.push(...prose(""));
        return blocks;
    }
    features.forEach((feature, i) => {
        const num = `${chapterNum}.${i + 1}`;
        blocks.push(heading(num, feature.name, 2));

        blocks.push(heading(`${num}.1`, "Description and Priority", 3));
        blocks.push(paragraph(feature.description));

        if (feature.stimulusResponseSequences && feature.stimulusResponseSequences.length > 0) {
            blocks.push(heading(`${num}.2`, "Stimulus/Response Sequences", 3));
            blocks.push(...stimulusResponseList(feature.stimulusResponseSequences));
        }

        blocks.push(heading(`${num}.3`, "Functional Requirements", 3));
        blocks.push(...requirementList(feature.functionalRequirements, "functional", acronym, counters));

        // Preserve CLI verification metadata when present.
        if (feature.status || (feature.verification_files && feature.verification_files.length > 0)) {
            if (feature.status) {
                blocks.push(new Paragraph({
                    spacing: { before: 80, after: 40 },
                    children: [
                        new TextRun({ text: "Implementation Status: ", bold: true }),
                        new TextRun({ text: feature.status.toUpperCase() }),
                    ],
                }));
            }
            if (feature.verification_files && feature.verification_files.length > 0) {
                blocks.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Associated Implementation Files:", bold: true })] }));
                feature.verification_files.forEach((f) => {
                    blocks.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: f, font: "Consolas", size: 18 })] }));
                });
            }
        }
    });
    return blocks;
}

/**
 * Analysis Models — the canonical diagram set PLUS the AI-selected dynamic diagrams.
 * `figurePrefix` seeds figure numbering (e.g. "B" → "Figure B.1"); `subLabel` seeds the
 * subsection headings (e.g. "B" → "B.1 Flowchart").
 */
export function analysisModelsSection(ctx: BuildContext, subLabel: string): DocBlock[] {
    const { data, images } = ctx;
    const models = data.appendices?.analysisModels;
    const blocks: DocBlock[] = [];
    if (!models) {
        blocks.push(...prose(""));
        return blocks;
    }

    let sub = 0;
    const nextSub = () => `${subLabel}.${++sub}`;

    if (models.flowchartDiagram) {
        blocks.push(heading(nextSub(), "Flowchart", 3));
        blocks.push(...figure(images, "flowchart", `Figure ${subLabel}.${sub}`, diagramCaption(models.flowchartDiagram, "System Flowchart"), diagramCode(models.flowchartDiagram)));
    }
    if (models.sequenceDiagram) {
        blocks.push(heading(nextSub(), "Sequence Diagram", 3));
        blocks.push(...figure(images, "sequence", `Figure ${subLabel}.${sub}`, diagramCaption(models.sequenceDiagram, "System Sequence Diagram"), diagramCode(models.sequenceDiagram)));
    }
    if (models.dataFlowDiagram) {
        if (images["dataFlowLevel0"]) {
            blocks.push(heading(nextSub(), "Data Flow Diagram — Level 0 (Context)", 3));
            blocks.push(...figure(images, "dataFlowLevel0", `Figure ${subLabel}.${sub}`, "Context Data Flow Diagram"));
        }
        if (images["dataFlowLevel1"]) {
            blocks.push(heading(nextSub(), "Data Flow Diagram — Level 1", 3));
            blocks.push(...figure(images, "dataFlowLevel1", `Figure ${subLabel}.${sub}`, "Level 1 Data Flow Diagram"));
        }
    }
    if (models.entityRelationshipDiagram) {
        blocks.push(heading(nextSub(), "Entity Relationship Diagram", 3));
        blocks.push(...figure(images, "entityRelationship", `Figure ${subLabel}.${sub}`, diagramCaption(models.entityRelationshipDiagram, "Entity Relationship Diagram"), diagramCode(models.entityRelationshipDiagram)));
    }

    // AI-selected dynamic diagrams — the model chose the most fitting Mermaid type per URS.
    const dynamic = getAdditionalDiagrams(data);
    dynamic.forEach((d, i) => {
        const title = d.appliesTo ? `${d.title} (${d.appliesTo})` : d.title;
        blocks.push(heading(nextSub(), `${title} — ${prettyType(d.type)}`, 3));
        blocks.push(...figure(images, `additional-${i}`, `Figure ${subLabel}.${sub}`, d.caption || d.title, d.code));
    });

    return blocks;
}

const TYPE_LABELS: Record<string, string> = {
    "flowchart": "Flowchart",
    "sequenceDiagram": "Sequence Diagram",
    "erDiagram": "Entity Relationship Diagram",
    "stateDiagram-v2": "State Diagram",
    "classDiagram": "Class Diagram",
    "journey": "User Journey",
    "gantt": "Gantt Chart",
    "mindmap": "Mind Map",
    "timeline": "Timeline",
    "quadrantChart": "Quadrant Chart",
    "requirementDiagram": "Requirement Diagram",
};

const prettyType = (type: string): string => TYPE_LABELS[type] || type;
