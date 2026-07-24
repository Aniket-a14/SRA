import type { Paragraph, Table } from "docx";
import type { AnalysisResult } from "@/types/analysis";

/** A rendered Word body element. */
export type DocBlock = Paragraph | Table;

/**
 * Monotonic requirement-ID counters, shared across a single document render so that
 * every category (functional, performance, …) numbers sequentially regardless of which
 * format/section ordering emits it.
 */
export class RequirementCounter {
    private counts: Record<string, number> = {};
    next(category: string): number {
        this.counts[category] = (this.counts[category] || 0) + 1;
        return this.counts[category];
    }
}

/**
 * Everything the spec-driven builder needs to turn format-shaped data into Word blocks.
 * The format structure itself lives in `@/lib/formats` (shared with the results renderer);
 * this module only knows how to render each section kind to docx.
 */
export interface BuildContext {
    data: AnalysisResult;
    /** Diagram key → PNG data URL (from the capture step). Empty object if capture failed. */
    images: Record<string, string>;
    projectTitle: string;
    acronym: string;
    counters: RequirementCounter;
}
