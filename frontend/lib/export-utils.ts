import type { AnalysisResult, Diagram } from '@/types/analysis';
import type { DFDInput } from '@/components/DFDViewer';

// Helper: Convert SVG string to PNG Blob (used by the bundle exporter)
const svgToPng = (svgStr: string): Promise<Blob | null> => {
    return new Promise((resolve) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgStr, "image/svg+xml");
        const svgElement = doc.documentElement;

        let width = 0;
        let height = 0;

        const viewBox = svgElement.getAttribute('viewBox');
        if (viewBox) {
            const parts = viewBox.split(/\s+/).map(parseFloat);
            if (parts.length === 4) {
                width = parts[2];
                height = parts[3];
            }
        }

        if (width && height) {
            svgElement.setAttribute('width', `${width}px`);
            svgElement.setAttribute('height', `${height}px`);
        } else {
            width = parseFloat(svgElement.getAttribute('width') || '0');
            height = parseFloat(svgElement.getAttribute('height') || '0');
        }

        const serializer = new XMLSerializer();
        const finalSvgStr = serializer.serializeToString(svgElement);

        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(finalSvgStr);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 1.5;
            const finalWidth = width || img.width || 800;
            const finalHeight = height || img.height || 600;

            canvas.width = finalWidth * scale;
            canvas.height = finalHeight * scale;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(null);
                return;
            }

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png', 1.0);
        };

        img.onerror = (e) => {
            console.error("SVG to PNG conversion failed", e);
            resolve(null);
        };
    });
};

// Helper to extract code from string or Diagram object
const getDiagramCode = (diagram: Diagram | string | null | undefined): string => typeof diagram === 'string' ? diagram : (diagram?.code || "");

// -----------------------------------------------------------------------------
// UNIFIED DIAGRAM CAPTURE (canonical analysisModels set → PNG data URLs)
// Consumed by the DOCX exporter (lib/srs-export) and the bundle exporter below.
// -----------------------------------------------------------------------------
export const renderMermaidDiagrams = async (data: AnalysisResult): Promise<Record<string, string>> => {
    const images: Record<string, string> = {};
    if (!data.appendices?.analysisModels) return images;

    try {
        const { createRoot } = await import('react-dom/client');
        const { toPng } = await import('html-to-image');
        const { DFDViewer } = await import('@/components/DFDViewer');
        const { MermaidRenderer } = await import('@/components/mermaid-renderer');
        const React = await import('react');

        // 1. Create Off-Screen Container (HIDDEN but in viewport)
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '0';
        container.style.top = '0';
        container.style.zIndex = '-9999'; // Behind everything
        // CRITICAL: Massive container to simply never clip content even if it's huge
        container.style.width = '10000px';
        container.style.height = '10000px';
        container.style.backgroundColor = 'white';
        // CRITICAL: Opacity 1 ensures browser renders it cheaply but fully.
        container.style.opacity = '1';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);

        // Helper: Capture any component
        const captureComponent = async (element: React.ReactElement, key: string, width = 1200, height = 800, isFlexible = false) => {
            const wrapper = document.createElement('div');

            if (isFlexible) {
                // MERMAID FIX: Unbounded growth
                wrapper.style.display = 'inline-block'; // Shrink wrap or expand
                wrapper.style.width = 'auto';
                wrapper.style.height = 'auto';
                // Respect the REQUESTED min size, but allow growing
                wrapper.style.minWidth = `${width}px`;
                wrapper.style.minHeight = `${height}px`;
            } else {
                // REACT FLOW FIX: Strict box
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.width = `${width}px`;
                wrapper.style.height = `${height}px`;
            }

            wrapper.style.backgroundColor = 'white';
            wrapper.className = "export-wrapper relative";

            container.appendChild(wrapper);
            const root = createRoot(wrapper);

            root.render(element);

            // Wait for render
            await new Promise(r => setTimeout(r, 2500));

            // BRUTE FORCE STYLES: Manually paint it black
            // This bypasses CSS isolation, Shadow DOM, and library limitations.
            const svgElements = wrapper.querySelectorAll('svg');
            let contentWidth = width;
            let contentHeight = height;

            svgElements.forEach(svg => {
                // 1. DIMENSION SYNC (Crucial for Mermaid clipping fix)
                if (isFlexible && svg.getAttribute('viewBox')) {
                    const viewBox = svg.getAttribute('viewBox')!.split(' ').map(parseFloat);
                    if (viewBox.length === 4) {
                        const [, , vbWidth, vbHeight] = viewBox;
                        svg.setAttribute('width', `${vbWidth}px`);
                        svg.setAttribute('height', `${vbHeight}px`);
                        svg.style.width = `${vbWidth}px`;
                        svg.style.height = `${vbHeight}px`;
                        contentWidth = Math.max(contentWidth, vbWidth);
                        contentHeight = Math.max(contentHeight, vbHeight);
                    }
                }

                // Text: Solid Black
                svg.querySelectorAll('text').forEach(el => {
                    const htmlEl = el as unknown as HTMLElement;
                    htmlEl.style.fill = '#000000';
                    htmlEl.style.color = '#000000';
                    htmlEl.style.fontFamily = 'Arial, sans-serif';
                });
                // Paths/Lines: Solid Black
                svg.querySelectorAll('path, line, polyline').forEach(el => {
                    const htmlEl = el as unknown as HTMLElement;
                    htmlEl.style.stroke = '#000000';
                    htmlEl.style.strokeWidth = '2px';
                    if (el.classList.contains('react-flow__edge-path')) {
                        htmlEl.style.fill = 'none';
                    }
                });
                // Nodes: White fill, Black border
                svg.querySelectorAll('rect, circle, polygon').forEach(el => {
                    const fill = el.getAttribute('fill');
                    if (fill !== 'none') {
                        const htmlEl = el as unknown as HTMLElement;
                        htmlEl.style.fill = '#ffffff';
                        htmlEl.style.stroke = '#000000';
                        htmlEl.style.strokeWidth = '2px';
                    }
                });
                // Markers (Arrowheads)
                svg.querySelectorAll('marker path').forEach(el => {
                    const htmlEl = el as unknown as HTMLElement;
                    htmlEl.style.fill = '#000000';
                    htmlEl.style.stroke = 'none';
                });
            });

            // Specific DFD text overrides
            wrapper.querySelectorAll('.react-flow__node').forEach(node => {
                const textDivs = node.querySelectorAll('div');
                textDivs.forEach(t => {
                    t.style.color = '#000000';
                    t.style.fontWeight = 'bold';
                });
            });

            // GENERIC HTML TEXT OVERRIDE (For Mermaid htmlLabels)
            wrapper.querySelectorAll('div, span, p, label').forEach(el => {
                const htmlEl = el as unknown as HTMLElement;
                if (htmlEl.innerText && htmlEl.innerText.trim().length > 0) {
                    htmlEl.style.color = '#000000';
                    htmlEl.style.fontFamily = 'Arial, sans-serif';
                }
            });

            try {
                const captureWidth = isFlexible ? contentWidth + 40 : width;
                const captureHeight = isFlexible ? contentHeight + 40 : height;

                if (isFlexible) {
                    wrapper.style.width = `${captureWidth}px`;
                    wrapper.style.height = `${captureHeight}px`;
                }

                const dataUrl = await toPng(wrapper, {
                    quality: 1.0,
                    backgroundColor: 'white',
                    width: captureWidth,
                    height: captureHeight,
                    filter: (node) => !node.classList?.contains('react-flow__controls'),
                    skipFonts: true,
                    style: { transform: 'scale(1)', opacity: '1' }
                });
                if (dataUrl) images[key] = dataUrl;
            } catch (e) {
                console.error(`[Export] Failed to capture ${key}`, e);
            }

            root.unmount();
            container.removeChild(wrapper);
            await new Promise(r => setTimeout(r, 100));
        };

        const models = data.appendices.analysisModels;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getCode = (d: any) => typeof d === 'string' ? d : d?.code;

        // 1. Flowchart
        const flowCode = getCode(models.flowchartDiagram);
        if (flowCode) {
            await captureComponent(
                React.createElement(MermaidRenderer, { chart: flowCode, title: "Flowchart", isExport: true }),
                'flowchart',
                1200, 800, true
            );
        }

        // 2. Sequence Diagram
        const seqCode = getCode(models.sequenceDiagram);
        if (seqCode) {
            await captureComponent(
                React.createElement(MermaidRenderer, { chart: seqCode, title: "Sequence Diagram", isExport: true }),
                'sequence',
                1200, 800, true
            );
        }

        // 3. ERD
        const erdCode = getCode(models.entityRelationshipDiagram);
        if (erdCode) {
            await captureComponent(
                React.createElement(MermaidRenderer, { chart: erdCode, title: "Entity Relationship Diagram", isExport: true }),
                'entityRelationship',
                1200, 800, true
            );
        }

        // 4. DFD (React Flow)
        if (models.dataFlowDiagram) {
            const dfdObj = models.dataFlowDiagram;
            const isDfdJson = typeof dfdObj === 'object' && dfdObj !== null && ('dfd_level_0' in dfdObj || 'dfd_level_1' in dfdObj);

            if (isDfdJson) {
                const structuredDfd = dfdObj as DFDInput;
                if (structuredDfd.dfd_level_0) {
                    await captureComponent(
                        React.createElement(DFDViewer, { data: { dfd_level_0: structuredDfd.dfd_level_0 }, isExport: true }),
                        'dataFlowLevel0',
                        1600, 1000, false
                    );
                }
                if (structuredDfd.dfd_level_1) {
                    await captureComponent(
                        React.createElement(DFDViewer, { data: { dfd_level_1: structuredDfd.dfd_level_1 }, isExport: true }),
                        'dataFlowLevel1',
                        1600, 1200, false
                    );
                }
            } else {
                const legacyCode = getCode(dfdObj);
                if (legacyCode) {
                    await captureComponent(
                        React.createElement(MermaidRenderer, { chart: legacyCode, title: "Data Flow Diagram", isExport: true }),
                        'dataFlowLevel0',
                        1200, 800, true
                    );
                }
            }
        }

        document.body.removeChild(container);

    } catch (e) {
        console.error("Unified Image Export Failed", e);
    }

    return images;
};

// -----------------------------------------------------------------------------
// BUNDLE EXPORT — editable Word SRS + diagram assets + raw JSON, zipped.
// PDF export has been retired in favour of the editable .docx (see lib/srs-export).
// -----------------------------------------------------------------------------
export const downloadBundle = async (data: AnalysisResult, title: string) => {
    const { default: JSZip } = await import('jszip');
    const { saveAs } = await import('file-saver');
    const zip = new JSZip();

    // 1. Editable Word SRS (IEEE 830 template by default).
    try {
        const { captureDiagrams } = await import('@/lib/srs-export/capture');
        const { generateSrsDocx } = await import('@/lib/srs-export/generator');
        const images = await captureDiagrams(data);
        const docBlob = await generateSrsDocx(data, title, 'ieee830', images);
        zip.file("SRS_Report.docx", docBlob);
    } catch (e) {
        console.error("Failed to add SRS document to bundle", e);
    }

    // 2. Diagram source + rendered assets.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mermaid: any = null;
    try {
        const mermaidModule = await import('mermaid');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mermaid = (mermaidModule as any).default;
        mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'loose' });
    } catch (e) {
        console.warn("Mermaid failed to load", e);
    }

    const renderDiagram = async (code: string, id: string) => {
        try {
            if (!code || !mermaid) return null;
            const uniqueId = `${id}-${Math.random().toString(36).substr(2, 9)}`;
            const element = document.createElement('div');
            document.body.appendChild(element);
            const { svg } = await mermaid.render(uniqueId, code, element);
            document.body.removeChild(element);
            return svg;
        } catch (e) {
            console.error(`Failed to render diagram ${id}`, e);
            return null;
        }
    };

    const models = data.appendices?.analysisModels;
    if (models?.flowchartDiagram) {
        zip.file("diagrams/flowchart.mmd", getDiagramCode(models.flowchartDiagram));
        const svg = await renderDiagram(getDiagramCode(models.flowchartDiagram), 'flowchart');
        if (svg) {
            zip.file("diagrams/flowchart.svg", svg);
            const png = await svgToPng(svg);
            if (png) zip.file("diagrams/flowchart.png", png);
        }
    }
    if (models?.sequenceDiagram) {
        zip.file("diagrams/sequence.mmd", getDiagramCode(models.sequenceDiagram));
        const svg = await renderDiagram(getDiagramCode(models.sequenceDiagram), 'sequence');
        if (svg) {
            zip.file("diagrams/sequence.svg", svg);
            const png = await svgToPng(svg);
            if (png) zip.file("diagrams/sequence.png", png);
        }
    }

    // 3. AI-selected dynamic diagrams — ship their raw Mermaid source too.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const additional = (models as any)?.additionalDiagrams as Array<{ title?: string; type?: string; code?: string }> | undefined;
    if (Array.isArray(additional)) {
        additional.forEach((d, i) => {
            if (d?.code) {
                const slug = (d.title || d.type || `diagram-${i}`).replace(/\s+/g, '_').toLowerCase();
                zip.file(`diagrams/additional/${i}_${slug}.mmd`, d.code);
            }
        });
    }

    // 4. Raw JSON.
    zip.file("analysis.json", JSON.stringify(data, null, 2));

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${title.replace(/\s+/g, '_')}_Bundle.zip`);
};

interface FileNode {
    path: string;
    type: "file" | "directory";
    children?: FileNode[];
    code?: string;
}

interface CodebaseFile {
    path: string;
    code: string;
}

interface CodebaseData {
    fileStructure?: FileNode[];
    schema?: string;
    backendRoutes?: CodebaseFile[];
    frontendComponents?: CodebaseFile[];
    testCases?: CodebaseFile[];
    backendReadme?: string;
    frontendReadme?: string;
}

export const downloadCodebase = async (codeData: CodebaseData, title: string) => {
    const { default: JSZip } = await import('jszip');
    const { saveAs } = await import('file-saver');

    const zip = new JSZip();
    if (codeData.schema) zip.file("prisma/schema.prisma", codeData.schema);

    const addFiles = (files: { path: string, code: string }[]) => {
        files.forEach(f => {
            const cleanPath = f.path.startsWith('/') ? f.path.slice(1) : f.path;
            zip.file(cleanPath, f.code);
        });
    }

    if (codeData.backendRoutes) addFiles(codeData.backendRoutes);
    if (codeData.frontendComponents) addFiles(codeData.frontendComponents);
    if (codeData.testCases) addFiles(codeData.testCases);
    if (codeData.backendReadme) zip.file("backend/README.md", codeData.backendReadme);
    if (codeData.frontendReadme) zip.file("frontend/README.md", codeData.frontendReadme);

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${title.replace(/\s+/g, '_')}_Codebase.zip`);
};
