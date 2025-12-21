import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import type { AnalysisResult } from '@/types/analysis';

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
            const scale = 3;
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

// Helper to strip markdown bullets/numbering from requirements
const normalizeText = (text: string) => {
    return text.replace(/^[\s\*\-\•\d\.\)]+\s*/, '').trim();
};

export const renderMermaidDiagrams = async (data: AnalysisResult): Promise<Record<string, string>> => {
    const images: Record<string, string> = {};
    if (!data.appendices?.analysisModels) return images;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mermaid: any = null;
    try {
        const mermaidModule = await import('mermaid');
        mermaid = mermaidModule.default;
        mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'loose',
            flowchart: { useMaxWidth: false, htmlLabels: true }
        });
    } catch (e) {
        console.warn("Mermaid failed to load", e);
        return images;
    }

    const render = async (code: string, id: string) => {
        try {
            if (!code) return null;
            const uniqueId = `${id}-${Math.random().toString(36).substr(2, 9)}`;
            const element = document.createElement('div');
            document.body.appendChild(element);
            const { svg } = await mermaid.render(uniqueId, code, element);
            document.body.removeChild(element);

            const pngBlob = await svgToPng(svg);
            if (!pngBlob) return null;

            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(pngBlob);
            });
        } catch (e) {
            console.error(`Failed to render diagram ${id}`, e);
            return null;
        }
    };

    if (data.appendices.analysisModels.flowchartDiagram) {
        const img = await render(data.appendices.analysisModels.flowchartDiagram, 'flowchart');
        if (img) images['flowchart'] = img;
    }

    if (data.appendices.analysisModels.sequenceDiagram) {
        const img = await render(data.appendices.analysisModels.sequenceDiagram, 'sequence');
        if (img) images['sequence'] = img;
    }

    if (data.appendices.analysisModels.dataFlowDiagram) {
        const img = await render(data.appendices.analysisModels.dataFlowDiagram, 'dataFlow');
        if (img) images['dataFlow'] = img;
    }

    if (data.appendices.analysisModels.entityRelationshipDiagram) {
        const img = await render(data.appendices.analysisModels.entityRelationshipDiagram, 'entityRelationship');
        if (img) images['entityRelationship'] = img;
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
        if (data.appendices.analysisModels.dataFlowDiagram) items += 1;
        if (data.appendices.analysisModels.entityRelationshipDiagram) items += 1;
    }
    if (data.appendices?.tbdList) items += 1;

    // Add Revision History item
    items += 1;

    return items;
};

export const generateSRS = (data: AnalysisResult, title: string, diagramImages: Record<string, string> = {}) => {
    const doc = new jsPDF();
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

    // --- State & Navigation ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tocItems: { title: string, page: number, level: number }[] = [];
    // Add Revision History to ToC (placeholder page)
    tocItems.push({ title: "Revision History", page: 0, level: 1 });
    let contentStartPage = 0;
    let revisionHistoryPage = 0;

    // Requirement Counters
    let frCount = 0;
    let prCount = 0;
    let safeCount = 0;
    let secCount = 0;
    let qaCount = 0;
    let brCount = 0;
    let orCount = 0;

    // --- PAGE OPERATIONS ---

    const addHeader = (pageNumLabel: string) => {
        doc.setFontSize(10);
        doc.setFont("times", "bolditalic");

        // Document Title (Left)
        const headerText = `Software Requirements Specification for ${title}`;
        doc.text(headerText, margins.left, 12, { align: 'left' });

        // Page Number (Right)
        doc.text(pageNumLabel, pageWidth - margins.right, 12, { align: 'right' });
    };

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

    const addParagraph = (text: string, isBold: boolean = false) => {
        doc.setFont("times", isBold ? "bold" : "normal");
        doc.setFontSize(12);

        // Justified Text
        const lines = doc.splitTextToSize(clean(text), contentWidth);
        const lineHeight = 5; // ~1.0 line spacing

        const height = lines.length * lineHeight;
        checkPageBreak(height + 2);

        doc.text(lines, margins.left, yPos, { maxWidth: contentWidth, align: 'justify' });
        yPos += height + 4; // Paragraph spacing
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
        yPos += 6;
        doc.setFontSize(12);
        doc.setFont("times", "normal");
    };

    // SubHeading (Level 3) - Normal weight, Justified
    const addSubHeader = (number: string, titleText: string) => {
        checkPageBreak(10);
        doc.setFontSize(12);
        doc.setFont("times", "normal"); // NOT BOLD
        const fullTitle = `${number} ${titleText}`;
        doc.text(fullTitle, margins.left, yPos, { align: 'left' });

        // Generally subheaders are NOT in ToC for IEEE summaries unless detailed, 
        // user prompted "Reflect exact numbering hierarchy", so we'll add logic if needed,
        // but typically H3 clutter ToC. We will skip H3 in ToC to be clean, or add if requested.
        // User (Step 625): "keep the table upto heading and sub-headings only... no need to add 4.1.1"
        /*
        tocItems.push({
            title: fullTitle,
            page: doc.getCurrentPageInfo().pageNumber,
            level: 3
        });
        */

        yPos += 6;
    };

    // Requirement Lists
    const addRequirementList = (items: string[], type: 'bullet' | 'functional' | 'performance' | 'safety' | 'security' | 'quality' | 'business' | 'other' | 'stimulus' = 'bullet') => {
        if (!items || items.length === 0) return;
        doc.setFont("times", "normal");
        doc.setFontSize(12);

        items.forEach(item => {
            let prefix = "• ";
            let contentText = normalizeText(clean(item));
            let idLabel = "";

            if (type === 'functional') {
                frCount++;
                idLabel = `SRA-FR-${frCount}: `;
                prefix = "";
            } else if (type === 'performance') {
                prCount++;
                idLabel = `SRA-PR-${prCount}: `;
                prefix = "";
            } else if (type === 'safety') {
                safeCount++;
                idLabel = `SRA-SR-${safeCount}: `;
                prefix = "";
            } else if (type === 'security') {
                secCount++;
                idLabel = `SRA-SE-${secCount}: `;
                prefix = "";
            } else if (type === 'quality') {
                qaCount++;
                idLabel = `SRA-QA-${qaCount}: `;
                prefix = "";
            } else if (type === 'business') {
                brCount++;
                idLabel = `BR-${brCount}: `;
                prefix = "";
            } else if (type === 'other') {
                orCount++;
                idLabel = `SRA-OR-${orCount}: `;
                prefix = "";
            }

            if (type === 'stimulus') {
                const stimMatch = contentText.match(/Stimulus:(.*?)Response:(.*)/i);
                if (stimMatch) {
                    const stimText = stimMatch[1].trim();
                    const resText = stimMatch[2].trim();

                    // Stimulus
                    const sLine = `• Stimulus: ${stimText}`;
                    let lines = doc.splitTextToSize(sLine, contentWidth - 5);
                    let h = lines.length * 5;
                    checkPageBreak(h);
                    doc.text(lines, margins.left + 5, yPos);
                    yPos += h + 2;

                    // Response
                    const rLine = `Response: ${resText}`;
                    lines = doc.splitTextToSize(rLine, contentWidth - 15);
                    h = lines.length * 5;
                    checkPageBreak(h);
                    doc.text(lines, margins.left + 15, yPos);
                    yPos += h + 4;
                    return;
                }
            }

            if (idLabel) {
                contentText = `${idLabel}${contentText}`;
            } else if (type !== 'stimulus') {
                contentText = `${prefix}${contentText}`;
            }

            const lines = doc.splitTextToSize(contentText, contentWidth - 5);
            const height = lines.length * 5;
            checkPageBreak(height);
            doc.text(lines, margins.left + 5, yPos, { maxWidth: contentWidth - 5, align: 'justify' });
            yPos += height + 3;
        });
        yPos += 2;
    };

    // ===========================
    // 1. COVER PAGE (Right Aligned)
    // ===========================
    doc.setFont("times", "bold");

    // Helper helper
    const rightText = (txt: string, y: number, fontSize: number, isBold: boolean = true) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.text(txt, pageWidth - margins.right, y, { align: 'right' });
    };

    // Black Header Bar
    yPos = 20;
    doc.setFillColor(0, 0, 0);
    doc.rect(margins.left, yPos, contentWidth + 2, 1, 'F'); // Bar respects margins
    doc.setTextColor(0, 0, 0);

    yPos += 20; // Moved text up closer to bar
    rightText("Software Requirements", yPos, 28, true);
    yPos += 12;
    rightText("Specification", yPos, 28, true);

    yPos += 20; // Reduced gap
    rightText("for", yPos, 28, true);

    yPos += 20; // Reduced gap

    // Project Title (Multiline support)
    const maxWidth = pageWidth - margins.left - margins.right;
    const projectTitleLines = doc.splitTextToSize(title || "Project Name", maxWidth);

    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text(projectTitleLines, pageWidth - margins.right, yPos, { align: 'right' });

    yPos += (projectTitleLines.length * 12);

    yPos += 20; // Reduced gap
    rightText("Version 1.0 approved", yPos, 14, true);

    yPos += 20;
    rightText(`Prepared by ${"User"}`, yPos, 14, true);

    yPos += 20;
    rightText("Smart Requirements Analyzer", yPos, 14, true);

    yPos += 20;
    rightText(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), yPos, 14, true);

    // Footer Caption
    yPos = pageHeight - 15;
    doc.setFontSize(10);
    doc.setFont("times", "bolditalic");
    const copyrightText = "Copyright © 1999 by Karl E. Wiegers. Permission is granted to use, modify, and distribute this document.";
    doc.text(copyrightText, pageWidth / 2, yPos, { align: 'center' });


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
    revisionHistoryPage = tocStartPage + tocNeedsPages - 1;

    // Content starts after the reserved block
    // We already added pages in the loop above.
    // So distinct content starts on next page via addChapterHeader logic.
    // addNewPage(); // Removed redundant page break
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
        addParagraph("This document follows IEEE Std 830-1998 for SRS.");

        addSectionHeader("1.3", "Intended Audience and Reading Suggestions");
        addParagraph(data.introduction.intendedAudience);

        addSectionHeader("1.4", "Product Scope");
        addParagraph(data.introduction.scope);

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
                const lines = doc.splitTextToSize(clean(uc.characteristics), contentWidth - 10);
                checkPageBreak(lines.length * 5);
                doc.text(lines, margins.left + 10, yPos, { maxWidth: contentWidth - 10, align: 'justify' });
                yPos += (lines.length * 5) + 4;
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

            // Handle Description
            if (feature.description.includes("Priority:")) {
                const parts = feature.description.split("Priority:");
                addParagraph(parts[0]);
                if (parts[1]) {
                    doc.setFont("times", "bold");
                    doc.text(`Priority: ${parts[1].trim()}`, margins.left, yPos); // Explicit line
                    yPos += 8;
                }
            } else {
                addParagraph(feature.description);
            }

            addSubHeader(`${featNum}.2`, "Stimulus/Response Sequences");
            addRequirementList(feature.stimulusResponseSequences, 'stimulus');

            addSubHeader(`${featNum}.3`, "Functional Requirements");
            addRequirementList(feature.functionalRequirements, 'functional');
        });
    }

    // --- 5. Other Nonfunctional Requirements ---
    if (data.nonFunctionalRequirements) {
        addChapterHeader("5.", "Other Nonfunctional Requirements", true);

        addSectionHeader("5.1", "Performance Requirements");
        addRequirementList(data.nonFunctionalRequirements.performanceRequirements, 'performance');

        addSectionHeader("5.2", "Safety Requirements");
        addRequirementList(data.nonFunctionalRequirements.safetyRequirements, 'safety');

        addSectionHeader("5.3", "Security Requirements");
        addRequirementList(data.nonFunctionalRequirements.securityRequirements, 'security');

        addSectionHeader("5.4", "Software Quality Attributes");
        addRequirementList(data.nonFunctionalRequirements.softwareQualityAttributes, 'quality');

        addSectionHeader("5.5", "Business Rules");
        addRequirementList(data.nonFunctionalRequirements.businessRules, 'business');
    }

    // --- 6. Other Requirements ---
    if (data.otherRequirements) {
        addChapterHeader("6.", "Other Requirements", true);
        addRequirementList(data.otherRequirements, 'other');
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
                yPos = data.cursor.y + 10;
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
                const codeLines = doc.splitTextToSize(data.appendices.analysisModels.flowchartDiagram, contentWidth - 4);
                const boxHeight = (codeLines.length * 4) + 6;
                checkPageBreak(boxHeight + 20);

                doc.rect(margins.left, yPos, contentWidth, boxHeight);
                doc.text(codeLines, margins.left + 2, yPos + 4);
                yPos += boxHeight + 5;
            }

            // Caption
            doc.setFont("times", "normal");
            doc.setFontSize(12);
            doc.text("Figure B.1: System Flowchart", pageWidth / 2, yPos, { align: 'center' });
            yPos += 10;
        }

        if (data.appendices.analysisModels.sequenceDiagram) {
            addSectionHeader("B.2", "Sequence Diagram");

            if (diagramImages['sequence']) {
                const imgData = diagramImages['sequence'];
                const imgProps = doc.getImageProperties(imgData);
                const imgRatio = imgProps.height / imgProps.width;
                const imgWidth = contentWidth;
                const imgHeight = imgWidth * imgRatio;

                checkPageBreak(imgHeight + 20);
                doc.addImage(imgData, 'PNG', margins.left, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 5;
            } else {
                doc.setFont("courier", "normal");
                doc.setFontSize(8);

                const codeLines = doc.splitTextToSize(data.appendices.analysisModels.sequenceDiagram, contentWidth - 4);
                const boxHeight = (codeLines.length * 4) + 6;
                checkPageBreak(boxHeight + 20);

                doc.rect(margins.left, yPos, contentWidth, boxHeight);
                doc.text(codeLines, margins.left + 2, yPos + 4);
                yPos += boxHeight + 5;
            }

            doc.setFont("times", "normal");
            doc.setFontSize(12);
            doc.text("Figure B.2: System Sequence Diagram", pageWidth / 2, yPos, { align: 'center' });
            yPos += 10;
        }

        if (data.appendices.analysisModels.dataFlowDiagram) {
            addSectionHeader("B.3", "Data Flow Diagram");

            if (diagramImages['dataFlow']) {
                const imgData = diagramImages['dataFlow'];
                const imgProps = doc.getImageProperties(imgData);
                const imgRatio = imgProps.height / imgProps.width;
                const imgWidth = contentWidth;
                const imgHeight = imgWidth * imgRatio;

                checkPageBreak(imgHeight + 20);
                doc.addImage(imgData, 'PNG', margins.left, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 5;
            } else {
                doc.setFont("courier", "normal");
                doc.setFontSize(8);

                const codeLines = doc.splitTextToSize(data.appendices.analysisModels.dataFlowDiagram, contentWidth - 4);
                const boxHeight = (codeLines.length * 4) + 6;
                checkPageBreak(boxHeight + 20);

                doc.rect(margins.left, yPos, contentWidth, boxHeight);
                doc.text(codeLines, margins.left + 2, yPos + 4);
                yPos += boxHeight + 5;
            }

            doc.setFont("times", "normal");
            doc.setFontSize(12);
            doc.text("Figure B.3: Data Flow Diagram", pageWidth / 2, yPos, { align: 'center' });
            yPos += 10;
        }

        if (data.appendices.analysisModels.entityRelationshipDiagram) {
            addSectionHeader("B.4", "Entity Relationship Diagram");

            if (diagramImages['entityRelationship']) {
                const imgData = diagramImages['entityRelationship'];
                const imgProps = doc.getImageProperties(imgData);
                const imgRatio = imgProps.height / imgProps.width;
                const imgWidth = contentWidth;
                const imgHeight = imgWidth * imgRatio;

                checkPageBreak(imgHeight + 20);
                doc.addImage(imgData, 'PNG', margins.left, yPos, imgWidth, imgHeight);
                yPos += imgHeight + 5;
            } else {
                doc.setFont("courier", "normal");
                doc.setFontSize(8);

                const codeLines = doc.splitTextToSize(data.appendices.analysisModels.entityRelationshipDiagram, contentWidth - 4);
                const boxHeight = (codeLines.length * 4) + 6;
                checkPageBreak(boxHeight + 20);

                doc.rect(margins.left, yPos, contentWidth, boxHeight);
                doc.text(codeLines, margins.left + 2, yPos + 4);
                yPos += boxHeight + 5;
            }

            doc.setFont("times", "normal");
            doc.setFontSize(12);
            doc.text("Figure B.4: Entity Relationship Diagram", pageWidth / 2, yPos, { align: 'center' });
            yPos += 10;
        }
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

    doc.setFontSize(12);
    doc.setFont("times", "normal");

    tocItems.forEach(item => {
        // Check overflow for ToC
        if (yPos > pageHeight - margins.bottom) {
            currentTocPage++;
            // Allow using the last reserved page (revisionHistoryPage) too.
            // In fact, allow going beyond if reservation failed, to avoid invisible text.
            if (currentTocPage <= revisionHistoryPage + 1) {
                doc.setPage(currentTocPage);
                yPos = margins.top + 10;

                // Header handled by global loop
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
            const pIdx = item.page - 1; // logical page index in front matter?
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
    });

    // Render Revision History immediately after ToC
    yPos += 8; // Reduced gap to shift table up significantly

    // Ensure we have space for Heading + Table Header (approx 40mm)
    if (yPos + 40 > pageHeight - margins.bottom) {
        // Move to next reserved page. 
        // We TRUST our calculation reserved enough pages.
        // If not, we theoretically overwrite content, but calculation should be robust.
        currentTocPage++;
        doc.setPage(currentTocPage);
        yPos = margins.top + 10;
    }

    doc.setFontSize(16);
    doc.setFont("times", "bold");
    doc.text("Revision History", margins.left, yPos);
    yPos += 10;

    autoTable(doc, {
        startY: yPos,
        head: [['Name', 'Date', 'Reason for Changes', 'Version']],
        body: [
            ['User', new Date().toLocaleDateString('en-GB'), 'Initial Draft', '1.0']
        ],
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
            fontStyle: 'bold', // User requested bold table content
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
        },
        styles: {
            cellPadding: 3,
            fontSize: 12,
            overflow: 'linebreak'
        },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 40 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 30 }
        }
    });

    // Correct the page number of the "Revision History" item in ToC
    if (tocItems.length > 0 && tocItems[0].title === "Revision History") {
        tocItems[0].page = currentTocPage;
    }

    // --- BLANK PAGE CLEANUP ---
    // If we reserved more pages than needed, delete them to avoid blank pages.
    const reservedEndPage = tocStartPage + tocNeedsPages - 1;
    const actuallyUsedPage = currentTocPage;

    // If we finished on Page 2, but reserved up to Page 3.
    if (actuallyUsedPage < reservedEndPage) {
        const pagesToDeleteCount = reservedEndPage - actuallyUsedPage;

        // Delete pages from end of reserved block backwards
        // e.g. Reserved 2, 3. Used 2. Delete 3.
        for (let p = reservedEndPage; p > actuallyUsedPage; p--) {
            doc.deletePage(p);
        }

        // SHIFT content page numbers in tocItems
        // Everything that was on Page 4 (Intro) is now on Page 3.
        // Shift amount = pagesToDeleteCount.
        tocItems.forEach(item => {
            if (item.page > reservedEndPage) {
                item.page -= pagesToDeleteCount;
            }
        });
    }

    // Page Headers
    const totalPages = doc.getNumberOfPages();

    // Determine the physical page where "1. Introduction" starts
    const introItem = tocItems.find(t => t.title.startsWith("1. "));
    const introPhysicalPage = introItem ? introItem.page : (tocStartPage + tocNeedsPages + 1);

    // Offset so that Intro Page becomes Page 1
    // If Intro is p=4, Offset = 3. p-offset = 1.
    const contentOffset = introPhysicalPage - 1;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1) continue; // Cover Page: No header

        // Determine label
        let label = "";

        if (p < introPhysicalPage) {
            // Front Matter (ToC, Rev History) -> Roman
            const roman = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
            // Adjust: p=2 is usually ii.
            label = roman[p] || p.toString();
        } else {
            // Content -> Arabic "Page X"
            const pageNum = p - contentOffset;
            label = `Page ${pageNum}`;
        }

        if (label) {
            doc.setPage(p);
            addHeader(label);
        }
    }

    return doc;
};

// Keep other exports, maybe adjusting them if needed, but generateSRS is key.
export const generateAPI = (data: AnalysisResult) => {
    // API logic might need to check if existing apiContracts exist in new structure
    // This part is less critical for the specific user request about SRS PDF, but good compatibility to keep.
    return "# API Documentation\n(To be implemented for new structure)";
};

export const downloadBundle = async (data: AnalysisResult, title: string) => {
    const zip = new JSZip();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mermaid: any = null;
    try {
        const mermaidModule = await import('mermaid');
        mermaid = mermaidModule.default;
        mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'loose',
        });
    } catch (e) {
        console.warn("Mermaid failed to load", e);
    }

    try {
        const srsDoc = generateSRS(data, title);
        zip.file("SRS_Report.pdf", srsDoc.output('blob'));
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
        zip.file("diagrams/flowchart.mmd", data.appendices.analysisModels.flowchartDiagram);
        const svg = await renderDiagram(data.appendices.analysisModels.flowchartDiagram, 'flowchart');
        if (svg) {
            zip.file("diagrams/flowchart.svg", svg);
            const png = await svgToPng(svg);
            if (png) zip.file("diagrams/flowchart.png", png);
        }
    }

    if (data.appendices?.analysisModels?.sequenceDiagram) {
        zip.file("diagrams/sequence.mmd", data.appendices.analysisModels.sequenceDiagram);
        const svg = await renderDiagram(data.appendices.analysisModels.sequenceDiagram, 'sequence');
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const downloadCodebase = async (codeData: any, title: string) => {
    // Kept as is for now
    const zip = new JSZip();
    if (codeData.databaseSchema) zip.file("prisma/schema.prisma", codeData.databaseSchema);

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
