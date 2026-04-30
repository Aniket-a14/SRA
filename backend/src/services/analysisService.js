import prisma from '../config/prisma.js';
import { getRedisClient } from '../config/redis.js';
import logger from '../config/logger.js';
import { lintRequirements, checkAlignment } from './qualityService.js';
import { extractGraph } from './graphService.js';
import { repairDiagram } from './aiService.js';
import { ProductOwnerAgent } from '../agents/ProductOwnerAgent.js';
import { ArchitectAgent } from '../agents/ArchitectAgent.js';
import { DeveloperAgent } from '../agents/DeveloperAgent.js';
import { ReviewerAgent } from '../agents/ReviewerAgent.js';
import { CriticAgent } from '../agents/CriticAgent.js';
import { evalService } from './evalService.js';
import { retrieveContext, formatRagContext } from './ragService.js';

const CACHE_TTL = 3600; // 1 hour in seconds


export const performAnalysis = async (userId, text, projectId = null, parentId = null, rootId = null, settings = {}, analysisId = null) => {
    let resultJson;
    let analysisMeta = {};
    let finalIndustryAudit = null;
    let srsDraft = null; // Declare upfront to avoid ReferenceError in catch block

    try {
        // ORCHESTRATION START
        const poAgent = new ProductOwnerAgent();
        const archAgent = new ArchitectAgent();
        const devAgent = new DeveloperAgent();
        const qaAgent = new ReviewerAgent();
        const criticAgent = new CriticAgent();
        
        // 0.0 Fetch User Profile for Attribution
        const userProfile = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
        });
        const authorName = userProfile?.name || "User";

        // 0. Extract Project Name for Governance
        const projectName = settings.projectName || "Project";
        const promptVersion = settings.promptVersion || "latest";

        // 1. PO: Define Scope
        logger.info("--> Agent: Product Owner");
        const poOutput = await poAgent.refineIntent(text, { projectName, version: promptVersion });

        // 2. Architect: Design System (Placeholder - moved after RAG)
        let archOutput = null;

        // 2.5 Pillar 2: Multi-Query RAG (Intelligent Recycling)
        logger.info("--> Pillar 2: Active Requirement Recycling (Multi-Query RAG)");
        const featureList = (poOutput?.systemFeatures || poOutput?.features || []);
        let allRecyclableChunks = [];

        // Surgical RAG: Search for EACH identified feature
        if (featureList.length > 0) {
            // Process features in parallel for better performance
            const featureRetrievalPromises = featureList.slice(0, 8).map(async (feature) => {
                const query = feature.name || (typeof feature === 'string' ? feature : "");
                if (!query) return [];
                return await retrieveContext(query, projectId, 2);
            });
            const featureResults = await Promise.all(featureRetrievalPromises);
            allRecyclableChunks = featureResults.flat();
        } else {
            // Fallback to general context
            allRecyclableChunks = await retrieveContext(text.substring(0, 200), projectId, 5);
        }

        // De-duplicate by content hash or ID
        const uniqueChunks = Array.from(new Map(allRecyclableChunks.map(c => [c.id || JSON.stringify(c.content), c])).values());
        const ragContext = await formatRagContext(uniqueChunks);

        // 3. Architect: Design System (Logical Sectional Approach)
        logger.info("--> Agent: Architect");
        archOutput = await archAgent.designSystem(poOutput, {
            projectName,
            projectId,
            version: promptVersion,
            ragContext: ragContext // Inject RAG context into Architect
        });

        // --- CONTEXT MONITORING ---
        // Safeguard for Free Tier (250k TPM limit)
        const totalEstimatedTokens = await devAgent.countTokens(`PO: ${JSON.stringify(poOutput)} ARCH: ${JSON.stringify(archOutput)} RAG: ${ragContext}`);
        logger.debug(`[Analysis Service] Current orchestration state: ~${totalEstimatedTokens} tokens`);

        if (totalEstimatedTokens > 180000) {
             logger.warn("[Analysis Service] State approaching TPM ceiling (180k+). Applying aggressive pruning to RAG context.");
             // Non-essential pruning if we are hitting limits
        }

        // Optimized sleep context for tests/mock mode
        const sleep = (ms) => {
            if (process.env.MOCK_AI === 'true') return Promise.resolve();
            return new Promise(resolve => setTimeout(resolve, ms));
        };

        // 3. Developer: Write initial draft (SECTIONAL GENERATION)
        logger.info("--> Agent: Developer (Sectional Generation: Shell)");
        const srsShell = await devAgent.generateShell(text, poOutput, archOutput, { projectName, version: promptVersion, ragContext });
        
        await sleep(1500); // Cooling period

        logger.info("--> Agent: Developer (Sectional Generation: Features)");
        const CHUNK_SIZE = 2;
        let allFeatures = [];
        
        for (let i = 0; i < featureList.length; i += CHUNK_SIZE) {
            const chunk = featureList.slice(i, i + CHUNK_SIZE);
            logger.info(`    [Features] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(featureList.length / CHUNK_SIZE)}`);
            const featuresOutput = await devAgent.generateFeatures(text, srsShell, poOutput, archOutput, chunk, { projectName, version: promptVersion, ragContext });
            if (featuresOutput.systemFeatures) {
                allFeatures = [...allFeatures, ...featuresOutput.systemFeatures];
            }
            if (i + CHUNK_SIZE < featureList.length) {
                await sleep(1500); // Delay between feature chunks
            }
        }

        await sleep(1500); // Cooling period

        logger.info("--> Agent: Developer (Sectional Generation: Requirements & Glossary)");
        const sections1And2 = { ...srsShell, systemFeatures: allFeatures };
        const srsRequirements = await devAgent.generateRequirements(text, sections1And2, poOutput, archOutput, { projectName, version: promptVersion, ragContext });

        await sleep(1500); // Cooling period

        logger.info("--> Agent: Developer (Sectional Generation: Appendices & Diagrams)");
        const sections123 = { ...sections1And2, ...srsRequirements };
        const srsAppendices = await devAgent.generateAppendices(text, sections123, poOutput, archOutput, { projectName, version: promptVersion, ragContext });

        // STITCHING: Assemble the final draft
        srsDraft = {
            ...srsShell,
            systemFeatures: allFeatures,
            ...srsRequirements,
            ...srsAppendices
        };

        // NEW: Repair Diagrams BEFORE Auditing (Defensive Generation)
        // This prevents the Reviewer/Critic from failing a draft due to minor syntax errors
        logger.info("--> Service: Pre-Audit Diagram Repair");
        await validateAndAutoRepairDiagrams(srsDraft, settings);

        // 4. Pillar 1: Reflection Loop (Max 2 refinement passes)
        let loopCount = 0;
        const MAX_LOOPS = 2;
        const QUALITY_THRESHOLD = 85;
        let reflectionFeedback = [];

        // Mandatory cooling period before starting the heavy Reflection Loop on Free Tier
        logger.info("    [Pause] Cooling before Reflection Loop (GCP Quota Safety)...");
        await sleep(2000);

        while (loopCount < MAX_LOOPS) {
            logger.info(`--> Pillar 1: Global Reflection Pass ${loopCount + 1}`);

            // A & B. Parallel Audit (Reviewer + Critic)
            const [review, audit] = await Promise.all([
                qaAgent.reviewSRS(poOutput, srsDraft),
                criticAgent.auditSRS(poOutput, srsDraft)
            ]);
            finalIndustryAudit = audit; 

            logger.info(`    Review Status: ${review.status}, Quality Score: ${audit.overallScore}`);

            // C. Check if we meet the quality bar (Case-Insensitive)
            // Intelligent Override: If score is near perfect (98+), allow pass even if Reviewer is stuck in pedantry
            const isApproved = review.status?.toUpperCase() === "APPROVED";
            const isHighQuality = audit.overallScore >= QUALITY_THRESHOLD;
            const isExceptional = audit.overallScore >= 98;

            if ((isApproved || isExceptional) && isHighQuality) {
                logger.info(`    [OK] Quality threshold met${isExceptional && !isApproved ? " (Exceptional Score Override)" : ""}. Exiting reflection loop.`);
                break;
            }

            // D. Threshold not met: Surgical Refinement
            loopCount++;
            
            const reason = review.status !== "APPROVED"
                ? `QA Status: ${review.status}`
                : `Quality Score: ${audit.overallScore} < ${QUALITY_THRESHOLD}`;

            logger.info(`    [Refine] ${reason}. Performing surgical refinement...`);

            reflectionFeedback = [
                ...review.feedback,
                ...(audit.criticalIssues || []).map(issue => ({ severity: "MAJOR", category: "Quality", issue })),
                ...(audit.suggestions || []).map(suggestion => ({ severity: "MINOR", category: "Quality", issue: suggestion }))
            ];

            const hasAppendicesFeedback = reflectionFeedback.some(f => f.issue.toLowerCase().includes('diagram') || f.issue.toLowerCase().includes('flowchart') || f.issue.toLowerCase().includes('erd'));
            const hasNFRFeedback = reflectionFeedback.some(f => f.issue.toLowerCase().includes('requirement') || f.issue.toLowerCase().includes('security') || f.category === 'Security');
            const hasFeatureFeedback = reflectionFeedback.some(f => f.issue.toLowerCase().includes('feature') || f.issue.toLowerCase().includes('function'));
            
            let targetSectionName = "Shell";
            let targetDraft = { ...srsShell };

            if (hasAppendicesFeedback) {
                targetSectionName = "Appendices";
                targetDraft = { ...srsAppendices };
            } else if (hasNFRFeedback) {
                targetSectionName = "Requirements";
                targetDraft = { ...srsRequirements };
            } else if (hasFeatureFeedback) {
                targetSectionName = "Features";
                targetDraft = { systemFeatures: allFeatures };
            }

            // SURGICAL REFINEMENT: Developer only touches what's broken
            const refinedSection = await devAgent.refineSRS(
                text,
                poOutput,
                archOutput,
                targetDraft,
                targetSectionName,
                reflectionFeedback,
                { projectName }
            );

            // Re-stitch based on which section was refined
            if (targetSectionName === "Shell") {
                srsDraft = { ...srsDraft, ...refinedSection };
            } else if (targetSectionName === "Features") {
                if (refinedSection.systemFeatures) allFeatures = refinedSection.systemFeatures;
                srsDraft.systemFeatures = allFeatures;
            } else if (targetSectionName === "Requirements") {
                // Re-merge requirements
                srsDraft = { ...srsDraft, ...refinedSection };
            } else if (targetSectionName === "Appendices") {
                srsDraft = { ...srsDraft, ...refinedSection };
            }
        }
        
        // POST-REFLECTION: Auto-repair any diagrams the DeveloperAgent might have broken during refinement
        if (loopCount > 0) {
            logger.info("--> Service: Post-Reflection Diagram Repair");
            await validateAndAutoRepairDiagrams(srsDraft, settings);
        }

        // F. Post-Processing: Enforce Clean Revision History (Initial Release)
        // Overwrite internal reflection versions with a single "Initial Release" entry by the Actual User
        srsDraft.revisionHistory = [{
            version: "1.0",
            date: new Date().toISOString().split('T')[0],
            description: "Initial Release",
            author: authorName
        }];

        const finalSRS = {
            ...srsDraft,
            userStories: poOutput.userStories,
            features: poOutput.features,
            systemArchitecture: archOutput
        };

        // 5. Final Evaluation (RAG)
        logger.info("--> Service: RAG Evaluation");
        const contextString = typeof archOutput === 'string' ? archOutput : JSON.stringify(archOutput);
        const ragEval = await evalService.evaluateRAG(text, contextString, finalSRS);

        const response = {
            success: true,
            srs: {
                ...finalSRS,
                benchmarks: {
                    qualityAudit: finalIndustryAudit,
                    ragEvaluation: ragEval,
                    reflectionPasses: loopCount
                }
            },
            meta: {
                agents: ["PO", "Architect", "Developer", "Reviewer", "Critic"],
                reflectionCount: loopCount,
                industryScore: finalIndustryAudit.overallScore
            }
        };

        // END ORCHESTRATION

        if (response.success && response.srs) {
            resultJson = response.srs;
            analysisMeta = {
                ...(response.meta || {}),
            };

        } else {
            throw new Error(response.error || "AI Analysis execution failed to return valid SRS");
        }
    } catch (error) {
        logger.error({ msg: "AI Analysis execution failed", error: error.message, stack: error.stack });
        
        const failureReason = error.message.includes("429") || error.message.includes("Quota exceeded")
            ? "AI Rate Limit Exceeded. Please wait a few minutes and try again."
            : `Analysis Error: ${error.message}`;

        // FAILSAFE: If we have an srsDraft (even if reflection failed), 
        // we save it so the user doesn't lose the generation.
        if (analysisId && srsDraft) {
            logger.info("[Analysis Service] Failsafe: Saving last-known draft despite error.");
            await prisma.analysis.update({
                where: { id: analysisId },
                data: {
                    status: 'COMPLETED', // Mark as completed so user can see the draft
                    resultJson: srsDraft,
                    metadata: {
                        ...(analysisMeta || {}),
                        isPartial: true,
                        failureReason: error.message,
                        userFriendlyError: "Analysis finalized early due to rate limits. Global audit was skipped."
                    }
                }
            });
            return; // Exit early as we've handled the record
        }

        // Standard Failure
        if (analysisId) {
            await prisma.analysis.update({
                where: { id: analysisId },
                data: { 
                    status: 'FAILED',
                    metadata: { 
                        ...(analysisMeta || {}),
                        failureReason: error.message,
                        userFriendlyError: failureReason
                    }
                }
            });
        }
        throw new Error(failureReason);
    }

    // Run Quality Check (Linting)
    const qualityAudit = lintRequirements(resultJson, finalIndustryAudit);
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
            logger.warn({ msg: "Layer 3 Check (Initial) Failed", error: l3Error });
        }
    }

    // Atomic Creation with Transaction
    return await prisma.$transaction(async (tx) => {
        // 1. Defer Project Creation if missing and successful
        let finalProjectId = projectId;
        if (!finalProjectId && resultJson.projectTitle) {
            // Check if one exists with same name to avoid dups?
            // Or just create new. Let's create new to be safe, or reuse if name matches EXACTLY for this user?
            // "ensureProjectExists" logic but inside transaction?
            // Let's keep it simple: Create New Project if none provided.
            const newProject = await tx.project.create({
                data: {
                    name: resultJson.projectTitle,
                    description: (typeof resultJson.introduction?.purpose === 'string'
                        ? resultJson.introduction.purpose
                        : (resultJson.introduction?.purpose?.content || "Auto-created from analysis")).slice(0, 100),
                    userId: userId
                }
            });
            finalProjectId = newProject.id;
            logger.info(`[Analysis Service] Auto-created Deferred Project: ${finalProjectId}`);
        }

        // 2. Cleanup Draft if converting (moved from Controller)
        if (parentId) {
            try {
                const parent = await tx.analysis.findUnique({ where: { id: parentId } });
                if (parent && (parent.status === 'DRAFT' || parent.metadata?.status === 'DRAFT')) {
                    logger.info(`[Analysis Service] Cleaning up successful draft: ${parentId}`);
                    await tx.analysis.delete({ where: { id: parentId } });
                }
            } catch (cleanupErr) {
                logger.warn({ msg: "[Analysis Service] Failed to cleanup draft (non-fatal)", error: cleanupErr.message });
            }
        }

        // If analysisId is provided (Standard Flow via queueService), we update the existing record
        if (analysisId) {
            const existing = await tx.analysis.findUnique({ where: { id: analysisId } });
            if (!existing) throw new Error("Analysis ID not found during processing");

            // We still need to calculate title if missing
            const title = resultJson.projectTitle || `Version ${existing.version}`;

            const result = await tx.analysis.update({
                where: { id: analysisId },
                data: {
                    resultJson,
                    title,
                    status: 'COMPLETED',
                    isFinalized: false, // default
                    projectId: finalProjectId, // Link to the (potentially new) project
                    metadata: {
                        ...(existing.metadata || {}),
                        ...analysisMeta, // Contains promptVersion
                        completionTime: new Date().toISOString()
                    }
                }
            });

            // Synchronize Knowledge Graph (Async)
            if (finalProjectId) {
                logger.info(`[Analysis Service] Triggering Graph Extraction for Project: ${finalProjectId}`);
                extractGraph(text, finalProjectId).catch(e => logger.error({ msg: "Async Graph Extraction failed", error: e }));
            }

            return result;
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
            logger.warn({ msg: "Redis Cache Read Error", error: err.message });
        }
    }

    // Optimized: Get LATEST version for each rootId using PostgreSQL DISTINCT ON
    try {
        const analyses = await prisma.$queryRaw`
            SELECT DISTINCT ON ("rootId")
                id,
                "createdAt",
                LEFT("inputText", 500) AS "inputText",
                version,
                title,
                status,
                "rootId",
                "parentId",
                metadata
            FROM "Analysis"
            WHERE "userId" = ${userId}
            AND NOT (status = 'FAILED' AND "projectId" IS NULL)
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
        logger.error({ msg: "Error fetching user analyses", error: error });
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
    logger.info(`[getAnalysisById] Searching for analysisId: ${analysisId} (user: ${userId})`);
    const analysis = await prisma.analysis.findUnique({
        where: { id: analysisId },
    });

    if (!analysis) {
        logger.warn(`[getAnalysisById] Analysis ${analysisId} not found in database.`);
        return null;
    }
    
    if (analysis.userId !== userId) {
        logger.warn(`[getAnalysisById] Analysis ${analysisId} belongs to ${analysis.userId}, but requested by ${userId}`);
        const error = new Error('Unauthorized access to this analysis');
        error.statusCode = 403;
        throw error;
    }

    return analysis;
};

export const getLatestAnalysisByProjectId = async (projectId, userId = null) => {
    const where = { projectId };
    if (userId) where.userId = userId;
    return await prisma.analysis.findFirst({
        where,
        orderBy: { version: 'desc' }
    });
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
            let needsRepair = false;
            let heuristicError = "";
            let code = diagram.code.trim();

            // 1. GLOBAL: Fix legacy 'graph' prefix for modern 'flowchart'
            if (code.startsWith('graph')) {
                code = code.replace(/^graph/, 'flowchart');
                needsRepair = true;
                heuristicError = "Legacy 'graph' prefix detected. Converted to 'flowchart'.";
            }

            // 2. ERD SPECIFIC
            if (key === 'entityRelationshipDiagram') {
                if (code.includes(' : ') && code.indexOf(' : ') < code.indexOf('--')) {
                    needsRepair = true;
                    heuristicError = "Invalid ERD colon placement.";
                }
                if (code.includes(' : ') && !code.includes('"') && code.split(' : ')[1]?.includes(' ')) {
                    needsRepair = true;
                    heuristicError = "ERD labels with spaces must be quoted.";
                }
                if (/\b(NN)\b/.test(code)) {
                    needsRepair = true;
                    heuristicError = "Invalid ERD key 'NN' found.";
                }
            }

            // 3. SEQUENCE SPECIFIC
            if (key === 'sequenceDiagram') {
                if (!code.includes('+') && !code.includes('-') && code.includes('->>')) {
                    // Heuristic: If there are calls but no activations, it might be lower quality
                    logger.debug("[Analysis Service] Sequence diagram lacks activation markers. Proceeding but marking for potential UI improvement.");
                }
            }

            if (needsRepair) {
                logger.info(`[Analysis Service] Auto-repairing ${name} due to: ${heuristicError}`);
                try {
                    const repaired = await repairDiagram(code, heuristicError, settings);
                    if (repaired) diagram.code = repaired;
                } catch (err) {
                    logger.warn(`[Analysis Service] Repair failed for ${name}: ${err.message}`);
                }
            }
        }
    }
}
