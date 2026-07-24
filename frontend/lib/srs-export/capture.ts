import type { AnalysisResult } from "@/types/analysis";
import { getAdditionalDiagrams } from "./blocks";

/** Convert a rendered SVG string into a PNG data URL via an offscreen canvas. */
const svgToPngDataUrl = (svg: string): Promise<string | null> =>
    new Promise((resolve) => {
        try {
            const parser = new DOMParser();
            const docEl = parser.parseFromString(svg, "image/svg+xml").documentElement;

            let width = 0;
            let height = 0;
            const viewBox = docEl.getAttribute("viewBox");
            if (viewBox) {
                const p = viewBox.split(/\s+/).map(parseFloat);
                if (p.length === 4) { width = p[2]; height = p[3]; }
            }
            width = width || parseFloat(docEl.getAttribute("width") || "800");
            height = height || parseFloat(docEl.getAttribute("height") || "600");
            docEl.setAttribute("width", `${width}px`);
            docEl.setAttribute("height", `${height}px`);

            const serialized = new XMLSerializer().serializeToString(docEl);
            const img = new Image();
            img.onload = () => {
                const scale = 2;
                const canvas = document.createElement("canvas");
                canvas.width = width * scale;
                canvas.height = height * scale;
                const cctx = canvas.getContext("2d");
                if (!cctx) return resolve(null);
                cctx.fillStyle = "#ffffff";
                cctx.fillRect(0, 0, canvas.width, canvas.height);
                cctx.scale(scale, scale);
                cctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/png", 1.0));
            };
            img.onerror = () => resolve(null);
            img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serialized);
        } catch {
            resolve(null);
        }
    });

/**
 * Capture every diagram in the analysis as a PNG data URL, keyed for the export engine:
 *  - canonical set ("flowchart", "sequence", "entityRelationship", "dataFlowLevel0/1")
 *    is reused from the existing off-screen React renderer in export-utils.
 *  - AI-selected dynamic diagrams are rendered here as "additional-{i}".
 */
export async function captureDiagrams(data: AnalysisResult): Promise<Record<string, string>> {
    const images: Record<string, string> = {};

    // 1. Canonical set — reuse the proven React/Mermaid off-screen capture.
    try {
        const { renderMermaidDiagrams } = await import("@/lib/export-utils");
        Object.assign(images, await renderMermaidDiagrams(data));
    } catch (e) {
        console.error("[SRS Export] Canonical diagram capture failed", e);
    }

    // 2. AI-selected dynamic diagrams — render each Mermaid source directly.
    const dynamic = getAdditionalDiagrams(data);
    if (dynamic.length > 0) {
        try {
            const mermaidModule = await import("mermaid");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mermaid = (mermaidModule as any).default;
            mermaid.initialize({ startOnLoad: false, theme: "base", securityLevel: "loose" });

            for (let i = 0; i < dynamic.length; i++) {
                try {
                    const id = `sra-add-${i}-${Math.random().toString(36).slice(2, 8)}`;
                    const { svg } = await mermaid.render(id, dynamic[i].code);
                    const png = await svgToPngDataUrl(svg);
                    if (png) images[`additional-${i}`] = png;
                } catch (err) {
                    console.warn(`[SRS Export] Dynamic diagram ${i} (${dynamic[i].type}) failed to render`, err);
                }
            }
        } catch (e) {
            console.error("[SRS Export] Mermaid load failed for dynamic diagrams", e);
        }
    }

    return images;
}
