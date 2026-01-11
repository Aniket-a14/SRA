import { performAnalysis, getUserAnalyses, getAnalysisById, getAnalysisHistory } from '../services/analysisService.js';
import { processChat } from '../services/chatService.js';
import { generateCodeFromAnalysis } from '../services/codeGenService.js';
import { addAnalysisJob, getJobStatus } from '../services/queueService.js';
import { compareAnalyses } from '../services/diffService.js';
import { lintRequirements, checkAlignment } from '../services/qualityService.js';
import { validateRequirements } from '../services/validationService.js';
import { analyzeText, repairDiagram as aiRepairDiagram } from '../services/aiService.js';
import { embedText } from '../services/embeddingService.js';
import { ensureProjectExists } from '../services/projectService.js';
import { findReuseCandidate } from '../services/reuseService.js';
import { FEATURE_EXPANSION_PROMPT } from '../utils/prompts.js';
import prisma from '../config/prisma.js';
import crypto from 'crypto';

export const analyze = async (req, res, next) => {
    try {
        let { text, srsData, validationResult } = req.body;



        // Auto-Create Project if missing
        // Auto-Create Project if missing
        req.body.projectId = await ensureProjectExists(req.user.userId, req.body.projectId, srsData, text);

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
                        metadata: {
                            trigger: 'initial',
                            source: 'user',
                            status: 'DRAFT',
                            draftData: srsData, // Store full source here
                            promptSettings: req.body.settings || {}
                        }
                    }
                });

                return res.status(200).json({
                    message: "Draft created successfully",
                    id: newAnalysis.id,
                    status: "draft"
                });
            }

            // 1. Validation Logic
            if (validationResult) {
                if (validationResult.validation_status === 'FAIL') {
                    const error = new Error('Analysis blocked: Input failed validation.');
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
            const projectName = srsData.details?.projectName?.content || "Project";
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

        // LAYER 5: Reuse Strategy (Vector Search)
        const reuseMetadata = await findReuseCandidate(sanitizedText);

        const job = await addAnalysisJob(req.user.userId, sanitizedText, req.body.projectId, {
            ...req.body.settings,
            reuseMetadata // Pass tiered reuse info to worker
        });

        // Auto-delete Draft if converting
        if (req.body.parentId) {
            try {
                const parent = await prisma.analysis.findUnique({ where: { id: req.body.parentId } });
                // Robust check: Status is DRAFT or it's implicitly a draft via title/metadata
                if (parent && (parent.status === 'DRAFT' || parent.metadata?.status === 'DRAFT')) {
                    console.log(`Deleting converted draft: ${parent.id}`);
                    await prisma.analysis.delete({ where: { id: parent.id } });
                }
            } catch (cleanupErr) {
                console.warn("Failed to cleanup draft:", cleanupErr.message);
            }
        }

        res.status(202).json({
            message: "Analysis queued",
            jobId: job.id,
            id: job.id, // Fix: Frontend expects 'id'
            status: "queued",
            reuseFound: reuseMetadata.found,
            reuseType: reuseMetadata.type
        });
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

        res.json(status);
    } catch (error) {
        next(error);
    }
};

export const getHistory = async (req, res, next) => {
    try {
        const history = await getUserAnalyses(req.user.userId);
        res.json(history);
    } catch (error) {
        next(error);
    }
};

export const getHistoryForRoot = async (req, res, next) => {
    try {
        const { rootId } = req.params;
        const history = await getAnalysisHistory(req.user.userId, rootId);
        res.json(history);
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
        res.json(diff);
    } catch (error) {
        next(error);
    }
};

export const getAnalysis = async (req, res, next) => {
    try {
        const { id } = req.params;
        const analysis = await getAnalysisById(req.user.userId, id);
        if (!analysis) {
            const error = new Error('Analysis not found');
            error.statusCode = 404;
            throw error;
        }
        res.json({
            ...analysis.resultJson,
            id: analysis.id,
            title: analysis.title,
            version: analysis.version,
            createdAt: analysis.createdAt,
            generatedCode: analysis.generatedCode,
            rootId: analysis.rootId,
            parentId: analysis.parentId,
            inputText: analysis.inputText,
            isFinalized: analysis.isFinalized,
            metadata: analysis.metadata
        });
    } catch (error) {
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
            return res.json({ ...updated.resultJson, id: updated.id, metadata: updated.metadata });
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
                console.warn("Layer 3 Check Failed (Skipping Block):", l3Err);
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

        res.json({
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
        res.json(response);
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
            return res.status(403).json({ error: "Unauthorized" });
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
        res.json(messages);
    } catch (error) {
        next(error);
    }
};

export const generateCode = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await generateCodeFromAnalysis(req.user.userId, id);
        res.json(result);
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

        res.status(202).json({
            message: "Regeneration queued",
            jobId: job.id,
            status: "queued"
        });

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

        // 1. Generate Signature for Knowledge Base
        // Generate real embedding for the input text
        let embeddingVector = [];
        try {
            if (process.env.MOCK_AI === 'true') {
                // Mock 768-dim vector
                embeddingVector = Array(768).fill(0.1);
            } else {
                embeddingVector = await embedText(analysis.inputText.trim());
            }
        } catch (e) {
            console.error("Embedding generation failed, proceeding with finalization without vector:", e);
            // We proceed, but vectorSignature will be null.
        }

        const heuristicSignature = {
            domainTag: analysis.resultJson?.introduction?.scope?.slice(0, 50) || "General",
            featuresTag: analysis.resultJson?.systemFeatures?.map(f => f.name.slice(0, 30)) || [],
            textHash: crypto.createHash('md5').update(analysis.inputText.trim()).digest('hex')
        };

        // 2. Update DB with Finalization
        // Store heuristic tags in metadata for keyword filtering
        const updatedMetadata = {
            ...(analysis.metadata || {}),
            heuristicSignature: heuristicSignature
        };

        // Update standard fields via Prisma Client
        await prisma.analysis.update({
            where: { id },
            data: {
                isFinalized: true,
                metadata: updatedMetadata
            }
        });

        // Update vectorSignature via Raw SQL (Prisma doesn't support writing to Unsupported columns directly)
        if (embeddingVector && embeddingVector.length > 0) {
            try {
                // Ensure vector format is like '[0.1, 0.2, ...]' string
                const vectorString = `[${embeddingVector.join(',')}]`;
                await prisma.$executeRaw`UPDATE "Analysis" SET "vectorSignature" = ${vectorString}::vector WHERE "id" = ${id}`;
            } catch (rawError) {
                console.error("Failed to update vectorSignature:", rawError);
                // Don't fail the whole request, just log it.
            }
        }

        const finalized = { id, isFinalized: true }; // Minimal response obj since we did raw update

        // 3. Shred & Store Chunks (Layer 5 Advanced Reuse)
        const chunks = [];
        const result = analysis.resultJson;

        // A. Features
        if (result.systemFeatures && Array.isArray(result.systemFeatures)) {
            result.systemFeatures.forEach(feature => {
                const contentStr = JSON.stringify(feature);
                chunks.push({
                    type: 'FEATURE',
                    content: feature,
                    hash: crypto.createHash('md5').update(contentStr).digest('hex'),
                    tags: [feature.name, ...(feature.functionalRequirements?.map(f => f.slice(0, 20)) || [])],
                    sourceAnalysisId: id
                });
            });
        }

        // B. NFRs
        if (result.nonFunctionalRequirements) {
            Object.entries(result.nonFunctionalRequirements).forEach(([category, reqs]) => {
                if (Array.isArray(reqs) && reqs.length > 0) {
                    const contentStr = JSON.stringify(reqs);
                    chunks.push({
                        type: `NFR_${category.toUpperCase()}`,
                        content: reqs, // Store the array of strings
                        hash: crypto.createHash('md5').update(contentStr).digest('hex'),
                        tags: [category],
                        sourceAnalysisId: id
                    });
                }
            });
        }

        // Batch Insert Chunks
        if (chunks.length > 0) {
            await prisma.knowledgeChunk.createMany({
                data: chunks,
                skipDuplicates: true
            });
        }

        res.json({ message: "Analysis finalized and broken into reusable chunks", id: finalized.id, chunksStored: chunks.length });
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
            console.error("AI Validation Failed:", validationErr);
            // Fallback to basic error if AI service is down
            let friendlyMessage = validationErr.message;
            let friendlyTitle = 'AI Validation Service Unavailable';

            if (validationErr.message.includes('429') || validationErr.message.includes('Quota exceeded')) {
                friendlyTitle = 'System Busy (Rate Limit)';
                friendlyMessage = 'The AI service is currently experiencing high demand. Please try again in 15-20 seconds.';
            }

            validationResult = {
                validation_status: 'FAIL',
                issues: [{
                    id: 'sys-error',
                    severity: 'critical',
                    title: friendlyTitle,
                    description: friendlyMessage,
                    message: friendlyMessage,
                    section: 'System'
                }]
            };
        }

        const newStatus = validationResult.validation_status === 'PASS' ? 'VALIDATED'
            : validationResult.validation_status === 'CLARIFICATION_REQUIRED' ? 'VALIDATING' // Still in validation phase
                : 'NEEDS_FIX';

        // Update Analysis
        const updatedMetadata = {
            ...analysis.metadata,
            status: newStatus,
            validationResult: validationResult
        };

        await prisma.analysis.update({
            where: { id },
            data: { metadata: updatedMetadata }
        });

        res.status(200).json(validationResult);

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

        // Call AI Service
        const result = await analyzeText(finalPrompt, settings || {});

        if (result.error) {
            throw new Error(result.error);
        }

        res.json(result);
    } catch (error) {
        next(error);
    }
};

export const repairDiagram = async (req, res, next) => {
    try {
        const { code, error, settings } = req.body;

        if (!code || !error) {
            const err = new Error('Code and error message are required');
            err.statusCode = 400;
            throw err;
        }

        const repairedCode = await aiRepairDiagram(code, error, settings || {});
        res.json({ code: repairedCode });
    } catch (error) {
        next(error);
    }
};
