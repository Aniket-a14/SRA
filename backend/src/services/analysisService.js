import prisma from '../config/prisma.js';
import { lintRequirements, checkAlignment } from './qualityService.js';
import { analyzeText, repairDiagram } from './aiService.js';
import crypto from 'crypto';
import { retrieveContext, formatRagContext } from './ragService.js';
import { getRedisClient } from '../config/redis.js';

const CACHE_TTL = 60; // 60 seconds cache for dashboard

export const performAnalysis = async (userId, text, projectId = null, parentId = null, rootId = null, settings = {}, analysisId = null) => {
    let resultJson;
    let analysisMeta = {};

    try {
        // LAYER 5: Granular RAG Retrieval
        const ragChunks = await retrieveContext(text);
        const ragContext = formatRagContext(ragChunks);
        const ragSources = [...new Set(ragChunks.map(c => c.sourceTitle).filter(Boolean))];

        // Direct function call with RAG context
        const response = await analyzeText(text, {
            ...settings,
            systemPromptExtension: ragContext
        });

        if (response.success && response.srs) {
            resultJson = response.srs;
            analysisMeta = {
                ...(response.meta || {}),
                ragSources
            };

            // Backend Self-Correction: Fix diagrams before finalizing
            await validateAndAutoRepairDiagrams(resultJson, settings);
        } else {
            throw new Error(response.error || "AI Analysis execution failed to return valid SRS");
        }
    } catch (error) {
        console.error("AI Analysis execution failed:", error.message);
        // If we have an ID, we should fail it
        if (analysisId) {
            await prisma.analysis.update({
                where: { id: analysisId },
                data: { status: 'FAILED' }
            });
        }
        throw new Error('Failed to communicate with analysis service');
    }

    // Run Quality Check (Linting)
    const qualityAudit = lintRequirements(resultJson);
    resultJson = {
        ...resultJson,
        qualityAudit,
        promptSettings: settings // Store settings
    };

    // Update metadata with governance info
    // We assume "settings" was passed in. analysisMeta overrides it if AI service provided explicit version info.
    const finalMetadata = {
        trigger: 'initial',
        ...analysisMeta
    };

    // Note: We need to pass this metadata to the update call effectively.
    // The "update" below updates `resultJson`. `metadata` is a separate column.
    // We should merge it.


    // LAYER 3: Alignment Check (Sync with Layer 1 & 2)
    if (analysisId) {
        try {
            const existingAnalysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
            if (existingAnalysis && existingAnalysis.metadata && existingAnalysis.metadata.draftData) {
                const draftData = existingAnalysis.metadata.draftData;

                const layer1Intent = {
                    projectName: draftData.details?.projectName?.content || "Project",
                    rawText: text // We use the input text passed to this function
                };
                const layer2Context = {
                    domain: "inferred", // We could infer from draftData if needed
                    purpose: draftData.details?.fullDescription?.content || "Purpose"
                };

                const alignmentResult = await checkAlignment(layer1Intent, layer2Context, resultJson);
                resultJson.alignmentResult = alignmentResult;

                if (alignmentResult.status === 'MISMATCH_DETECTED') {
                    resultJson.layer3Status = 'MISMATCH';
                } else {
                    resultJson.layer3Status = 'ALIGNED';
                }
            }
        } catch (l3Error) {
            console.warn("Layer 3 Check (Initial) Failed:", l3Error);
        }
    }

    // Atomic Creation with Transaction
    return await prisma.$transaction(async (tx) => {
        // If analysisId is provided, we update the existing record
        if (analysisId) {
            const existing = await tx.analysis.findUnique({ where: { id: analysisId } });
            if (!existing) throw new Error("Analysis ID not found during processing");

            // We still need to calculate title if missing
            const title = resultJson.projectTitle || `Version ${existing.version}`;

            // Retrieve existing method metadata if needed, but here we usually overwrite or merge.
            // Since we are completing the job, we want to finalize metadata.

            return await tx.analysis.update({
                where: { id: analysisId },
                data: {
                    resultJson,
                    title,
                    status: 'COMPLETED',
                    isFinalized: false, // default
                    metadata: {
                        ...(existing.metadata || {}),
                        ...analysisMeta, // Contains promptVersion
                        completionTime: new Date().toISOString()
                    }
                }
            });
        }

        // --- LEGACY / DIRECT SYNC FLOW ---
        // DEPRECATED: All analyses should now be created via queueService with an ID upfront.
        throw new Error("performAnalysis called without analysisId. Legacy direct creation is deprecated.");
    });
};

export const getUserAnalyses = async (userId) => {
    // 0. Cache Check
    const redis = getRedisClient();
    const CACHE_KEY = `user:analyses:${userId}`;

    if (redis) {
        try {
            const cached = await redis.get(CACHE_KEY);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (err) {
            console.warn("Redis Cache Read Error:", err.message);
        }
    }

    // Optimized: Get LATEST version for each rootId using PostgreSQL DISTINCT ON
    try {
        const analyses = await prisma.$queryRaw`
            SELECT DISTINCT ON ("rootId")
                id,
                "createdAt",
                "inputText",
                version,
                title,
                "rootId",
                "parentId",
                metadata
            FROM "Analysis"
            WHERE "userId" = ${userId}
            ORDER BY "rootId", version DESC
        `;

        // Sort resulting list by createdAt desc (most recent projects first)
        analyses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Return truncated review with intelligent JSON preview extraction
        const result = analyses.map(a => {
            let preview = a.inputText;

            // Optimized Preview Extraction
            try {
                // 1. Strip System Tags first to get to the real content
                preview = preview
                    .replace(/\[ORIGINAL_REQUEST_START\][\s\S]*?\[ORIGINAL_REQUEST_END\]/g, "")
                    .replace(/\[PREVIOUS_SRS_CONTEXT_START\][\s\S]*?\[PREVIOUS_SRS_CONTEXT_END\]/g, "")
                    .replace(/\[IMPROVEMENT_INSTRUCTION_START\][\s\S]*?\[IMPROVEMENT_INSTRUCTION_END\]/g, "")
                    .trim();

                // If stripping left nothing (e.g. only tags were there), try extracting from the Original Request block specifically
                if (!preview && a.inputText.includes('[ORIGINAL_REQUEST_START]')) {
                    const match = a.inputText.match(/\[ORIGINAL_REQUEST_START\]([\s\S]*?)\[ORIGINAL_REQUEST_END\]/);
                    if (match && match[1]) preview = match[1].trim();
                }

                // 2. JSON Handling
                if (preview.startsWith('[') || preview.startsWith('{')) {
                    const parsed = JSON.parse(preview);

                    if (Array.isArray(parsed)) {
                        // Join array elements (e.g. ["Project:", "Name", ...])
                        preview = parsed.map(p => typeof p === 'string' ? p : JSON.stringify(p)).join(' ');
                    } else if (typeof parsed === 'object' && parsed !== null) {
                        // Extract content from known schema or fallback to values
                        preview = parsed.introduction?.purpose?.content ||
                            parsed.introduction?.productScope?.content ||
                            parsed.projectTitle ||
                            parsed.details?.projectName?.content ||
                            // Fallback: values of the object joined
                            Object.values(parsed).filter(v => typeof v === 'string').join(' ') ||
                            "Draft analysis";
                    }
                }
            } catch (e) {
                // Parsing failed, use raw text but cleaned of some chars
            }

            // 3. Fallback for "Project:" style text
            if (preview.startsWith('Project:')) {
                const lines = preview.split('\n');
                const descIndex = lines.findIndex(l => l.startsWith('Description:'));
                if (descIndex !== -1 && lines[descIndex + 1]) {
                    preview = lines[descIndex + 1];
                } else if (lines[0]) {
                    preview = lines[0].replace('Project: ', '');
                }
            }

            return {
                ...a,
                inputPreview: preview.substring(0, 100) + (preview.length > 100 ? '...' : '')
            };
        });

        // 4. Cache Result
        if (redis) {
            try {
                await redis.set(CACHE_KEY, JSON.stringify(result), 'EX', CACHE_TTL);
            } catch (err) {
                console.warn("Redis Cache Write Error:", err.message);
            }
        }

        return result;

    } catch (error) {
        console.error("Error fetching user analyses:", error);
        throw error;
    }
};

export const getAnalysisHistory = async (userId, rootId) => {
    const history = await prisma.analysis.findMany({
        where: { userId, rootId },
        orderBy: { version: 'desc' },
        select: {
            id: true,
            createdAt: true,
            version: true,
            title: true,
            parentId: true,
            rootId: true,
            metadata: true
        }
    });
    return history;
};

export const getAnalysisById = async (userId, analysisId) => {
    const analysis = await prisma.analysis.findUnique({
        where: { id: analysisId },
    });

    if (!analysis) return null;
    if (analysis.userId !== userId) {
        const error = new Error('Unauthorized access to this analysis');
        error.statusCode = 403;
        throw error;
    }

    return analysis;
};

/**
 * Heuristic validation and AI repair for Mermaid diagrams in the SRS.
 */
async function validateAndAutoRepairDiagrams(srs, settings) {
    if (!srs.appendices?.analysisModels) return;

    const models = srs.appendices.analysisModels;
    const diagramTypes = [
        { key: 'flowchartDiagram', name: 'Flowchart' },
        { key: 'sequenceDiagram', name: 'Sequence Diagram' },
        { key: 'entityRelationshipDiagram', name: 'Entity Relationship Diagram' }
    ];

    for (const { key, name } of diagramTypes) {
        const diagram = models[key];
        if (diagram && diagram.code) {
            // Heuristic Check: Known "breaking" patterns
            let needsRepair = false;
            let heuristicError = "";

            const code = diagram.code.trim();

            if (key === 'entityRelationshipDiagram') {
                // Rule: Entities must not have colons before relationship
                if (code.includes(' : ') && code.indexOf(' : ') < code.indexOf('--')) {
                    needsRepair = true;
                    heuristicError = "Suspected invalid ERD colon placement (labels must come after relationship).";
                }
                // Rule: Relationships should have quoted labels if spaces exist
                if (code.includes(' : ') && !code.includes('"') && code.split(' : ')[1]?.includes(' ')) {
                    needsRepair = true;
                    heuristicError = "ERD labels with spaces must be double-quoted.";
                }
            }

            if (needsRepair) {
                console.log(`[Analysis Service] Auto-repairing ${name} due to: ${heuristicError}`);
                try {
                    const repaired = await repairDiagram(
                        diagram.code,
                        heuristicError,
                        settings,
                        diagram.syntaxExplanation || ""
                    );
                    if (repaired && repaired !== diagram.code) {
                        diagram.code = repaired;
                        console.log(`[Analysis Service] Successful auto-repair for ${name}`);
                    }
                } catch (err) {
                    console.warn(`[Analysis Service] Auto-repair failed for ${name}:`, err.message);
                }
            }
        }
    }
}
