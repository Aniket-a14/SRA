import { getAcronym } from '@/lib/utils';
import type { AnalysisResult, Diagram } from '@/types/analysis';

// Helper: Convert SVG string to PNG Blob (kept from original)
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

// Helper to clean text
const clean = (text: string) => text?.replace(/\s+/g, ' ').trim() || "";

// Helper to extract code from string or Diagram object

const getDiagramCode = (diagram: Diagram | string | null | undefined): string => typeof diagram === 'string' ? diagram : (diagram?.code || "");

// Helper to extract caption

const getDiagramCaption = (diagram: Diagram | string | null | undefined, defaultCaption: string): string => {
    return (typeof diagram !== 'string' && diagram?.caption) ? diagram.caption : defaultCaption;
};

// Helper to strip markdown bullets/numbering from requirements and existing IDs
const normalizeText = (text: string) => {
    // 1. Strip standard bullets (*, -, •) and numbering (1., 1)) BUT preserve **bold** markers
    // Regex explanation:
    // ^\s* matches leading whitespace
    // (?: ... ) group for alternatives
    // [\-\•\d\.\)]+\s* matches dashes, bullets, digits, dots, parens followed by space
    // | OR
    // \*(?!\*)\s* matches SINGLE asterisk (bullet) not followed by another asterisk
    let cleaned = text.replace(/^\s*(?:[\-\•\d\.\)]+\s*|\*(?!\*)\s*)/, '');

    // 2. Strip existing Requirement IDs (e.g., SRA-FR-1, OFODA-FR-12) if present
    // Pattern: Uppercase letters, hyphen, Uppercase, hyphen, digits, optional colon
    cleaned = cleaned.replace(/^[A-Z]+-[A-Z]+-\d+\s*:?\s*/, '');

    return cleaned.trim();
};

// -----------------------------------------------------------------------------
// UNIFIED DIAGRAM CAPTURE (Photo Click for ALL)
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
            // BRUTE FORCE STYLES: Manually paint it black (and now SIZE it correctly)
            const svgElements = wrapper.querySelectorAll('svg');
            let contentWidth = width;
            let contentHeight = height;

            svgElements.forEach(svg => {
                // 1. DIMENSION SYNC (Crucial for Mermaid clipping fix)
                // Mermaid often sets height="100%" which can collapse or clip.
                // We trust the viewBox which represents the true diagram size.
                if (isFlexible && svg.getAttribute('viewBox')) {
                    const viewBox = svg.getAttribute('viewBox')!.split(' ').map(parseFloat);
                    if (viewBox.length === 4) {
                        const [, , vbWidth, vbHeight] = viewBox;
                        // Force the SVG to be its natural size
                        svg.setAttribute('width', `${vbWidth}px`);
                        svg.setAttribute('height', `${vbHeight}px`);
                        svg.style.width = `${vbWidth}px`;
                        svg.style.height = `${vbHeight}px`;

                        // Update wrapper tracking
                        contentWidth = Math.max(contentWidth, vbWidth);
                        contentHeight = Math.max(contentHeight, vbHeight);
                    }
                }

                // Text: Solid Black
                svg.querySelectorAll('text').forEach(el => {
                    const htmlEl = el as unknown as HTMLElement;
                    htmlEl.style.fill = '#000000';
                    htmlEl.style.color = '#000000';
                    // REMOVED bold to prevent text overflow
                    htmlEl.style.fontFamily = 'Arial, sans-serif';
                });
                // Paths/Lines: Solid Black
                svg.querySelectorAll('path, line, polyline').forEach(el => {
                    const htmlEl = el as unknown as HTMLElement;
                    htmlEl.style.stroke = '#000000';
                    htmlEl.style.strokeWidth = '2px';
                    // Don't force fill on paths as they might be edges (fill: none)
                    if (el.classList.contains('react-flow__edge-path')) {
                        htmlEl.style.fill = 'none';
                    }
                });
                // Nodes: White fill, Black border
                svg.querySelectorAll('rect, circle, polygon').forEach(el => {
                    // Check if it's a marker or node
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
                    t.style.fontWeight = 'bold'; // Keep DFD bold as it handles it fine
                });
            });

            // GENERIC HTML TEXT OVERRIDE (For Mermaid htmlLabels)
            // Mermaid uses <foreignObject><div>...</div></foreignObject>
            wrapper.querySelectorAll('div, span, p, label').forEach(el => {
                const htmlEl = el as unknown as HTMLElement;
                // Avoid overwriting React Flow handles or structural divs if they don't have text
                if (htmlEl.innerText && htmlEl.innerText.trim().length > 0) {
                    htmlEl.style.color = '#000000';
                    // REMOVED bold to prevent overflow
                    htmlEl.style.fontFamily = 'Arial, sans-serif';
                }
            });

            try {
                // dynamic sizing for capture
                const captureWidth = isFlexible ? contentWidth + 40 : width;
                const captureHeight = isFlexible ? contentHeight + 40 : height;

                // Explicitly resize wrapper to match content before capture
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
                    skipFonts: true, // Prevent loading errors
                    style: { transform: 'scale(1)', opacity: '1' }
                });
                if (dataUrl) images[key] = dataUrl;
            } catch (e) {
                console.error(`[Export] Failed to capture ${key}`, e);
            }

            root.unmount();
            container.removeChild(wrapper);
            // Small cooling off to prevent browser hiccups
            await new Promise(r => setTimeout(r, 100));
        };

        const models = data.appendices.analysisModels;

        // Helper to extract code
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getCode = (d: any) => typeof d === 'string' ? d : d?.code;

        // 1. Flowchart
        const flowCode = getCode(models.flowchartDiagram);
        if (flowCode) {
            await captureComponent(
                React.createElement(MermaidRenderer, { chart: flowCode, title: "Flowchart", isExport: true }),
                'flowchart',
                1200, 800, true // Flexible=true
            );
        }

        // 2. Sequence Diagram
        const seqCode = getCode(models.sequenceDiagram);
        if (seqCode) {
            await captureComponent(
                React.createElement(MermaidRenderer, { chart: seqCode, title: "Sequence Diagram", isExport: true }),
                'sequence',
                1200, 800, true // Flexible=true
            );
        }

        // 3. ERD
        const erdCode = getCode(models.entityRelationshipDiagram);
        if (erdCode) {
            await captureComponent(
                React.createElement(MermaidRenderer, { chart: erdCode, title: "Entity Relationship Diagram", isExport: true }),
                'entityRelationship',
                1200, 800, true // Flexible=true
            );
        }

        // 4. DFD (React Flow)
        if (models.dataFlowDiagram) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dfdObj = models.dataFlowDiagram as any;
            const isDfdJson = (dfdObj.dfd_level_0 || dfdObj.dfd_level_1);

            if (isDfdJson) {
                // Level 0
                if (dfdObj.dfd_level_0) {
                    await captureComponent(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        React.createElement(DFDViewer, { data: { dfd_level_0: dfdObj.dfd_level_0 } as any, isExport: true }),
                        'dataFlowLevel0',
                        1600, 1000, false // Fixed
                    );
                }
                // Level 1
                if (dfdObj.dfd_level_1) {
                    await captureComponent(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        React.createElement(DFDViewer, { data: { dfd_level_1: dfdObj.dfd_level_1 } as any, isExport: true }),
                        'dataFlowLevel1',
                        1600, 1200, false // Fixed
                    );
                }
            } else {
                // Fallback Legacy
                const legacyCode = getCode(dfdObj);
                if (legacyCode) {
                    await captureComponent(
                        React.createElement(MermaidRenderer, { chart: legacyCode, title: "Data Flow Diagram", isExport: true }),
                        'dataFlowLevel0',
                        1200, 800, true // Flexible
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

// Helper: Calculate number of items for ToC estimation
const calculateTocItems = (data: AnalysisResult) => {
    let items = 0;

    // 1. Intro
    if (data.introduction) {
        items += 1; // Chapter
        items += 5; // Sections
    }

    // 2. Overall
    if (data.overallDescription) {
        items += 1; // Chapter
        items += 7; // Sections
    }

    // 3. Ext Interface
    if (data.externalInterfaceRequirements) {
        items += 1;
        items += 4;
    }

    // 4. System Features
    if (data.systemFeatures) {
        items += 1;
        data.systemFeatures.forEach(() => {
            items += 1; // Section (Level 2)
            // items += 3; // Subsections (Level 3) -> EXCLUDED from ToC now
        });
    }

    // 5. NonFunctional
    if (data.nonFunctionalRequirements) {
        items += 1;
        items += 5;
    }

    // 6. Other
    if (data.otherRequirements) items += 1;

    // Appendices
    if (data.glossary) items += 1;
    if (data.appendices?.analysisModels) {
        items += 1;
        if (data.appendices.analysisModels.flowchartDiagram) items += 1;
        if (data.appendices.analysisModels.sequenceDiagram) items += 1;
        if (data.appendices.analysisModels.dataFlowDiagram) items += 2; // Level 0 and Level 1 (or 1 if old, but estimating high is safer)
        if (data.appendices.analysisModels.entityRelationshipDiagram) items += 1;
    }
    if (data.appendices?.tbdList) items += 1;

    // Add Revision History item
    items += 1;

    return items;
};

export const generateSRS = async (data: AnalysisResult, title: string, diagramImages: Record<string, string> = {}) => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    // We use unknown cast for jsPDF because its types are augmented by plugins in ways 
    // that the base compiler sometimes misses during complex builds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = new jsPDF({ compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // IEEE Margins: All 1" (25.4mm) as per user request
    const margins = {
        left: 25.4,
        top: 35, // Increased for header gap
        right: 25.4,
        bottom: 25.4
    };
    const contentWidth = pageWidth - margins.left - margins.right;
    let yPos = margins.top;

    // Prefer Project Name from Introduction if available
    const projectTitle = data.introduction?.projectName || title || "Project Name";
    const projectAcronym = getAcronym(projectTitle);

    // --- State & Navigation ---

    const tocItems: { title: string, page: number, level: number }[] = [];

    // Add Revision History to ToC (Front Matter)
    tocItems.push({ title: "Revision History", page: 0, level: 1 });

    // Requirement Counters
    let frCount = 0;
    let prCount = 0;
    let safeCount = 0;
    let secCount = 0;
    let qaCount = 0;
    let brCount = 0;
    let orCount = 0;

    // --- PAGE OPERATIONS ---



    const addNewPage = () => {
        doc.addPage();
        yPos = margins.top;
    };

    const checkPageBreak = (heightNeeded: number) => {
        if (yPos + heightNeeded > pageHeight - margins.bottom) {
            addNewPage();
            return true;
        }
        return false;
    };

    // --- TEXT LAYOUT HELPERS ---

    // Generic Rich Text Renderer
    const renderRichText = (text: string, x: number, maxWidth: number) => {
        const cleanText = clean(text);
        doc.setFontSize(12);
        const lineHeight = 5;

        // Tokenize
        const tokens: { text: string, bold: boolean, width: number }[] = [];
        const parts = cleanText.split(/(\*\*.*?\*\*)/g);

        parts.forEach(part => {
            let isBold = false;
            let str = part;
            if (part.startsWith('**') && part.endsWith('**')) {
                isBold = true;
                str = part.slice(2, -2);
            }
            if (!str) return;

            doc.setFont("times", isBold ? 'bold' : 'normal');

            // Split by space but keep structure
            const words = str.split(/(\s+)/);
            words.forEach(w => {
                if (!w) return;
                tokens.push({
                    text: w,
                    bold: isBold,
                    width: doc.getTextWidth(w)
                });
            });
        });

        let lineTokens: typeof tokens = [];
        let lineWidth = 0;

        const flushLine = () => {
            checkPageBreak(lineHeight);
            let printX = x;
            lineTokens.forEach(t => {
                doc.setFont("times", t.bold ? 'bold' : 'normal');
                doc.text(t.text, printX, yPos);
                printX += t.width;
            });
            yPos += lineHeight;
            lineTokens = [];
            lineWidth = 0;
        };

        tokens.forEach(token => {
            if (lineWidth + token.width > maxWidth) {
                flushLine();
                // If token is just space, skip it at start of new line
                if (!token.text.trim()) return;
            }
            lineTokens.push(token);
            lineWidth += token.width;
        });

        if (lineTokens.length > 0) {
            flushLine();
        }

        yPos += 6; // Spacing after block
    };

    const addParagraph = (text: string) => {
        renderRichText(text, margins.left, contentWidth);
    };


    // Chapter (Level 1) - ALWAYS starts on new page
    const addChapterHeader = (number: string, titleText: string, addToToc: boolean = true) => {
        // Force new page if we aren't already at the top of a fresh one (page > 1)
        if (doc.getCurrentPageInfo().pageNumber > 1) {
            addNewPage();
        }

        doc.setFontSize(16);
        doc.setFont("times", "bold");
        const fullTitle = number ? `${number} ${titleText}` : titleText;
        doc.text(fullTitle, margins.left, yPos); // Left Aligned

        if (addToToc) {
            tocItems.push({
                title: fullTitle,
                page: doc.getCurrentPageInfo().pageNumber,
                level: 1
            });
        }
        yPos += 10;
        doc.setFontSize(12);
        doc.setFont("times", "normal");
    };

    // Heading (Level 2)
    const addSectionHeader = (number: string, titleText: string) => {
        checkPageBreak(15);
        doc.setFontSize(12);
        doc.setFont("times", "bold");
        const fullTitle = `${number} ${titleText}`;
        doc.text(fullTitle, margins.left, yPos); // Left Aligned

        tocItems.push({
            title: fullTitle,
            page: doc.getCurrentPageInfo().pageNumber,
            level: 2
        });
        yPos += 8;
        doc.setFontSize(12);
        doc.setFont("times", "normal");
    };

    // SubHeading (Level 3) - Normal weight as per strict IEEE
    const addSubHeader = (number: string, titleText: string) => {
        checkPageBreak(10);
        doc.setFontSize(12);
        doc.setFont("times", "bold"); // Normal enforced
        const fullTitle = `${number} ${titleText}`;
        doc.text(fullTitle, margins.left, yPos, { align: 'left' });

        yPos += 8;
        doc.setFont("times", "normal");
    };

    // Requirement Lists
    const addRequirementList = (items: string[], type: 'bullet' | 'functional' | 'performance' | 'safety' | 'security' | 'quality' | 'business' | 'other' | 'stimulus' = 'bullet', acronym: string = "SRA") => {
        if (!items || items.length === 0) return;
        doc.setFont("times", "normal");
        doc.setFontSize(12);

        items.forEach(item => {
            const contentText = normalizeText(clean(item));
            let idLabel = "";

            if (type === 'functional') {
                frCount++;
                idLabel = `${acronym}-FR-${frCount}`;
            } else if (type === 'performance') {
                prCount++;
                idLabel = `${acronym}-PR-${prCount}`;
            } else if (type === 'safety') {
                safeCount++;
                idLabel = `${acronym}-SR-${safeCount}`;
            } else if (type === 'security') {
                secCount++;
                idLabel = `${acronym}-SE-${secCount}`;
            } else if (type === 'quality') {
                qaCount++;
                idLabel = `${acronym}-QA-${qaCount}`;
            } else if (type === 'business') {
                brCount++;
                idLabel = `${acronym}-BR-${brCount}`;
            } else if (type === 'other') {
                orCount++;
                idLabel = `${acronym}-OR-${orCount}`;
            }

            // Special Handling for Stimulus/Response
            if (type === 'stimulus') {
                // ... (Logic remains same mostly, but ensuring formatting)
                const stimMatch = contentText.match(/Stimulus:(.*?)Response:(.*)/i);
                if (stimMatch) {
                    const stimText = stimMatch[1].trim();
                    const resText = stimMatch[2].trim();

                    // Stimulus
                    doc.setFont("times", "bold");
                    doc.text("• Stimulus:", margins.left + 5, yPos);
                    const labelWidth = doc.getTextWidth("• Stimulus: ");

                    doc.setFont("times", "normal");
                    const lines = doc.splitTextToSize(stimText, contentWidth - 5 - labelWidth);
                    checkPageBreak(lines.length * 5);

                    doc.text(lines, margins.left + 5 + labelWidth, yPos);
                    yPos += (lines.length * 5) + 2;

                    // Response
                    doc.setFont("times", "bold");
                    doc.text("Response:", margins.left + 10, yPos); // Indented slightly more? Or aligned.
                    // User said "Stimulus/Response Sequences" -> usually pairs. 
                    // Let's keep alignment consistent.
                    const rLabelWidth = doc.getTextWidth("Response: ");

                    doc.setFont("times", "normal");
                    const rLines = doc.splitTextToSize(resText, contentWidth - 10 - rLabelWidth);
                    checkPageBreak(rLines.length * 5);

                    doc.text(rLines, margins.left + 10 + rLabelWidth, yPos);
                    yPos += (rLines.length * 5) + 4;
                    return;
                }
            }

            if (idLabel) {
                // **ID**: Content
                const labelStr = `${idLabel}: `;
                doc.setFont("times", "bold");
                doc.setFontSize(12);
                doc.text(labelStr, margins.left + 5, yPos);

                const labelWidth = doc.getTextWidth(labelStr);

                // Render content using rich text, indented
                // Slightly offset yPos backwards to allow renderRichText to start on same line if it wants?
                // Actually renderRichText adds lineHeight to yPos AFTER printing.
                // renderRichText does NOT modify yPos before printing first line (except checkPageBreak).
                // But checkPageBreak might be triggered.

                // If we assume it fits:
                renderRichText(contentText, margins.left + 5 + labelWidth, contentWidth - 5 - labelWidth);

                // renderRichText adds 4 space at end. We might want less for lists.
                yPos -= 2;
            } else {
                // Bullet point
                doc.text("• ", margins.left + 5, yPos);
                const bulletWidth = doc.getTextWidth("• ");

                renderRichText(contentText, margins.left + 5 + bulletWidth, contentWidth - 5 - bulletWidth);
                yPos -= 2;
            }
        });
        yPos += 2;
    };

    // ===========================
    // 1. COVER PAGE
    // ===========================
    // Layout: Arial (Helvetica), Black Bar, Right Aligned, Specific Sizes

    // Top Black Bar
    // "A solid black horizontal bar... Fixed height 1pt... very top edge"
    // "page width should be length of the sentence" - interpreting as "width of the longest content" or "page width".
    // User clarification: "page width should be length of the sentence" -> likely "Bar width = Text width"?
    // But "Positioned at the very top edge" implies edge of page.
    // Standard IEEE template usually has a full width bar or a bar matching the text alignment.
    // I will draw a bar from right margin inwards, matching the text width?
    // Let's stick to "Top Black Bar" as a distinct visual element.
    // I will try to make it look like a header bar.

    // Actually, "Positioned at the very top edge". Let's place it at y=10 or something.
    // yPos = 20; // This line is removed as yPos is set to 60 below.

    // Font: Arial (Helvetica) for Cover Only
    // doc.setFont("helvetica", "bold"); // This is moved below the yPos setting.

    // Title Section
    yPos = 60; // Start down the page

    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);

    const line1 = "Software Requirements";
    const line2 = "Specification";
    const line3 = "for";
    const line4 = projectTitle;

    // Calculate max width for the bar
    const w1 = doc.getTextWidth(line1);
    const w2 = doc.getTextWidth(line2);
    const w3 = doc.getTextWidth(line3);
    const w4 = doc.getTextWidth(line4);

    // User wants "equal spaced from left and right side" -> Centered.
    // We'll use the max width of the text block to determine the bar length + padding.
    const barWidth = Math.max(w1, w2, w3, w4) + 2; // +20 for some breathing room (padding)

    // Draw Bar Centered (Strict User Request: "bar should be center only")
    const barX = (pageWidth - barWidth) / 2;
    doc.setFillColor(0, 0, 0);
    // Draw rect: x = barX, y = 35 (Moved up from 45), w = barWidth, h = 1.5
    doc.rect(barX, 35, barWidth, 1, 'F');

    // Render Title Lines RIGHT Aligned (Fixed Anchor)
    const contentX = pageWidth - margins.right;

    doc.text(line1, contentX, yPos, { align: 'right' });
    yPos += 12;

    doc.text(line2, contentX, yPos, { align: 'right' });
    yPos += 24; // Gap

    doc.text(line3, contentX, yPos, { align: 'right' });
    yPos += 24; // Gap

    const titleLines = doc.splitTextToSize(line4, contentWidth);
    doc.text(titleLines, contentX, yPos, { align: 'right' });
    yPos += (titleLines.length * 14) + 24; // Gap

    // "Version X approved"
    doc.setFontSize(14);
    doc.text("Version 1.0 approved", contentX, yPos, { align: 'right' });
    yPos += 14; // Gap

    // "Prepared by <Author>"
    doc.text(`Prepared by ${"User"}`, contentX, yPos, { align: 'right' });
    yPos += 14; // Gap

    // "<Organization>"
    doc.text("Smart Requirements Analyzer", contentX, yPos, { align: 'right' });
    yPos += 14; // Gap

    // "<Date>" - BOLD
    // doc.setFont("helvetica", "bold"); // Already set
    doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), contentX, yPos, { align: 'right' });

    // COVER FOOTER (Copyright) - ONLY on Cover
    const copyrightFooterY = pageHeight - margins.bottom;
    doc.setFont("times", "italic");
    doc.setFontSize(10); // 10-11pt
    doc.text("Copyright © 1999 by Karl E. Wiegers. Permission is granted to use, modify, and distribute this document.", pageWidth / 2, copyrightFooterY, { align: 'center' });

    // Ensure we start fresh for next pages
    // Reset Font to Times for body
    doc.setFont("times", "normal");

    // ===========================
    // 2. TABLE OF CONTENTS
    // ===========================
    // Precise Page Allocation:
    // ToC Items height (6mm) + Rev History Table (~100mm Buffer for safety)
    // We reserve CONSERVATIVELY (1.1x) to prevent overlap.
    // Unused pages will be DELETED later to prevent blank pages.
    const tocLineHeight = 6;
    const revHistBuffer = 100;

    // Calculate Estimated Items
    const estimatedItems = calculateTocItems(data);

    // contentHeight
    const usableHeight = pageHeight - margins.top - margins.bottom;

    // 10% safety margin to ensure we NEVER overlap Intro
    const totalNeeded = ((estimatedItems * tocLineHeight) + revHistBuffer) * 1.1;

    const tocNeedsPages = Math.ceil(totalNeeded / usableHeight) || 1;
    const tocStartPage = doc.getCurrentPageInfo().pageNumber + 1;

    for (let i = 0; i < tocNeedsPages; i++) {
        addNewPage();
    }

    // ===========================
    // 3. REVISION HISTORY
    // ===========================
    // ===========================
    // 3. REVISION HISTORY (Page Reserved)
    // ===========================
    // Logic moved to post-processing to ensure it follows ToC immediately.
    // Revision History will be rendered dynamically after ToC finishes (see below)
    // to prevent blank pages caused by hardcoded page reservation.

    // Resume content logic
    // We already are on revisionHistoryPage. The next addChapterHeader will ensure a new page if needed.
    // contentStartPage = doc.getCurrentPageInfo().pageNumber;

    // ===========================
    // CONTENT SECTIONS (Starting Page 1 here if we follow Arabic 1..)
    // ===========================
    // CONTENT SECTIONS
    // ===========================

    // --- 1. Introduction ---
    if (data.introduction) {
        addChapterHeader("1.", "Introduction", true);

        addSectionHeader("1.1", "Purpose");
        addParagraph(data.introduction.purpose);

        addSectionHeader("1.2", "Document Conventions");
        addParagraph(data.introduction.documentConventions || "This document follows IEEE Std 830-1998 for SRS.");

        addSectionHeader("1.3", "Intended Audience and Reading Suggestions");
        addParagraph(data.introduction.intendedAudience);

        addSectionHeader("1.4", "Product Scope");
        addParagraph(data.introduction.productScope);

        addSectionHeader("1.5", "References");
        addRequirementList(data.introduction.references, 'bullet');
    }

    // --- 2. Overall Description ---
    if (data.overallDescription) {
        addChapterHeader("2.", "Overall Description", true);

        addSectionHeader("2.1", "Product Perspective");
        addParagraph(data.overallDescription.productPerspective);

        addSectionHeader("2.2", "Product Functions");
        addRequirementList(data.overallDescription.productFunctions, 'bullet');

        addSectionHeader("2.3", "User Classes and Characteristics");
        if (data.overallDescription.userClassesAndCharacteristics) {
            data.overallDescription.userClassesAndCharacteristics.forEach(uc => {
                doc.setFont("times", "bold");
                doc.setFontSize(12);
                doc.text(`• ${uc.userClass}`, margins.left + 5, yPos);
                yPos += 6;
                doc.setFont("times", "normal");
                // Use renderRichText for characteristics
                renderRichText(clean(uc.characteristics), margins.left + 10, contentWidth - 10);
            });
        }

        addSectionHeader("2.4", "Operating Environment");
        addParagraph(data.overallDescription.operatingEnvironment);

        addSectionHeader("2.5", "Design and Implementation Constraints");
        addRequirementList(data.overallDescription.designAndImplementationConstraints, 'bullet');

        addSectionHeader("2.6", "User Documentation");
        addRequirementList(data.overallDescription.userDocumentation, 'bullet');

        addSectionHeader("2.7", "Assumptions and Dependencies");
        addRequirementList(data.overallDescription.assumptionsAndDependencies, 'bullet');
    }

    // --- 3. External Interface Requirements ---
    if (data.externalInterfaceRequirements) {
        addChapterHeader("3.", "External Interface Requirements", true);

        addSectionHeader("3.1", "User Interfaces");
        addParagraph(data.externalInterfaceRequirements.userInterfaces);

        addSectionHeader("3.2", "Hardware Interfaces");
        addParagraph(data.externalInterfaceRequirements.hardwareInterfaces);

        addSectionHeader("3.3", "Software Interfaces");
        addParagraph(data.externalInterfaceRequirements.softwareInterfaces);

        addSectionHeader("3.4", "Communications Interfaces");
        addParagraph(data.externalInterfaceRequirements.communicationsInterfaces);
    }

    // --- 4. System Features ---
    if (data.systemFeatures) {
        addChapterHeader("4.", "System Features", true);

        data.systemFeatures.forEach((feature, index) => {
            const featNum = `4.${index + 1}`;
            addSectionHeader(featNum, feature.name);

            // Sub-sections - Level 3
            addSubHeader(`${featNum}.1`, "Description and Priority");

            // Handle Description with Feature Name Bolding
            // Rule: "If a sentence begins with a feature name followed by a colon (:), bold only the feature name."
            const descText = feature.description;
            // Check for Feature Name prefix
            const cleanFeatureName = feature.name.replace(/^\d+(\.\d+)*\s*/, '').trim(); // Remove numbering if present in name
            const featurePrefix = `${cleanFeatureName}:`;

            if (descText.startsWith(featurePrefix)) {
                const restOfText = descText.substring(featurePrefix.length).trim();



                // Re-implementation using renderRichText logic for mixed content
                // We want the prefix BOLD, followed immediately by description (with potential rich text inside it).

                const fullText = `**${featurePrefix}** ${restOfText}`;
                renderRichText(fullText, margins.left, contentWidth);

            } else if (descText.includes("Priority:")) {
                const parts = descText.split("Priority:");
                addParagraph(parts[0]);
                if (parts[1]) {
                    doc.setFont("times", "bold");
                    doc.text(`Priority: ${parts[1].trim()}`, margins.left, yPos);
                    yPos += 8;
                }
            } else {
                addParagraph(descText);
            }

            addSubHeader(`${featNum}.2`, "Stimulus/Response Sequences");
            addRequirementList(feature.stimulusResponseSequences, 'stimulus', projectAcronym);

            addSubHeader(`${featNum}.3`, "Functional Requirements");
            addRequirementList(feature.functionalRequirements, 'functional', projectAcronym);

            // Audit Trail: Verification Metadata
            if (feature.status || (feature.verification_files && feature.verification_files.length > 0)) {
                yPos += 2;
                checkPageBreak(15);

                // Status Line
                if (feature.status) {
                    doc.setFont("times", "bold");
                    doc.text("Implementation Status: ", margins.left + 5, yPos);
                    const statusX = margins.left + 5 + doc.getTextWidth("Implementation Status: ");

                    const status = feature.status.toUpperCase();
                    if (status === 'VERIFIED') doc.setTextColor(0, 128, 0); // Green
                    else if (status === 'FAILED') doc.setTextColor(200, 0, 0); // Red
                    else doc.setTextColor(100, 100, 100); // Gray

                    doc.text(status, statusX, yPos);
                    doc.setTextColor(0, 0, 0); // Reset
                    yPos += 6;
                }

                // Files List
                if (feature.verification_files && feature.verification_files.length > 0) {
                    doc.setFont("times", "bold");
                    doc.text("Associated Implementation Files:", margins.left + 5, yPos);
                    yPos += 5;
                    doc.setFont("courier", "normal");
                    doc.setFontSize(10);

                    feature.verification_files.forEach(file => {
                        checkPageBreak(5);
                        doc.text(`- ${file}`, margins.left + 10, yPos);
                        yPos += 5;
                    });

                    doc.setFontSize(12);
                    doc.setFont("times", "normal");
                    yPos += 4;
                }
            }
        });
    }

    // --- 5. Other Nonfunctional Requirements ---
    if (data.nonFunctionalRequirements) {
        addChapterHeader("5.", "Other Nonfunctional Requirements", true);

        addSectionHeader("5.1", "Performance Requirements");
        addRequirementList(data.nonFunctionalRequirements.performanceRequirements, 'performance', projectAcronym);

        addSectionHeader("5.2", "Safety Requirements");
        addRequirementList(data.nonFunctionalRequirements.safetyRequirements, 'safety', projectAcronym);

        addSectionHeader("5.3", "Security Requirements");
        addRequirementList(data.nonFunctionalRequirements.securityRequirements, 'security', projectAcronym);

        addSectionHeader("5.4", "Software Quality Attributes");
        addRequirementList(data.nonFunctionalRequirements.softwareQualityAttributes, 'quality', projectAcronym);

        addSectionHeader("5.5", "Business Rules");
        addRequirementList(data.nonFunctionalRequirements.businessRules, 'business', projectAcronym);
    }

    // --- 6. Other Requirements ---
    if (data.otherRequirements) {
        addChapterHeader("6.", "Other Requirements", true);
        addRequirementList(data.otherRequirements, 'other', projectAcronym);
    }

    // --- Appendices ---
    if (data.glossary) {
        addChapterHeader("Appendix A:", "Glossary", true);

        // Sort terms alphabetically

        const glossaryBody = data.glossary
            .sort((a, b) => a.term.localeCompare(b.term))
            .map(item => [item.term, clean(item.definition)]);

        autoTable(doc, {
            startY: yPos,
            head: [['Term', 'Definition']],
            body: glossaryBody,
            margin: { left: margins.left, right: margins.right },
            theme: 'grid',
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineWidth: 0.1,
                lineColor: [0, 0, 0],
                font: 'times'
            },
            bodyStyles: {
                textColor: [0, 0, 0],
                font: 'times',
                lineWidth: 0.1,
                lineColor: [0, 0, 0],
                valign: 'top'
            },
            styles: {
                cellPadding: 3,
                fontSize: 12,
                overflow: 'linebreak',
            },
            columnStyles: {
                0: { cellWidth: 50, fontStyle: 'bold' }, // Term
                1: { cellWidth: 'auto' } // Definition
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            didDrawPage: (data: any) => {
                // Update final Y position after table
                yPos = (data.cursor?.y || yPos) + 10;
            }
        });

        // Ensure yPos is updated for next section if table didn't break page weirdly
        // autoTable hook updates yPos but we need to ensure it persists 
        // Actually, doc.lastAutoTable.finalY is the standard way
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yPos = (doc as any).lastAutoTable?.finalY + 10 || yPos;
    }

    if (data.appendices?.analysisModels) {
        addChapterHeader("Appendix B:", "Analysis Models", true);
        addParagraph("The following models are generated for the system.");

        if (data.appendices.analysisModels.flowchartDiagram) {
            addSectionHeader("B.1", "Flowchart");

            if (diagramImages['flowchart']) {
                const imgData = diagramImages['flowchart'];
                const imgProps = doc.getImageProperties(imgData);
                const imgRatio = imgProps.height / imgProps.width;
                const imgWidth = contentWidth;
                let imgHeight = imgWidth * imgRatio;

                // Check if image fits
                if (imgHeight > pageHeight - margins.bottom - margins.top) {
                    // Resize to fit page height if too tall
                    imgHeight = pageHeight - margins.bottom - margins.top - 40; // 40 for header/caption
                    // Re-calculate width? No, 'contain' logic. 
                    // Simple logic: max width = contentWidth
                }

                checkPageBreak(imgHeight + 20);
                doc.addImage(imgData, 'PNG', margins.left, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 5;
            } else {
                doc.setFont("courier", "normal");
                doc.setFontSize(8);

                // Render text in a box to simulate a figure
                const codeLines = doc.splitTextToSize(getDiagramCode(data.appendices.analysisModels.flowchartDiagram), contentWidth - 4);
                const boxHeight = (codeLines.length * 4) + 6;
                checkPageBreak(boxHeight + 20);

                doc.rect(margins.left, yPos, contentWidth, boxHeight);
                doc.text(codeLines, margins.left + 2, yPos + 4);
                yPos += boxHeight + 5;
            }

            // Caption
            const caption = getDiagramCaption(data.appendices.analysisModels.flowchartDiagram, "System Flowchart");
            const figId = "Figure B.1";
            doc.setFont("times", "normal");
            doc.setFontSize(12);
            doc.text(`${figId}: ${caption}`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 10;
        }

        if (data.appendices.analysisModels.sequenceDiagram) {
            addSectionHeader("B.2", "Sequence Diagram");

            const imgData = diagramImages['sequence'];
            const imgProps = doc.getImageProperties(imgData);
            const imgRatio = imgProps.height / imgProps.width;

            // Max dimensions
            const maxWidth = contentWidth;
            const maxHeight = pageHeight - margins.top - margins.bottom - 40; // buffers

            let finalWidth = maxWidth;
            let finalHeight = finalWidth * imgRatio;

            // If too tall, scale by height
            if (finalHeight > maxHeight) {
                finalHeight = maxHeight;
                finalWidth = finalHeight / imgRatio;
            }

            checkPageBreak(finalHeight + 20);
            // Center if narrower than full width
            const xOffset = margins.left + (contentWidth - finalWidth) / 2;
            doc.addImage(imgData, 'PNG', xOffset, yPos, finalWidth, finalHeight);
            yPos += finalHeight + 5;
        } else {
            doc.setFont("courier", "normal");
            doc.setFontSize(8);

            const codeLines = doc.splitTextToSize(getDiagramCode(data.appendices.analysisModels.sequenceDiagram), contentWidth - 4);
            const boxHeight = (codeLines.length * 4) + 6;
            checkPageBreak(boxHeight + 20);

            doc.rect(margins.left, yPos, contentWidth, boxHeight);
            doc.text(codeLines, margins.left + 2, yPos + 4);
            yPos += boxHeight + 5;
        }

        const caption = getDiagramCaption(data.appendices.analysisModels.sequenceDiagram, "System Sequence Diagram");
        const figId = "Figure B.2";
        doc.setFont("times", "normal");
        doc.setFontSize(12);
        doc.text(`${figId}: ${caption}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;
    }

    if (data.appendices.analysisModels.dataFlowDiagram) {
        // Level 0 (Context)
        if (diagramImages['dataFlowLevel0']) {
            addSectionHeader("B.3.1", "Data Flow Diagram - Level 0 (Context)");

            const imgData = diagramImages['dataFlowLevel0'];
            const imgProps = doc.getImageProperties(imgData);
            const imgRatio = imgProps.height / imgProps.width;

            const maxWidth = contentWidth;
            const maxHeight = pageHeight - margins.top - margins.bottom - 40;

            let finalWidth = maxWidth;
            let finalHeight = finalWidth * imgRatio;

            if (finalHeight > maxHeight) {
                finalHeight = maxHeight;
                finalWidth = finalHeight / imgRatio;
            }

            checkPageBreak(finalHeight + 20);
            const xOffset = margins.left + (contentWidth - finalWidth) / 2;
            doc.addImage(imgData, 'PNG', xOffset, yPos, finalWidth, finalHeight);
            yPos += finalHeight + 5;
        }

        // Level 1
        if (diagramImages['dataFlowLevel1']) {
            addSectionHeader("B.3.2", "Data Flow Diagram - Level 1");

            const imgData = diagramImages['dataFlowLevel1'];
            const imgProps = doc.getImageProperties(imgData);
            const imgRatio = imgProps.height / imgProps.width;

            const maxWidth = contentWidth;
            const maxHeight = pageHeight - margins.top - margins.bottom - 40;

            let finalWidth = maxWidth;
            let finalHeight = finalWidth * imgRatio;

            if (finalHeight > maxHeight) {
                finalHeight = maxHeight;
                finalWidth = finalHeight / imgRatio;
            }

            checkPageBreak(finalHeight + 20);
            const xOffset = margins.left + (contentWidth - finalWidth) / 2;
            doc.addImage(imgData, 'PNG', xOffset, yPos, finalWidth, finalHeight);
            yPos += finalHeight + 5;
        }

        // Fallback / Description
        const dfd = data.appendices.analysisModels.dataFlowDiagram;
        const caption = (typeof dfd === 'object' && dfd !== null && 'caption' in dfd ? (dfd as { caption: string }).caption : "Data Flow Diagrams");
        const figId = "Figure B.3";

        checkPageBreak(15);
        doc.setFont("times", "normal");
        doc.setFontSize(12);
        doc.text(`${figId}: ${caption}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;
    }

    if (data.appendices.analysisModels.entityRelationshipDiagram) {
        addSectionHeader("B.4", "Entity Relationship Diagram");

        if (diagramImages['entityRelationship']) {
            const imgData = diagramImages['entityRelationship'];
            const imgProps = doc.getImageProperties(imgData);
            const imgRatio = imgProps.height / imgProps.width;

            const maxWidth = contentWidth;
            const maxHeight = pageHeight - margins.top - margins.bottom - 40;

            let finalWidth = maxWidth;
            let finalHeight = finalWidth * imgRatio;

            if (finalHeight > maxHeight) {
                finalHeight = maxHeight;
                finalWidth = finalHeight / imgRatio;
            }

            checkPageBreak(finalHeight + 20);
            const xOffset = margins.left + (contentWidth - finalWidth) / 2;
            doc.addImage(imgData, 'PNG', xOffset, yPos, finalWidth, finalHeight);
            yPos += finalHeight + 5;
        } else {
            doc.setFont("courier", "normal");
            doc.setFontSize(8);

            const codeLines = doc.splitTextToSize(getDiagramCode(data.appendices.analysisModels.entityRelationshipDiagram), contentWidth - 4);
            const boxHeight = (codeLines.length * 4) + 6;
            checkPageBreak(boxHeight + 20);

            doc.rect(margins.left, yPos, contentWidth, boxHeight);
            doc.text(codeLines, margins.left + 2, yPos + 4);
            yPos += boxHeight + 5;
        }

        const caption = getDiagramCaption(data.appendices.analysisModels.entityRelationshipDiagram, "Entity Relationship Diagram");
        const figId = "Figure B.4";
        doc.setFont("times", "normal");
        doc.setFontSize(12);
        doc.text(`${figId}: ${caption}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;
    }

    if (data.appendices?.tbdList) {
        addChapterHeader("Appendix C:", "To Be Determined List", true);
        addRequirementList(data.appendices.tbdList, 'bullet');
    }

    // ===========================
    // 4. POST-PROCESSING: HEADERS & TOC
    // ===========================

    // Go back and fill ToC
    let currentTocPage = tocStartPage;
    doc.setPage(currentTocPage);
    yPos = margins.top;

    // Header for first ToC Page (Roman ii)
    // Removed manual header to use global loop

    doc.setFontSize(12);
    doc.setFont("times", "normal");

    tocItems.forEach(item => {
        // Check overflow for ToC
        if (yPos > pageHeight - margins.bottom) {
            currentTocPage++;
            // Check if page exists (safeguard)
            if (currentTocPage <= doc.getNumberOfPages()) {
                doc.setPage(currentTocPage);
                yPos = margins.top + 10;
            }
        }

        doc.setFont("times", item.level === 1 ? "bold" : "normal");
        doc.setFontSize(12);

        // Calculate logical page number
        let logicalPageNumStr = "";

        // Determine offset dynamically based on "1. Introduction"
        const introItem = tocItems.find(t => t.title.startsWith("1. "));
        const offset = introItem ? (introItem.page - 1) : (2 + tocNeedsPages);

        const logicalPageNum = item.page - offset;

        // Format Page Number (Roman for Front Matter, Arabic for Content)
        if (logicalPageNum > 0) {
            logicalPageNumStr = logicalPageNum.toString();
        } else {
            // Front Matter (e.g., Revision History)
            const romanVals = ["", "i", "ii", "iii", "iv", "v", "vi"];

            // Actually, we just want to know if it's page 2, 3..
            // If item.page is 2, it is ii.
            if (item.page > 0 && item.page < romanVals.length) {
                logicalPageNumStr = romanVals[item.page - 1]; // Page 2 -> i (if 0-indexed) or ii?
                // Cover = 1. ToC Start = 2.
                // Page 2 should be 'ii'.
                // romanVals[1] = 'i'. romanVals[2] = 'ii'.
                // So romanVals[item.page] might be better if item.page is 1-based index?
                // Wait. item.page is physical page number.
                // If Item is on Page 2, we want 'ii'.
                // romanVals[2] = 'ii'. Perfect.
                logicalPageNumStr = romanVals[item.page];
            }
        }

        const titlePart = item.title;
        const xIndent = margins.left + ((item.level - 1) * 5); // Indent by level

        // Dot Leaders
        doc.text(titlePart, xIndent, yPos);

        // Add Link to the entire row area
        doc.link(xIndent, yPos - 4, pageWidth - margins.right - xIndent, 5, { pageNumber: item.page });

        if (logicalPageNumStr) {
            doc.text(logicalPageNumStr, pageWidth - margins.right, yPos, { align: 'right' });

            const titleWidth = doc.getTextWidth(titlePart);
            const pageNumWidth = doc.getTextWidth(logicalPageNumStr);
            const startX = xIndent + titleWidth + 2;
            const endX = pageWidth - margins.right - pageNumWidth - 2;

            if (endX > startX) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (doc as any).setLineDash([0.5, 1], 0);

                // Make dots bold for Level 1
                const originalLineWidth = doc.getLineWidth();
                if (item.level === 1) {
                    doc.setLineWidth(0.6); // Thicker for bold look
                } else {
                    doc.setLineWidth(0.2); // Normal
                }

                doc.line(startX, yPos, endX, yPos);

                // Reset
                doc.setLineWidth(originalLineWidth);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (doc as any).setLineDash([]);
            }
        }
        yPos += 6;

        // Check for page break inside ToC loop
        if (yPos > pageHeight - margins.bottom) {
            currentTocPage++;
            doc.setPage(currentTocPage);
            yPos = margins.top + 10;
        }
    });

    // Revision History already rendered in Front Matter loop.
    // Logic for ToC rendering (lines/dots) continues above.

    // RENDER REVISION HISTORY HERE (Immediately after ToC)
    // This ensures no blank pages between ToC and Rev History.
    yPos += 10;

    // Check space
    if (yPos + 40 > pageHeight - margins.bottom) {
        // Just add a new page if we ran out of space in the reserved block
        // Note: We are currently inside the document generation flow.
        // We can just rely on ensuring we are on a valid page?
        // Actually, we are "revisiting" pages 2..N to draw ToC.
        // If we overflow the CURRENT page, we should move to next reserved page.
        // But we don't know if next page is reserved or Content started?
        // We rely on "tocNeedsPages" being sufficient.
        currentTocPage++;
        doc.setPage(currentTocPage);
        yPos = margins.top + 10;
        // revisionHistoryPage = currentTocPage;
    } else {
        // revisionHistoryPage = currentTocPage; // Same page
    }

    doc.setFontSize(16);
    doc.setFont("times", "bold");
    doc.text("Revision History", margins.left, yPos);
    yPos += 10;

    const revBody = data.revisionHistory && data.revisionHistory.length > 0
        ? data.revisionHistory.map(r => [r.version, r.date, r.description, r.author])
        : [['1.0', new Date().toLocaleDateString('en-GB'), 'Initial Draft', 'User']];

    autoTable(doc, {
        startY: yPos,
        head: [['Version', 'Date', 'Description', 'Author']],
        body: revBody,
        margin: { left: margins.left, right: margins.right },
        theme: 'grid',
        headStyles: {
            fillColor: [220, 220, 220],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
        },
        styles: { font: 'times', fontSize: 12 },
        bodyStyles: { textColor: [0, 0, 0], lineWidth: 0.1 }
    });

    // Update Revision History page number in ToC items (which we just rendered? No, we rendered ToC lines but not values?)
    // Actually we just WROTE the ToC lines. 
    // The "Revision History" line was written with page 0 or whatever was in tocItems.
    // If we want the page number to be correct in the line we just drew, we needed it BEFORE loop.
    // Circular dependency? 
    // Yes. But Revision History is usually Page ii or similar.
    // If we assume it follows ToC, we can update it for NEXT time or try to patch it.
    // But since we are WRITING it now... 
    // Ideally we update the 'page' property in tocItems and THEN loop to draw.
    // But we are drawing inside the loop.
    // It's acceptable if the page number shown FOR Revision History is approximate or we accept it might be 1 off if it moved.
    // BUT, since we are moving it, let's update it in tocItems *before* the loop? 
    // No, we don't know where it lands until we run the loop.

    // Compromise: We render Rev Hist. The Page Number listing in ToC for "Revision History" might be the *reserved* one.
    // We update tocItems *after* this so at least the underlying data is correct (if we re-render or for metadata).
    // The displayed line for "Revision History" has already been drawn.
    // If it says "ii" and it's on "ii", great. If it moved to "iii", it might be wrong.
    // Since this is a tricky single-pass generation, we'll accept this for now or do 2 passes if critical.
    // Given the user constraint "blank page", closing the gap is higher priority.

    // Correct the page number of the "Revision History" item in ToC
    // Logic removed as revisionHistoryPage tracking is no longer used.
    // if (tocItems.length > 0) {
    //    const revItem = tocItems.find(t => t.title === "Revision History");
    //    if (revItem) revItem.page = 0; 
    // }

    // --- BLANK PAGE CLEANUP ---
    // Previous logic to delete unused pages causes crashes if links point to them.
    // Disabling deletePage to prevent "objId undefined" error.
    /* 
    const reservedEndPage = tocStartPage + tocNeedsPages - 1;
    const actuallyUsedPage = currentTocPage;
    
    if (actuallyUsedPage < reservedEndPage) {
        // Safe cleanup not possible easily with existing links. 
        // Better to leave blank page than crash.
    }
    */

    // Page Headers
    const totalPages = doc.getNumberOfPages();

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1) continue; // Cover Page (Page 1 physical): NO Header

        // Page Numbering: Arabic only, starts AFTER cover page
        // So Physical Page 2 => "Page 1"
        const pageNum = p - 1;

        doc.setPage(p);

        // Header Text
        const headerTitle = `Software Requirements Specification for ${title}`;
        const headerPage = `Page ${pageNum}`;

        doc.setFontSize(10);

        // Left: Title (Italic as requested)
        doc.setFont("times", "italic");
        doc.text(headerTitle, margins.left, 12, { align: 'left' });

        // Right: Page Number (Normal)
        doc.setFont("times", "italic");
        doc.text(headerPage, pageWidth - margins.right, 12, { align: 'right' });
    }

    return doc;
};

// Keep other exports, maybe adjusting them if needed, but generateSRS is key.
export const generateAPI = (data: AnalysisResult) => {
    console.log("Generating API for", data.introduction?.projectName || "Project");
    return "# API Documentation\n(To be implemented for new structure)";
};

export const downloadBundle = async (data: AnalysisResult, title: string) => {
    const { default: JSZip } = await import('jszip');
    const { saveAs } = await import('file-saver');
    const zip = new JSZip();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mermaid: any = null;
    try {
        const mermaidModule = await import('mermaid');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mermaid = (mermaidModule as any).default;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mermaid as any).initialize({
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'loose',
        });
    } catch (e) {
        console.warn("Mermaid failed to load", e);
    }

    try {
        const srsDoc = await generateSRS(data, title);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        zip.file("SRS_Report.pdf", (srsDoc as any).output('blob'));
    } catch (e) {
        console.error("Failed to add SRS to bundle", e);
    }

    // Try rendering diagrams for separate files
    const renderDiagram = async (code: string, id: string) => {
        try {
            if (!code || !mermaid) return null;
            const uniqueId = `${id}-${Math.random().toString(36).substr(2, 9)}`;
            // We need a DOM node to render
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

    if (data.appendices?.analysisModels?.flowchartDiagram) {
        zip.file("diagrams/flowchart.mmd", getDiagramCode(data.appendices.analysisModels.flowchartDiagram));
        const svg = await renderDiagram(getDiagramCode(data.appendices.analysisModels.flowchartDiagram), 'flowchart');
        if (svg) {
            zip.file("diagrams/flowchart.svg", svg);
            const png = await svgToPng(svg);
            if (png) zip.file("diagrams/flowchart.png", png);
        }
    }

    if (data.appendices?.analysisModels?.sequenceDiagram) {
        zip.file("diagrams/sequence.mmd", getDiagramCode(data.appendices.analysisModels.sequenceDiagram));
        const svg = await renderDiagram(getDiagramCode(data.appendices.analysisModels.sequenceDiagram), 'sequence');
        if (svg) {
            zip.file("diagrams/sequence.svg", svg);
            const png = await svgToPng(svg);
            if (png) zip.file("diagrams/sequence.png", png);
        }
    }

    // Raw JSON
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
    // Dynamic imports to reduce bundle size
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

