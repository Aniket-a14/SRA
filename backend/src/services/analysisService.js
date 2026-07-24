import prisma from '../config/prisma.js';
import { getRedisClient } from '../config/redis.js';
import logger from '../config/logger.js';
import { lintRequirements, checkAlignment } from './qualityService.js';
import { extractGraph } from './knowledge/graphService.js';
import { validateAndAutoRepairDiagrams } from './pipeline/diagramRepair.js';
import { runReflectionLoop } from './pipeline/reflectionStage.js';
import { generateSrsSections } from './pipeline/developerStage.js';
import { generateFormatDoc, auditFormatDoc } from './pipeline/formatGenerator.js';
import { getFormat, isValidFormatId, DEFAULT_FORMAT_ID } from '../formats/index.js';
import { ProductOwnerAgent } from '../agents/ProductOwnerAgent.js';
import { ArchitectAgent } from '../agents/ArchitectAgent.js';
import { DeveloperAgent } from '../agents/DeveloperAgent.js';
import { ReviewerAgent } from '../agents/ReviewerAgent.js';
import { CriticAgent } from '../agents/CriticAgent.js';
import { resolveProviderKey } from './providers/providerKeyService.js';
import { publishProgress } from './progressService.js';
import { evalService } from './knowledge/evalService.js';
import { retrieveContext, formatRagContext } from './knowledge/ragService.js';
import { createReviewSnapshot } from '../utils/promptCompaction.js';
import { createCooldown } from '../utils/throttle.js';
const CACHE_TTL = 3600; // 1 hour in seconds

// Gemini free-tier rate limits (requests/minute) are the reason for these — not
// arbitrary padding. See the sectional Developer generation and reflection loop below.
const AGENT_COOLDOWN_MS = 3000; // between sectional Developer generation calls
const REFLECTION_LOOP_COOLDOWN_MS = 5000; // before the heavier Reviewer/Critic reflection pass

/** Invalidate the cached dashboard list so the UI reflects mutations immediately. */
const invalidateUserAnalysesCache = async (userId) => {
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await redis.del(`user:analyses:${userId}`);
    } catch (error) {
        logger.warn({ msg: "Non-critical: failed to invalidate user analyses cache", error: error.message, userId });
    }
};


export const performAnalysis = async (userId, text, projectId = null, parentId = null, rootId = null, settings = {}, analysisId = null) => {
    let resultJson;
    let analysisMeta = {};
    let finalIndustryAudit = null;
    let srsDraft = null; // Declare upfront to avoid ReferenceError in catch block

    // Resolve the target SRS format up front (outside the try) so it's available for the
    // final lint/persist step too. Defaults to IEEE-830 (the legacy sectional pipeline).
    const formatId = settings.format && isValidFormatId(settings.format) ? settings.format : DEFAULT_FORMAT_ID;
    const spec = getFormat(formatId);

    // Section-level progress for the SSE stream endpoint (GET /api/analysis/:id/stream) —
    // best-effort only, never lets a broadcast failure affect the actual pipeline run.
    const emitProgress = (stage, message, extra = {}) => {
        publishProgress(analysisId, { stage, message, ...extra }).catch(() => {});
    };

    // RESUME SUPPORT — load any checkpoint a prior failed run left behind so the expensive
    // completed stages (Product Owner, RAG context, Architect, Developer draft) are reused
    // instead of re-run from scratch. `persistedMeta` is the row's existing metadata bag,
    // preserved across checkpoint writes so we never clobber promptSettings/draftData/etc.
    let persistedMeta = {};
    let checkpoint = {};
    if (analysisId) {
        try {
            const existingRow = await prisma.analysis.findUnique({ where: { id: analysisId }, select: { metadata: true } });
            persistedMeta = existingRow?.metadata || {};
            checkpoint = persistedMeta.checkpoint || {};
        } catch (e) {
            logger.warn({ msg: 'Could not load checkpoint (starting fresh)', error: e.message, analysisId });
        }
    }
    const isResume = Object.keys(checkpoint).length > 0;
    if (isResume) logger.info({ msg: '[Resume] Continuing analysis from checkpoint', analysisId, stages: Object.keys(checkpoint) });
    srsDraft = checkpoint.srsDraft || null;

    /** Persist a checkpoint patch into metadata.checkpoint (best-effort; never breaks the run). */
    const saveCheckpoint = async (patch) => {
        if (!analysisId) return;
        checkpoint = { ...checkpoint, ...patch };
        try {
            await prisma.analysis.update({ where: { id: analysisId }, data: { metadata: { ...persistedMeta, checkpoint } } });
        } catch (e) {
            logger.warn({ msg: 'Checkpoint save failed (non-fatal)', error: e.message, analysisId });
        }
    };

    try {
        // Resolve the provider/model/key once for the whole pipeline — every agent in this
        // run shares one provider so a mid-pipeline mismatch (e.g. PO on Claude, Architect on
        // Gemini) can't happen. Throws early with a clear message if a non-Gemini provider
        // was selected without a configured key, rather than silently falling back to Gemini.
        const { provider, apiKey, modelName } = process.env.MOCK_AI === 'true'
            ? { provider: 'GEMINI', apiKey: null, modelName: null }
            : await resolveProviderKey(userId, settings.modelProvider, settings.modelName);
        const providerConfig = { provider, apiKey, modelName };

        // Provider-aware cooldown: the sleeps below exist only to respect Gemini free-tier
        // RPM limits. On a paid BYOK provider (or paid Gemini tier) they'd be dead latency,
        // so createCooldown no-ops for anything but free-tier Gemini. Replaces the old
        // hardcoded MOCK_AI-only sleep.
        const sleep = createCooldown(provider);

        // ORCHESTRATION START
        const poAgent = new ProductOwnerAgent(providerConfig);
        const archAgent = new ArchitectAgent(providerConfig);
        const devAgent = new DeveloperAgent(providerConfig);
        const qaAgent = new ReviewerAgent(providerConfig);
        const criticAgent = new CriticAgent(providerConfig);

        // 0.0 Fetch User Profile for Attribution
        const userProfile = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
        });
        const authorName = userProfile?.name || "User";

        // 0. Extract Project Name for Governance
        const projectName = settings.projectName || "Project";
        const promptVersion = settings.promptVersion || "latest";

        // 1. PO: Define Scope (reused on resume if already checkpointed)
        let poOutput = checkpoint.poOutput;
        if (!poOutput) {
            logger.info("--> Agent: Product Owner");
            emitProgress('product_owner', 'Refining scope and features with the Product Owner agent...');
            poOutput = await poAgent.refineIntent(text, { projectName, version: promptVersion });
            await saveCheckpoint({ poOutput });
        } else {
            logger.info("[Resume] Reusing checkpointed Product Owner output");
        }

        // 2.5 Pillar 2: Multi-Query RAG (Intelligent Recycling)
        const featureList = (poOutput?.systemFeatures || poOutput?.features || []);
        let ragContext = checkpoint.ragContext;
        if (ragContext == null) {
            logger.info("--> Pillar 2: Active Requirement Recycling (Multi-Query RAG)");
            emitProgress('rag_retrieval', 'Searching prior requirements for reusable context...');
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
            ragContext = await formatRagContext(uniqueChunks);
            await saveCheckpoint({ ragContext });
        } else {
            logger.info("[Resume] Reusing checkpointed RAG context");
        }

        // 3. Architect: Design System (Logical Sectional Approach)
        // Detailed formats (IEEE/ISO/Volere) run the architecture pass; light formats (Agile PRD)
        // skip it to stay lightweight, leaving archOutput null. Reused on resume once checkpointed.
        let archOutput = checkpoint.archOutput ?? null;
        if (spec.tier === 'detailed' && !checkpoint.archDone) {
        logger.info("--> Agent: Architect");
        emitProgress('architect', 'Designing system architecture...');

        // Generate focused search queries for components/entities/principles
        let ragContexts = {};
        try {
            const featureListShort = featureList.slice(0, 8);
            const queries = await archAgent.generateQueries(featureListShort.length ? featureListShort : [{ name: projectName }]);
            // queries.queries expected as array of 3; fall back to feature names
            const rawQueries = (queries && queries.queries) || (featureListShort.map(f => f.name || f).slice(0,3));
            const qArr = rawQueries
                .map(q => (typeof q === 'string' ? q : (q?.name || JSON.stringify(q))).trim())
                .filter(q => q.length > 0)
                .slice(0, 3);

            const fetchPromises = qArr.map((q) => retrieveContext(q, projectId, 5));
            const fetched = await Promise.all(fetchPromises);

            ragContexts = {
                components: await formatRagContext(fetched[0] || []),
                entities: await formatRagContext(fetched[1] || []),
                principles: await formatRagContext(fetched[2] || [])
            };
        } catch (e) {
            logger.warn({
                msg: "Failed to generate domain-specific RAG queries, falling back to generic context",
                error: e,
                errorMessage: e instanceof Error ? e.message : String(e),
                errorStack: e instanceof Error ? e.stack : undefined
            });
            ragContexts = { components: ragContext, entities: ragContext, principles: ragContext };
        }

        archOutput = await archAgent.designSystem(poOutput, {
                projectName,
                projectId,
                version: promptVersion,
                ragContexts // Pass domain-specific RAG contexts
            });
        await saveCheckpoint({ archOutput, archDone: true });
        }

        // --- CONTEXT MONITORING ---
        // Safeguard for Free Tier (250k TPM limit)
        const totalEstimatedTokens = await devAgent.countTokens(`PO: ${JSON.stringify(poOutput)} ARCH: ${JSON.stringify(archOutput)} RAG: ${ragContext}`);
        logger.debug(`[Analysis Service] Current orchestration state: ~${totalEstimatedTokens} tokens`);

        if (totalEstimatedTokens > 180000) {
            logger.warn("[Analysis Service] State approaching TPM ceiling (180k+). Applying aggressive pruning to RAG context.");
            // Non-essential pruning if we are hitting limits
        }

        // 3. Developer: Write initial draft.
        // IEEE-830 uses the legacy sectional path + full surgical reflection loop. Other formats
        // use the descriptor-driven generator (schema-constrained to the chosen format), with an
        // audit-only quality pass for detailed formats (the surgical loop is IEEE-shaped).
        let loopCount = 0;

        if (spec.legacyPipeline) {
            // Reuse the checkpointed draft + its sectional pieces on resume; the reflection loop
            // needs the individual sections (it refines them surgically), so both are checkpointed.
            let legacySections = checkpoint.legacySections || null;
            if (!srsDraft || !legacySections) {
                const { srsShell, allFeatures, srsRequirements, srsAppendices, srsDraft: assembledDraft } = await generateSrsSections({
                    text, poOutput, archOutput, featureList, devAgent,
                    projectName, promptVersion, ragContext, sleep, emitProgress, cooldownMs: AGENT_COOLDOWN_MS
                });
                srsDraft = assembledDraft;
                legacySections = { srsShell, allFeatures, srsRequirements, srsAppendices };
                await saveCheckpoint({ srsDraft, legacySections });
            } else {
                logger.info("[Resume] Reusing checkpointed Developer draft (legacy)");
            }

            // Repair diagrams BEFORE auditing so a minor syntax slip doesn't tank the audit.
            logger.info("--> Service: Pre-Audit Diagram Repair");
            emitProgress('diagram_repair', 'Validating and auto-repairing diagrams...');
            await validateAndAutoRepairDiagrams(srsDraft, settings);

            // 4. Pillar 1: Reflection Loop (Max 2 refinement passes)
            const reflection = await runReflectionLoop({
                text, poOutput, archOutput, projectName,
                sections: { ...legacySections, srsDraft },
                agents: { devAgent, qaAgent, criticAgent },
                sleep, emitProgress, reflectionCooldownMs: REFLECTION_LOOP_COOLDOWN_MS
            });
            srsDraft = reflection.srsDraft;
            loopCount = reflection.loopCount;
            finalIndustryAudit = reflection.finalIndustryAudit;
        } else {
            // Descriptor-driven generation for ISO 29148 / Volere / Agile PRD.
            if (!srsDraft) {
                srsDraft = await generateFormatDoc({
                    spec, text, poOutput, archOutput, devAgent,
                    projectName, promptVersion, ragContext, sleep, emitProgress, cooldownMs: AGENT_COOLDOWN_MS
                });
                await saveCheckpoint({ srsDraft });
            } else {
                logger.info("[Resume] Reusing checkpointed Developer draft (format)");
            }

            if (spec.tier === 'detailed') {
                logger.info("--> Service: Pre-Audit Diagram Repair (format)");
                emitProgress('diagram_repair', 'Validating and auto-repairing diagrams...');
                await validateAndAutoRepairDiagrams(srsDraft, settings);
                finalIndustryAudit = await auditFormatDoc({
                    spec, poOutput, doc: srsDraft,
                    agents: { qaAgent, criticAgent },
                    sleep, emitProgress, reflectionCooldownMs: REFLECTION_LOOP_COOLDOWN_MS
                });
            }
        }

        // Guarantee a benchmark object exists (light tier skips the audit).
        if (!finalIndustryAudit) {
            finalIndustryAudit = { overallScore: 0, scores: {}, criticalIssues: [], suggestions: [], skipped: true };
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
        // H3 FIX: Pass a compact review snapshot instead of the full finalSRS object.
        // The evaluator only needs high-level signals (titles, feature names, scope summary)
        // to score faithfulness — not the full 40KB+ document.
        logger.info('--> Service: RAG Evaluation');
        emitProgress('final_evaluation', 'Running final RAG faithfulness evaluation...');
        const contextString = typeof archOutput === 'string' ? archOutput : JSON.stringify(archOutput);
        const evalSnapshot = createReviewSnapshot(poOutput, finalSRS);
        const ragEval = await evalService.evaluateRAG(text, contextString, evalSnapshot);

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
            const { checkpoint: _dropped, ...restMeta } = persistedMeta || {};
            await prisma.analysis.update({
                where: { id: analysisId },
                data: {
                    status: 'COMPLETED', // Mark as completed so user can see the draft
                    resultQuality: 'PARTIAL',
                    resultJson: srsDraft,
                    // A usable draft exists — give the row a real title so it stops reading
                    // "Analysis in Progress" in the list, and drop the now-moot checkpoint.
                    title: srsDraft.projectTitle || 'Partial Analysis',
                    metadata: {
                        ...restMeta,
                        ...(analysisMeta || {}),
                        isPartial: true,
                        failureReason: error.message,
                        userFriendlyError: "Analysis finalized early due to rate limits. Global audit was skipped."
                    }
                }
            });
            await invalidateUserAnalysesCache(userId);
            emitProgress('completed', 'Analysis finalized early (partial result — audit skipped).', { terminal: true, status: 'COMPLETED', resultQuality: 'PARTIAL' });
            return; // Exit early as we've handled the record
        }

        // Standard Failure — preserve the checkpoint so the user can RESUME from the last
        // completed stage instead of restarting, and fix the title so the row no longer
        // reads "Analysis in Progress" forever in the list.
        if (analysisId) {
            const { checkpoint: _old, ...restMeta } = persistedMeta || {};
            const resumable = Object.keys(checkpoint).length > 0;
            await prisma.analysis.update({
                where: { id: analysisId },
                data: {
                    status: 'FAILED',
                    resultQuality: 'NONE',
                    title: 'Analysis failed',
                    metadata: {
                        ...restMeta,
                        ...(analysisMeta || {}),
                        checkpoint, // keep the latest checkpoint for resume
                        resumable,
                        failedStage: Object.keys(checkpoint).slice(-1)[0] || 'product_owner',
                        failureReason: error.message,
                        userFriendlyError: failureReason
                    }
                }
            });
            await invalidateUserAnalysesCache(userId);
            emitProgress('failed', failureReason, { terminal: true, status: 'FAILED', resumable });
        }
        throw new Error(failureReason);
    }

    // Run Quality Check (Linting). The IEEE linter is shape-specific (systemFeatures/NFRs);
    // other formats fall back to the Critic audit score.
    const qualityAudit = spec.legacyPipeline
        ? lintRequirements(resultJson, finalIndustryAudit)
        : { score: finalIndustryAudit?.overallScore || 0, issues: finalIndustryAudit?.criticalIssues || [] };
    resultJson = {
        ...resultJson,
        formatId: spec.id,
        formatName: spec.name,
        qualityAudit,
        promptSettings: settings // Store settings
    };

    // Update metadata with governance info
    // We assume "settings" was passed in. analysisMeta overrides it if AI service provided explicit version info.
    const finalMetadata = {
        trigger: 'initial',
        formatId: spec.id,
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
    const transactionResult = await prisma.$transaction(async (tx) => {
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

        // performAnalysis is only ever called via queueService/workerController, both of
        // which always pass analysisId — the legacy direct-creation path this used to
        // fall back to was confirmed unreachable and has been removed.
        const existing = await tx.analysis.findUnique({ where: { id: analysisId } });
        if (!existing) throw new Error("Analysis ID not found during processing");

        // We still need to calculate title if missing
        const title = resultJson.projectTitle || `Version ${existing.version}`;

        // Drop the resume checkpoint now that the run succeeded — it's dead weight on a
        // COMPLETED row (and could confuse a later re-run into thinking it can resume).
        const { checkpoint: _doneCheckpoint, ...existingMeta } = existing.metadata || {};

        const result = await tx.analysis.update({
            where: { id: analysisId },
            data: {
                resultJson,
                title,
                status: 'COMPLETED',
                isFinalized: false, // default
                projectId: finalProjectId, // Link to the (potentially new) project
                metadata: {
                    ...existingMeta,
                    ...analysisMeta, // Contains promptVersion
                    completionTime: new Date().toISOString()
                }
            }
        });

        return { result, text, finalProjectId };
    });

    if (transactionResult) {
        await invalidateUserAnalysesCache(userId);
        emitProgress('completed', 'Analysis complete.', { terminal: true, status: 'COMPLETED', resultQuality: 'FULL' });

        // Synchronize Knowledge Graph (Async)
        if (transactionResult.finalProjectId) {
            logger.info(`[Analysis Service] Triggering Graph Extraction for Project: ${transactionResult.finalProjectId}`);
            extractGraph(transactionResult.text, transactionResult.finalProjectId).catch(e => logger.error({ msg: "Async Graph Extraction failed", error: e }));
        }

        return transactionResult.result;
    }
};

/**
 * Synchronous Layer-1 DRAFT creation (no AI). The wizard stores structured input in
 * metadata.draftData and a schema-satisfying placeholder resultJson so the row is valid before
 * the pipeline ever runs. Extracted out of analysisController.analyze to keep the controller thin;
 * the controller's response shape is unchanged.
 *
 * @returns {Promise<import('../generated/prisma/index.js').Analysis>} the created draft row
 */
export const createDraftAnalysis = async (userId, srsData, projectId, settings = {}) => {
    const projectName = srsData.details?.projectName?.content || "Draft Project";
    const purpose = srsData.details?.fullDescription?.content || "";

    return prisma.analysis.create({
        data: {
            userId,
            inputText: JSON.stringify(srsData), // Serialize structured input
            resultJson: { // Schema-satisfying placeholder until the pipeline fills it in
                projectTitle: projectName,
                introduction: {
                    projectName,
                    purpose,
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
                systemFeatures: [], // AI generates these later
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
            projectId,
            status: "DRAFT", // Pipeline lifecycle status (typed column)
            metadata: {
                trigger: 'initial',
                source: 'user',
                // metadata.status tracks the finer-grained draft/validation sub-state
                // (DRAFT -> VALIDATING -> VALIDATED/NEEDS_FIX) the frontend wizard keys its
                // step-unlock logic on — a distinct axis from the pipeline lifecycle above.
                status: 'DRAFT',
                draftData: srsData, // Full source input
                promptSettings: settings || {}
            }
        }
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
                "resultQuality",
                "rootId",
                "parentId",
                metadata
            FROM "Analysis"
            WHERE "userId" = ${userId}
            -- DRAFT rows are pre-pipeline (Layer 1 wizard state, not a real analysis yet).
            -- FAILED rows now DO stick in the list — the user needs to see them and resume
            -- from the last checkpoint rather than have them silently disappear.
            AND status != 'DRAFT'
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

            // Strip the (potentially large) resume checkpoint from the list payload — the
            // dashboard only needs a lightweight `resumable` flag + failure reason, not the
            // full checkpointed draft. The checkpoint stays in the DB row for the resume run.
            const { checkpoint: _omit, ...slimMeta } = a.metadata || {};

            return {
                ...a,
                metadata: slimMeta,
                status: a.status,
                resultQuality: a.resultQuality,
                resumable: Boolean(a.metadata?.resumable),
                failureReason: a.metadata?.userFriendlyError || a.metadata?.failureReason || null,
                inputPreview: preview.substring(0, 100) + (preview.length > 100 ? '...' : '')
            };
        });

        // 4. Cache Result
        if (redis) {
            try {
                await redis.set(CACHE_KEY, JSON.stringify(result), 'EX', CACHE_TTL);
            } catch (err) {
                logger.warn({ msg: "Redis Cache Write Error", error: err.message });
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

// A finalized analysis has been shredded into KnowledgeChunk rows (see finalizeAnalysis
// in analysisController.js) whose sourceAnalysisId FK is ON DELETE RESTRICT — deleting
// it would either hard-fail with a Postgres FK violation or, if we ever relax that
// constraint, silently destroy reuse knowledge other projects depend on. Block it with
// a clear error instead of either outcome.
const assertNotFinalized = (analysis) => {
    if (analysis.isFinalized) {
        const error = new Error('Cannot delete a finalized analysis — it has been converted into reusable knowledge chunks.');
        error.statusCode = 409;
        throw error;
    }
};

export const deleteAnalysis = async (userId, analysisId, { chain = false } = {}) => {
    const analysis = await getAnalysisById(userId, analysisId); // 404/403 handled inside

    if (!analysis) {
        const error = new Error('Analysis not found');
        error.statusCode = 404;
        throw error;
    }

    if (!chain) {
        assertNotFinalized(analysis);

        const childCount = await prisma.analysis.count({ where: { parentId: analysisId } });
        if (childCount > 0) {
            const error = new Error('Cannot delete a version with other versions depending on it. Pass chain=true to delete the entire history, or delete descendant versions first.');
            error.statusCode = 400;
            throw error;
        }

        await prisma.analysis.delete({ where: { id: analysisId } });
        await invalidateUserAnalysesCache(userId);
        return { deletedCount: 1, mode: 'leaf' };
    }

    // Chain delete: the whole rootId lineage in one shot.
    const rootId = analysis.rootId || analysis.id;
    const chainAnalyses = await prisma.analysis.findMany({
        where: { userId, OR: [{ id: rootId }, { rootId }] },
        select: { id: true, isFinalized: true }
    });

    if (chainAnalyses.some(a => a.isFinalized)) {
        const error = new Error('Cannot delete this history — one or more versions have been finalized into reusable knowledge chunks.');
        error.statusCode = 409;
        throw error;
    }

    const { count } = await prisma.analysis.deleteMany({
        where: { userId, OR: [{ id: rootId }, { rootId }] }
    });
    await invalidateUserAnalysesCache(userId);
    return { deletedCount: count, mode: 'chain' };
};

export const getLatestAnalysisByProjectId = async (projectId) => {
    return await prisma.analysis.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' }
    });
};
