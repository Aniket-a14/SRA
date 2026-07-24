import type { AnalysisResult } from "@/types/analysis";
import { generateSrsDocx } from "./generator";
import { captureDiagrams } from "./capture";
import { getFormatSpec, listFormatSpecs, resolveFormatId, DEFAULT_FORMAT_ID } from "@/lib/formats";

export { listFormatSpecs as listFormats, getFormatSpec as getFormat, resolveFormatId, DEFAULT_FORMAT_ID };
export type { FormatMeta as SrsFormatMeta } from "@/lib/formats";

/**
 * One-call SRS → editable Word export. Captures diagrams, renders the chosen format's template
 * from the format-shaped analysis data, and returns a .docx Blob (save it with file-saver).
 * If no formatId is passed, the document's own formatId is used (falling back to IEEE).
 */
export async function exportSrsToDocx(
    data: AnalysisResult,
    title: string,
    formatId?: string,
): Promise<{ blob: Blob; filename: string }> {
    const resolvedId = formatId || resolveFormatId(data);
    const spec = getFormatSpec(resolvedId);
    const images = await captureDiagrams(data);
    const blob = await generateSrsDocx(data, title, resolvedId, images);
    const safeTitle = (title || "SRS").replace(/\s+/g, "_");
    return { blob, filename: `${safeTitle}_${spec.id.toUpperCase()}.docx` };
}
