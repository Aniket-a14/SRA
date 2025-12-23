import { performAnalysis, getUserAnalyses, getAnalysisById, getAnalysisHistory } from '../services/analysisService.js';
import { processChat } from '../services/chatService.js';
import { generateCodeFromAnalysis } from '../services/codeGenService.js';
import { addAnalysisJob, getJobStatus } from '../services/queueService.js';
import { compareAnalyses } from '../services/diffService.js';
import { lintRequirements } from '../services/qualityService.js';
import { analyzeText } from '../services/aiService.js';
import { embedText } from '../services/embeddingService.js';
import { FEATURE_EXPANSION_PROMPT } from '../utils/prompts.js';
import prisma from '../config/prisma.js';
import crypto from 'crypto';

export const analyze = async (req, res, next) => {
    try {
        let { text, srsData, validationResult } = req.body;

        // Auto-Create Project if missing
        if (!req.body.projectId) {
            console.log("Analysis started without Project ID. Auto-creating...");
            let projectName = "New Project";

            // Try to extract a meaningful name
            if (srsData?.introduction?.purpose?.content) {
                projectName = srsData.introduction.purpose.content.split('\n')[0].slice(0, 50).trim();
            } else if (text) {
                projectName = text.split('\n')[0].slice(0, 50).trim();
            }

            if (!projectName || projectName.length < 3) {
                projectName = `Project ${new Date().toLocaleDateString()}`;
            }

            const newProject = await prisma.project.create({
                data: {
                    name: projectName,
                    description: "Auto-created from analysis",
                    userId: req.user.userId
                }
            });
            console.log("Auto-created project:", newProject.id);
            req.body.projectId = newProject.id;
        }

        // LAYER 3 INTEGRATION: Structured Input Handling
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
                            projectTitle: srsData.introduction?.purpose?.content?.slice(0, 50) || "Draft Project",
                            introduction: srsData.introduction, // Store section data here too if needed for view
                            // Partially filled result
                            status: "DRAFT"
                        },
                        version: 1,
                        title: (srsData.introduction?.purpose?.content?.slice(0, 50) || "Draft Analysis") + " (Draft)",
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
            if (validationResult && validationResult.validation_status === 'FAIL') {
                const error = new Error('Analysis blocked: Input failed validation.');
                error.statusCode = 400;
                throw error;
            }

            // 2. Convert Structured Data to "Text" for Pipeline Compatibility
            // The Prompt (Layer 3) is now smart enough to detect JSON in this text.
            text = JSON.stringify(srsData, null, 2);
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
        // Generate Embedding for the input

        // LAYER 5: Reuse Strategy (Vector Search)
        // Generate Embedding for the input
        let reuseMetadata = { found: false };
        try {
            if (process.env.MOCK_AI !== 'true') {
                // Generate embedding
                const embeddingVector = await embedText(sanitizedText);

                // Search for similar analyses (cosine distance)
                // We look for finalized analyses that are NOT the current new one
                if (embeddingVector && embeddingVector.length > 0) {
                    const vectorString = `[${embeddingVector.join(',')}]`;
                    const matches = await prisma.$queryRaw`
                        SELECT id, 1 - ("vectorSignature" <=> ${vectorString}::vector) as similarity
                        FROM "Analysis"
                        WHERE "isFinalized" = true
                        AND "vectorSignature" IS NOT NULL
                        ORDER BY "vectorSignature" <=> ${vectorString}::vector ASC
                        LIMIT 1;
                     `;

                    if (matches && matches.length > 0) {
                        const match = matches[0];
                        const similarity = match.similarity;

                        if (similarity > 0.90) {
                            reuseMetadata = { found: true, id: match.id, similarity, type: 'EXACT', behavior: 'REUSE_CANDIDATE' };
                        } else if (similarity >= 0.60) {
                            reuseMetadata = { found: true, id: match.id, similarity, type: 'HIGH', behavior: 'REFERENCE' };
                        } else if (similarity >= 0.30) {
                            reuseMetadata = { found: true, id: match.id, similarity, type: 'PARTIAL', behavior: 'CONTEXT' };
                        } else if (similarity >= 0.15) {
                            reuseMetadata = { found: true, id: match.id, similarity, type: 'LOW', behavior: 'IGNORE' };
                        } else {
                            // < 15% - No effective match
                        }

                        if (reuseMetadata.found) {
                            console.log(`[Reuse] Found ${reuseMetadata.type} match: ${match.id} (Similarity: ${similarity.toFixed(4)})`);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Reuse search failed:", e.message);
        }

        const job = await addAnalysisJob(req.user.userId, sanitizedText, req.body.projectId, {
            ...req.body.settings,
            reuseMetadata // Pass tiered reuse info to worker
        });

        res.status(202).json({
            message: "Analysis queued",
            jobId: job.id,
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
        const issues = [];

        // VALIDATION LOGIC (Layer 2)
        // 1. Introduction
        if (!draftData.introduction?.purpose?.content || draftData.introduction.purpose.content.length < 20) {
            issues.push({ id: 'intro-1', severity: 'critical', message: 'Purpose is too short or missing', section: 'Introduction' });
        }

        // 2. Features
        if (!draftData.systemFeatures || Object.keys(draftData.systemFeatures).length === 0) {
            issues.push({ id: 'feat-1', severity: 'warning', message: 'No System Features defined', section: 'Features' });
        }

        // 3. Overall Description
        if (!draftData.overallDescription?.userClasses?.content || draftData.overallDescription.userClasses.content.length < 10) {
            issues.push({ id: 'user-1', severity: 'critical', message: 'User Classes and Characteristics are required', section: 'Overall Description' });
        }
        if (!draftData.overallDescription?.constraints?.content) {
            issues.push({ id: 'cons-1', severity: 'critical', message: 'Design and Implementation Constraints are required', section: 'Overall Description' });
        }
        if (!draftData.overallDescription?.userDocumentation?.content) {
            issues.push({ id: 'doc-1', severity: 'critical', message: 'User Documentation info is required', section: 'Overall Description' });
        }
        if (!draftData.overallDescription?.assumptionsDependencies?.content) {
            issues.push({ id: 'assump-1', severity: 'critical', message: 'Assumptions and Dependencies are required', section: 'Overall Description' });
        }

        // 4. External Interfaces
        if (!draftData.externalInterfaces?.userInterfaces?.content) {
            issues.push({ id: 'ext-1', severity: 'critical', message: 'User Interfaces info is required', section: 'External Interfaces' });
        }
        if (!draftData.externalInterfaces?.hardwareInterfaces?.content) {
            issues.push({ id: 'ext-2', severity: 'critical', message: 'Hardware Interfaces info is required', section: 'External Interfaces' });
        }
        if (!draftData.externalInterfaces?.softwareInterfaces?.content) {
            issues.push({ id: 'ext-3', severity: 'critical', message: 'Software Interfaces info is required', section: 'External Interfaces' });
        }
        if (!draftData.externalInterfaces?.communicationInterfaces?.content) {
            issues.push({ id: 'ext-4', severity: 'critical', message: 'Communication Interfaces info is required', section: 'External Interfaces' });
        }

        // 5. Nonfunctional Requirements
        if (!draftData.nonFunctional?.performance?.content) {
            issues.push({ id: 'nf-1', severity: 'critical', message: 'Performance requirements are required', section: 'Nonfunctional Requirements' });
        }
        if (!draftData.nonFunctional?.security?.content) {
            issues.push({ id: 'nf-2', severity: 'critical', message: 'Security requirements are required', section: 'Nonfunctional Requirements' });
        }
        if (!draftData.nonFunctional?.safety?.content) {
            issues.push({ id: 'nf-3', severity: 'critical', message: 'Safety requirements are required', section: 'Nonfunctional Requirements' });
        }
        if (!draftData.nonFunctional?.quality?.content) {
            issues.push({ id: 'nf-4', severity: 'critical', message: 'Software Quality Attributes are required', section: 'Nonfunctional Requirements' });
        }
        if (!draftData.nonFunctional?.businessRules?.content) {
            issues.push({ id: 'nf-5', severity: 'critical', message: 'Business Rules are required', section: 'Nonfunctional Requirements' });
        }

        // 6. Other Requirements
        if (!draftData.other?.appendix?.content) {
            issues.push({ id: 'other-1', severity: 'critical', message: 'Other Requirements (Appendix) info is required', section: 'Other Requirements' });
        }

        // Determine Status
        const hasCritical = issues.some(i => i.severity === 'critical');
        const newStatus = hasCritical ? 'NEEDS_FIX' : 'VALIDATED';

        // Update Analysis
        const updatedMetadata = {
            ...analysis.metadata,
            status: newStatus, // VALIDATING -> VALIDATED/NEEDS_FIX
            validationResult: { timestamp: new Date(), issues }
        };

        await prisma.analysis.update({
            where: { id },
            data: { metadata: updatedMetadata }
        });

        res.status(200).json({ status: newStatus, issues });

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
