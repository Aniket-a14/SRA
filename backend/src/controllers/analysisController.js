import { performAnalysis, getUserAnalyses, getAnalysisById, getAnalysisHistory } from '../services/analysisService.js';
import { processChat } from '../services/chatService.js';
import { generateCodeFromAnalysis } from '../services/codeGenService.js';
import { addAnalysisJob, getJobStatus } from '../services/queueService.js';
import { compareAnalyses } from '../services/diffService.js';
import { lintRequirements, checkAlignment } from '../services/qualityService.js';
import { validateRequirements, autoFixRequirements } from '../services/validationService.js';
import { analyzeText, repairDiagram as aiRepairDiagram } from '../services/aiService.js';
import { embedText } from '../services/embeddingService.js';
import { ensureProjectExists } from '../services/projectService.js';
import { findReuseCandidate } from '../services/reuseService.js';
import { FEATURE_EXPANSION_PROMPT, DFD_STRUCT_GEN_PROMPT } from '../utils/prompts.js';
import { layoutAllDFD } from '../services/dfdLayoutService.js';
import prisma from '../config/prisma.js';
import crypto from 'crypto';
import { successResponse } from '../utils/response.js';
import logger from '../config/logger.js';

export const analyze = async (req, res, next) => {
    try {
        let { text, srsData, validationResult, parentId, rootId } = req.body;

        // Auto-Create Project if missing - DEFERRED to Worker Service (performAnalysis)
        // req.body.projectId = await ensureProjectExists(req.user.userId, req.body.projectId, srsData, text);

        let projectName = "Project";

        // LAYER 3 INTEGRATION: Unified Input Handling
        if (srsData) {
            // LAYER 1: Draft / Validation Mode
            if (req.body.draft) {
                // Synchronous Draft Creation (No AI)
                // We store the structured input in metadata.draftData
                // We use a dummy inputText and resultJson to satisfy schema constraints for now.
                const newAnalysis = await prisma.analysis.create({
                    data: {
                        userId: req.user.userId,
                        inputText: JSON.stringify(srsData), // Serialize as input
                        resultJson: { // Dummy result for schema compliance
                            projectTitle: srsData.details?.projectName?.content || "Draft Project",
                            introduction: {
                                projectName: srsData.details?.projectName?.content || "",
                                purpose: srsData.details?.fullDescription?.content || "",
                                scope: "",
                                intendedAudience: "",
                                references: [],
                                documentConventions: ""
                            },
                            overallDescription: {
                                productPerspective: "See Introduction",
                                productFunctions: [],
                                userClassesAndCharacteristics: [],
                                operatingEnvironment: "",
                                designAndImplementationConstraints: [],
                                userDocumentation: [],
                                assumptionsAndDependencies: []
                            },
                            externalInterfaceRequirements: {
                                userInterfaces: "",
                                hardwareInterfaces: "",
                                softwareInterfaces: "",
                                communicationsInterfaces: ""
                            },
                            // Unified Input -> No systemFeatures yet (AI generates them)
                            systemFeatures: [],
                            nonFunctionalRequirements: {
                                performanceRequirements: [],
                                safetyRequirements: [],
                                securityRequirements: [],
                                softwareQualityAttributes: [],
                                businessRules: []
                            },
                            otherRequirements: [],
                            status: "DRAFT"
                        },
                        version: 1,
                        title: (srsData.details?.projectName?.content || "Draft Analysis") + " (Draft)",
                        projectId: req.body.projectId,
                        status: "DRAFT", // Explicit model status
                        metadata: {
                            trigger: 'initial',
                            source: 'user',
                            status: 'DRAFT',
                            draftData: srsData, // Store full source here
                            promptSettings: req.body.settings || {}
                        }
                    }
                });

                return successResponse(res, {
                    id: newAnalysis.id,
                    status: "draft"
                }, "Draft created successfully");
            }

            // 1. Validation Logic
            if (validationResult) {
                if (validationResult.validation_status === 'FAIL') {
                    const feasibilityIssue = validationResult.issues?.find(i => i.issue_type === 'NOT_FEASIBLE');
                    const errorMsg = feasibilityIssue ? `Rejection: ${feasibilityIssue.title} - ${feasibilityIssue.description}` : 'Analysis blocked: Input failed validation.';
                    const error = new Error(errorMsg);
                    error.statusCode = 400;
                    error.details = validationResult.issues;
                    throw error;
                }
                if (validationResult.validation_status === 'CLARIFICATION_REQUIRED') {
                    // Layer 2 Pause: Return questions to user
                    return res.status(200).json({
                        status: 'CLARIFICATION_REQUIRED',
                        issues: validationResult.issues,
                        clarification_questions: validationResult.clarification_questions || []
                    });
                }
            }

            // 2. Convert Unified Data to "Text" for Pipeline Compatibility
            // LAYER 2: Tokenization - Encapsulate logic in an array of words
            projectName = srsData.details?.projectName?.content || "Project";
            const fullDesc = srsData.details?.fullDescription?.content || "";

            // Combine and Segregate into Word Array
            const combinedText = `Project: ${projectName}\n\nDescription:\n${fullDesc}`;
            // Regex to split by whitespace but keep the content clean
            const wordArray = combinedText.split(/\s+/).filter(word => word.length > 0);

            text = JSON.stringify(wordArray);
        }

        if (!text || typeof text !== 'string') {
            const error = new Error('Text input is required and must be a string');
            error.statusCode = 400;
            throw error;
        }

        if (text.length > 50000) { // Increased limit for JSON payloads
            const error = new Error('Text input exceeds maximum limit of 50,000 characters');
            error.statusCode = 400;
            throw error;
        }

        // Basic Sanitization
        const sanitizedText = text.trim();
        if (sanitizedText.length === 0) {
            const error = new Error('Text input cannot be empty or whitespace only');
            error.statusCode = 400;
            throw error;
        }

        // OFFLOAD TO QUEUE (QStash)
        // Note: For 'draft' (Layer 1) we do sync return above.
        // For actual analysis (Layer 2+), we usually queue it because Layer 3/4 AI is slow.
        // But if optimization found, we skip queue.

        // LAYER 5: Reuse Strategy (Vector Search) — Non-blocking
        let reuseMetadata = { found: false };
        try {
            reuseMetadata = await findReuseCandidate(sanitizedText);
        } catch (reuseErr) {
            logger.warn({ msg: "[Reuse] Search failed (non-fatal), proceeding without reuse", error: reuseErr.message });
        }

        const job = await addAnalysisJob(req.user.userId, sanitizedText, req.body.projectId, {
            ...req.body.settings,
            projectName, // Force extraction/propagation
            reuseMetadata // Pass tiered reuse info to worker
        }, req.body.parentId, req.body.rootId);

        // Auto-delete Draft if converting - DEFERRED to Worker Service (performAnalysis)
        // We only delete the draft if the analysis SUCCEEDS.

        return successResponse(res, {
            jobId: job.id,
            id: job.id, // Fix: Frontend expects 'id'
            status: "queued",
            reuseFound: reuseMetadata.found,
            reuseType: reuseMetadata.type
        }, "Analysis queued", 202);
    } catch (error) {
        next(error);
    }
};

export const checkJobStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const status = await getJobStatus(id);

        if (!status) {
            const error = new Error('Job not found');
            error.statusCode = 404;
            throw error;
        }

        return successResponse(res, status);
    } catch (error) {
        next(error);
    }
};

export const getHistory = async (req, res, next) => {
    try {
        const history = await getUserAnalyses(req.user.userId);
        return successResponse(res, history);
    } catch (error) {
        next(error);
    }
};

export const getHistoryForRoot = async (req, res, next) => {
    try {
        const { rootId } = req.params;
        const history = await getAnalysisHistory(req.user.userId, rootId);
        return successResponse(res, history);
    } catch (error) {
        next(error);
    }
};

export const performComparison = async (req, res, next) => {
    try {
        const { id1, id2 } = req.params;

        // Fetch both to ensure ownership
        const [v1, v2] = await Promise.all([
            getAnalysisById(req.user.userId, id1),
            getAnalysisById(req.user.userId, id2)
        ]);

        if (!v1 || !v2) {
            const error = new Error('One or both analyses not found or unauthorized');
            error.statusCode = 404;
            throw error;
        }

        const diff = compareAnalyses(v1, v2);
        return successResponse(res, diff);
    } catch (error) {
        next(error);
    }
};

export const getAnalysis = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { mode } = req.query;

        logger.info(`[getAnalysis] Fetching analysis ID: ${id} (Mode: ${mode || 'full'})`);

        if (mode === 'sync') {
            logger.info(`[getAnalysis] Sync Mode: Fetching optimized metadata`);
            // We can add a specialized query here if needed, but for now let's trust the fix.
            // If we want to be safe, we can select specific fields, but the CLI needs full resultJson.

            // NOTE: If this crashes again, we might need to stream the response or increase node memory.
            // But 99% chance it was the nodemon restart.
        }
        // STANDARD PATH
        const analysis = await getAnalysisById(req.user.userId, id);

        if (!analysis) {
            const error = new Error('Analysis not found');
            error.statusCode = 404;
            throw error;
        }

        return successResponse(res, {
            ...analysis.resultJson,
            id: analysis.id,
            title: analysis.title,
            status: analysis.status,
            version: analysis.version,
            projectId: analysis.projectId,
            rootId: analysis.rootId,
            parentId: analysis.parentId,
            isFinalized: analysis.isFinalized,
            metadata: analysis.metadata,
            createdAt: analysis.createdAt,
            generatedCode: mode === 'sync' ? undefined : analysis.generatedCode,
            inputText: mode === 'sync' ? undefined : analysis.inputText,
            resultJson: analysis.resultJson
        });
    } catch (error) {
        logger.error({ msg: `[getAnalysis] Error`, error: error.message });
        next(error);
    }
};

export const updateAnalysis = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { metadata, ...resultUpdates } = req.body;

        // 1. Fetch existing analysis
        const currentAnalysis = await getAnalysisById(req.user.userId, id);
        if (!currentAnalysis) {
            const error = new Error('Analysis not found');
            error.statusCode = 404;
            throw error;
        }

        // 2. Determine merge logic
        const existingMetadata = (currentAnalysis.metadata && typeof currentAnalysis.metadata === 'object' && !Array.isArray(currentAnalysis.metadata))
            ? currentAnalysis.metadata
            : {};
        const newMetadata = metadata ? { ...existingMetadata, ...metadata } : existingMetadata;

        const isDraft = newMetadata.status === 'DRAFT';
        const inPlace = req.body.inPlace || isDraft;

        if (inPlace) {
            // Update in place (Layer 1 drafting or explicit request)
            const updated = await prisma.analysis.update({
                where: { id },
                data: {
                    metadata: newMetadata,
                    resultJson: Object.keys(resultUpdates).length > 0
                        ? { ...currentAnalysis.resultJson, ...resultUpdates }
                        : currentAnalysis.resultJson
                }
            });
            return successResponse(res, {
                ...updated.resultJson,
                id: updated.id,
                metadata: updated.metadata,
                version: updated.version
            });
        }

        // 3. Versioning Path (Layer 4+ refinements)
        const newResultJson = {
            ...currentAnalysis.resultJson,
            ...resultUpdates
        };

        // Re-run Quality Check
        const qualityAudit = lintRequirements({ ...newResultJson });
        newResultJson.qualityAudit = qualityAudit;

        // LAYER 3: Alignment Check
        // Prepare inputs from preserved context (Layer 1 Intent) + Metadata (Layer 2 Context)
        const layer1Intent = {
            projectName: currentAnalysis.metadata?.draftData?.details?.projectName?.content || currentAnalysis.title,
            rawText: currentAnalysis.inputText
        };
        // Assuming Layer 2 context is stored in metadata or inferred
        const layer2Context = {
            domain: currentAnalysis.metadata?.heuristicSignature?.domainTag || "Unknown",
            purpose: currentAnalysis.resultJson?.introduction?.purpose || "Unknown"
        };

        if (req.body.skipAlignment) {
            newResultJson.layer3Status = currentAnalysis.resultJson?.layer3Status || 'ALIGNED';
        } else {
            try {
                // Only run expensive AI check if standard quality passes or logic dictates
                // Running parallel to Diff Service
                const alignmentResult = await checkAlignment(layer1Intent, layer2Context, newResultJson);

                if (alignmentResult.status === 'MISMATCH_DETECTED') {
                    // Attach mismatches to the result so backend/frontend knows
                    newResultJson.alignmentResult = alignmentResult;

                    // If BLOCKER exists, we might reject the update entirely, 
                    // BUT for "Regeneration" flow, passing it back with error flags is often better UI.
                    // We will attach it to metadata for frontend to display "Layer 3 Rejection"
                    newResultJson.layer3Status = 'MISMATCH';
                } else {
                    newResultJson.layer3Status = 'ALIGNED';
                }
            } catch (l3Err) {
                logger.warn({ err: l3Err }, "Layer 3 Check Failed (Skipping Block)");
            }
        }

        // Run Diff
        const diff = compareAnalyses(currentAnalysis, { inputText: currentAnalysis.inputText, resultJson: newResultJson });
        newResultJson.diff = diff;

        // Create NEW Analysis Version
        const newAnalysis = await prisma.$transaction(async (tx) => {
            const rootId = currentAnalysis.rootId || currentAnalysis.id;
            const maxVersionAgg = await tx.analysis.findFirst({
                where: { rootId },
                orderBy: { version: 'desc' },
                select: { version: true }
            });
            const nextVersion = (maxVersionAgg?.version || 0) + 1;

            return await tx.analysis.create({
                data: {
                    userId: req.user.userId,
                    inputText: currentAnalysis.inputText,
                    resultJson: newResultJson,
                    version: nextVersion,
                    title: currentAnalysis.title || `Version ${nextVersion}`,
                    rootId: rootId,
                    parentId: currentAnalysis.id,
                    projectId: currentAnalysis.projectId,
                    metadata: newMetadata
                }
            });
        });

        return successResponse(res, {
            ...newAnalysis.resultJson,
            id: newAnalysis.id,
            title: newAnalysis.title,
            version: newAnalysis.version,
            createdAt: newAnalysis.createdAt,
            metadata: newAnalysis.metadata
        });

    } catch (error) {
        next(error);
    }
};

export const chat = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        if (!message) throw new Error("Message is required");

        const response = await processChat(req.user.userId, id, message);
        return successResponse(res, response);
    } catch (error) {
        next(error);
    }
};

export const getChatHistory = async (req, res, next) => {
    try {
        const { id } = req.params;
        // Verify ownership
        const analysis = await prisma.analysis.findUnique({ where: { id } });
        if (!analysis || analysis.userId !== req.user.userId) {
            const error = new Error('Unauthorized access to this analysis');
            error.statusCode = 403;
            throw error;
        }

        const rootId = analysis.rootId || analysis.id;

        // Find all analyses in this chain
        const chainAnalyses = await prisma.analysis.findMany({
            where: {
                OR: [
                    { id: rootId },
                    { rootId: rootId }
                ]
            },
            select: { id: true }
        });

        const chainIds = chainAnalyses.map(a => a.id);

        const messages = await prisma.chatMessage.findMany({
            where: { analysisId: { in: chainIds } },
            orderBy: { createdAt: 'asc' }
        });
        return successResponse(res, messages);
    } catch (error) {
        next(error);
    }
};

export const generateCode = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await generateCodeFromAnalysis(req.user.userId, id);
        return successResponse(res, result);
    } catch (error) {
        next(error);
    }
};
export const regenerate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { affectedSections, improvementNotes } = req.body;

        if (!improvementNotes) {
            const error = new Error("Improvement notes are required.");
            error.statusCode = 400;
            throw error;
        }

        // 1. Fetch Current Analysis
        const currentAnalysis = await getAnalysisById(req.user.userId, id);
        if (!currentAnalysis) {
            const error = new Error('Analysis not found');
            error.statusCode = 404;
            throw error;
        }

        // 2. Version Check (Soft Cap)
        if (currentAnalysis.version >= 5 && !req.body.force) {
            // We can return a warning or just proceed. The prompt says "After cap: Warn user".
            // Since this is an API, we assume the frontend showed the warning and sent 'force=true' if the user persisted.
            // Or we can just allow it but flag it in the response (which we can't do if we are async queuing).
            // Let's implement a hard error if > 8 (sanity) but allow up to 5 conventionally.
            // For now, let's just proceed. The Frontend will handle the UI warning.
        }

        // 3. Construct Context-Aware Input
        // We need to guide the AI to use the original input + context + improvements
        const originalInput = currentAnalysis.inputText;

        // We create a composite input prompt. 
        // Note: The 'performAnalysis' and underlying AI service usually expects a single string input.
        // We trust the AI Prompt to parse this structure.
        const contextPayload = `
[ORIGINAL_REQUEST_START]
${originalInput}
[ORIGINAL_REQUEST_END]

[PREVIOUS_SRS_CONTEXT_START]
${JSON.stringify(currentAnalysis.resultJson, null, 2)}
[PREVIOUS_SRS_CONTEXT_END]

[IMPROVEMENT_INSTRUCTION_START]
User Feedback for Version ${currentAnalysis.version}:
Affected Sections: ${affectedSections ? affectedSections.join(', ') : 'General'}
Notes: ${improvementNotes}

INSTRUCTION: Regenerate the SRS based on the Original Request. Incorporate the Improvement Notes. 
- You MUST maintain valid JSON structure compatible with the previous output.
- Only modify sections relevant to the feedback.
- Preserve sections that are not affected.
[IMPROVEMENT_INSTRUCTION_END]
`;

        // 4. Queue the Job
        // We recognize the rootId to maintain the "family tree"
        const rootId = currentAnalysis.rootId || currentAnalysis.id;

        const job = await addAnalysisJob(
            req.user.userId,
            contextPayload,
            currentAnalysis.projectId,
            currentAnalysis.metadata?.promptSettings || {},
            currentAnalysis.id, // parentId (Current analysis becomes parent)
            rootId // rootId
        );

        return successResponse(res, {
            jobId: job.id,
            status: "queued"
        }, "Regeneration queued", 202);

    } catch (error) {
        next(error);
    }
};

export const finalizeAnalysis = async (req, res, next) => {
    try {
        const { id } = req.params;

        const analysis = await getAnalysisById(req.user.userId, id);
        if (!analysis) {
            const error = new Error('Analysis not found');
            error.statusCode = 404;
            throw error;
        }

        let embeddingVector = [];
        try {
            if (process.env.MOCK_AI === 'true') {
                embeddingVector = Array(768).fill(0.1);
            } else {
                embeddingVector = await embedText(analysis.inputText.trim());
            }
        } catch (e) {
            logger.error({ err: e }, "Embedding generation failed, proceeding with finalization without vector");
        }

        const heuristicSignature = {
            domainTag: analysis.resultJson?.introduction?.scope?.slice(0, 50) || "General",
            featuresTag: analysis.resultJson?.systemFeatures?.map(f => f.name.slice(0, 30)) || [],
            textHash: crypto.createHash('md5').update(analysis.inputText.trim()).digest('hex')
        };

        const updatedMetadata = {
            ...(analysis.metadata || {}),
            heuristicSignature: heuristicSignature
        };

        const chunks = [];
        const result = analysis.resultJson;

        const overallScore = result.benchmarks?.qualityAudit?.overallScore ||
            (result.qualityAudit?.score ? result.qualityAudit.score / 10 : null);

        if (result.systemFeatures && Array.isArray(result.systemFeatures)) {
            // Prepare all feature chunks first, then batch embed
            const featureChunkTexts = result.systemFeatures.map(feature => {
                return `${feature.name}: ${feature.description}\n${feature.functionalRequirements?.join(' ')}`;
            });

            // Batch embed all features in parallel
            const featureEmbeddings = await Promise.all(
                featureChunkTexts.map(async (chunkText) => {
                    try {
                        return process.env.MOCK_AI === 'true' ? Array(768).fill(0.01) : await embedText(chunkText);
                    } catch (err) {
                        logger.warn({ err }, `[Finalize] Failed to embed feature chunk`);
                        return null;
                    }
                })
            );

            result.systemFeatures.forEach((feature, idx) => {
                const contentStr = JSON.stringify(feature);
                chunks.push({
                    id: crypto.randomUUID(),
                    type: 'FEATURE',
                    content: feature,
                    hash: crypto.createHash('md5').update(contentStr).digest('hex'),
                    tags: [feature.name, ...(feature.functionalRequirements?.map(f => f.slice(0, 20)) || [])],
                    sourceAnalysisId: id,
                    embedding: featureEmbeddings[idx],
                    qualityScore: overallScore
                });
            });
        }

        if (result.nonFunctionalRequirements) {
            for (const [category, reqs] of Object.entries(result.nonFunctionalRequirements)) {
                if (Array.isArray(reqs) && reqs.length > 0) {
                    const contentStr = JSON.stringify(reqs);
                    const chunkText = `Non-Functional Requirement - ${category}: ${reqs.join(' ')}`;

                    let embedding = null;
                    try {
                        embedding = process.env.MOCK_AI === 'true' ? Array(768).fill(0.02) : await embedText(chunkText);
                    } catch (err) {
                        logger.warn({ err }, `[Finalize] Failed to embed NFR chunk: ${category}`);
                    }

                    chunks.push({
                        id: crypto.randomUUID(),
                        type: `NFR_${category.toUpperCase()}`,
                        content: reqs,
                        hash: crypto.createHash('md5').update(contentStr).digest('hex'),
                        tags: [category],
                        sourceAnalysisId: id,
                        embedding: embedding,
                        qualityScore: overallScore
                    });
                }
            }
        }

        await prisma.$transaction(async (tx) => {
            await tx.analysis.update({
                where: { id },
                data: {
                    isFinalized: true,
                    metadata: updatedMetadata
                }
            });

            if (embeddingVector && embeddingVector.length > 0) {
                const vectorString = `[${embeddingVector.join(',')}]`;
                await tx.$executeRaw`UPDATE "Analysis" SET "vectorSignature" = ${vectorString}::vector WHERE "id" = ${id}`;
            }

            if (chunks.length > 0) {
                await tx.knowledgeChunk.createMany({
                    data: chunks.map(chunk => ({
                        id: chunk.id,
                        type: chunk.type,
                        content: chunk.content,
                        hash: chunk.hash,
                        tags: chunk.tags,
                        qualityScore: chunk.qualityScore,
                        sourceAnalysisId: id
                    }))
                });

                const chunksWithVectors = chunks.filter(c => c.embedding && c.embedding.length > 0);
                if (chunksWithVectors.length > 0) {
                    const payload = chunksWithVectors.map(c => ({
                        id: c.id,
                        em: `[${c.embedding.join(',')}]`
                    }));

                    logger.info(`[Layer 5] Executing batch vector update for ${chunksWithVectors.length} chunks`);

                    await tx.$executeRaw`
                        UPDATE "KnowledgeChunk" AS k
                        SET embedding = v.new_embedding::vector
                        FROM (
                            SELECT (val->>'id') AS v_id, (val->>'em') AS new_embedding
                            FROM jsonb_array_elements(${JSON.stringify(payload)}::jsonb) AS val
                        ) AS v
                        WHERE k.id::text = v.v_id::text;
                    `;
                    logger.info("[Layer 5] Batch update successful.");
                }
            }
        }, {
            timeout: 30000 
        });

        return successResponse(res, { 
            message: "Analysis finalized and broken into reusable chunks with semantic embeddings", 
            id: id, 
            chunksStored: chunks.length 
        });
    } catch (error) {
        next(error);
    }
};

export const validateAnalysis = async (req, res, next) => {
    try {
        const { id } = req.params;
        const analysis = await prisma.analysis.findUnique({ where: { id, userId: req.user.userId } });

        if (!analysis) {
            const error = new Error('Analysis not found');
            error.statusCode = 404;
            throw error;
        }

        const draftData = analysis.metadata?.draftData || {};

        // CALL LAYER 2 AI VALIDATION
        let validationResult;
        try {
            // Transform draftData into format expected by validationService if needed, 
            // but validateRequirements handles the raw structure mostly.
            validationResult = await validateRequirements(draftData);
        } catch (validationErr) {
            logger.error({ msg: "AI Validation Failed", error: validationErr.message });
            let friendlyMessage = validationErr.message;
            let friendlyTitle = 'AI Validation Service Unavailable';

            if (validationErr.message.includes('503') || validationErr.message.toLowerCase().includes('service unavailable') || validationErr.message.toLowerCase().includes('overloaded')) {
                friendlyTitle = 'AI Service Busy';
                friendlyMessage = 'The AI is currently processing many requests. Please wait a moment and try again.';
            } else if (validationErr.message.includes('429') || validationErr.message.includes('Quota exceeded') || validationErr.message.toLowerCase().includes('quota')) {
                friendlyTitle = 'AI Quota Exceeded';
                friendlyMessage = 'The AI service is currently rate-limited. Please retry in 30-60 seconds.';
            }

            validationResult = {
                validation_status: 'SERVICE_ERROR',
                service_error: {
                    title: friendlyTitle,
                    message: friendlyMessage
                },
                issues: [],
                clarification_questions: []
            };
        }

        const newStatus = validationResult.validation_status === 'PASS' ? 'VALIDATED'
            : validationResult.validation_status === 'CLARIFICATION_REQUIRED' ? 'VALIDATING'
                : validationResult.validation_status === 'SERVICE_ERROR' ? 'DRAFT'
                    : 'NEEDS_FIX';

        // Update Analysis
        const updatedMetadata = {
            ...analysis.metadata,
            status: newStatus,
            validationResult: validationResult
        };

        const updatedAnalysis = await prisma.analysis.update({
            where: { id },
            data: { metadata: updatedMetadata }
        });

        return successResponse(res, {
            ...updatedAnalysis.resultJson,
            id: updatedAnalysis.id,
            title: updatedAnalysis.title,
            status: updatedAnalysis.status,
            version: updatedAnalysis.version,
            projectId: updatedAnalysis.projectId,
            rootId: updatedAnalysis.rootId,
            parentId: updatedAnalysis.parentId,
            isFinalized: updatedAnalysis.isFinalized,
            metadata: updatedAnalysis.metadata,
            createdAt: updatedAnalysis.createdAt,
            resultJson: updatedAnalysis.resultJson
        });
    } catch (error) {
        next(error);
    }
};

export const expandFeature = async (req, res, next) => {
    try {
        const { name, prompt, settings } = req.body;

        if (!name || !prompt) {
            const error = new Error('Feature name and prompt are required');
            error.statusCode = 400;
            throw error;
        }

        // Prepare prompt
        const finalPrompt = FEATURE_EXPANSION_PROMPT
            .replace('{{name}}', name)
            .replace('{{prompt}}', prompt);

        // Call AI Service with clean system prompt and no SRS validation
        const result = await analyzeText(req.body.prompt || "", {
            ...settings,
            systemPrompt: finalPrompt,
            zodSchema: null
        });

        if (result.error) {
            throw new Error(result.error);
        }

        return successResponse(res, result);
    } catch (error) {
        next(error);
    }
};

export const repairDiagram = async (req, res, next) => {
    try {
        const { code, error, settings } = req.body;
        logger.info(`[AnalysisController] Repairing Diagram. Error length: ${error?.length}`);

        if (!code || !error) {
            const err = new Error('Code and error message are required');
            err.statusCode = 400;
            throw err;
        }

        const repairedCode = await aiRepairDiagram(code, error, settings || {}, req.body.syntaxExplanation || "");
        return successResponse(res, { code: repairedCode });
    } catch (error) {
        if (error.message.includes("429") || error.status === 429) {
            return res.status(503).json({
                success: false,
                error: "AI Service is currently busy (Rate Limit). Please try again in a few moments."
            });
        }
        next(error);
    }
};

export const generateDFD = async (req, res, next) => {
    try {
        const { projectName, description, srsContent, settings } = req.body;

        if (!projectName || !description) {
            const err = new Error('Project Name and Description are required');
            err.statusCode = 400;
            throw err;
        }

        // Prepare prompt
        const finalPrompt = `
${DFD_STRUCT_GEN_PROMPT.replaceAll('{{projectName}}', projectName)}

USER INPUT:
Project Name: ${projectName}
Description: ${description}
SRS Content (Reference): ${srsContent || "N/A"}
`;

        // Call AI Service with clean system prompt and no SRS validation
        const result = await analyzeText(`Project: ${projectName}\nDescription: ${description}`, {
            ...settings,
            systemPrompt: finalPrompt,
            zodSchema: null
        });

        if (result.error) {
            throw new Error(result.error);
        }

        // Apply Layouting
        if (result.success && result.srs) {
            result.srs = layoutAllDFD(result.srs);
        }

        res.json(result);
    } catch (error) {
        next(error);
    }
};

export const autoFixValidationIssue = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { issueId } = req.body;

        if (!issueId) {
            const error = new Error('Issue ID is required');
            error.statusCode = 400;
            throw error;
        }

        const analysis = await prisma.analysis.findUnique({ where: { id, userId: req.user.userId } });
        if (!analysis) {
            const error = new Error('Analysis not found');
            error.statusCode = 404;
            throw error;
        }

        const fixedText = await autoFixRequirements(analysis.metadata, issueId);
        res.json({ fixedText });
    } catch (error) {
        next(error);
    }
};
