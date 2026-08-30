import { ChatAgent } from '../agents/ChatAgent.js';
import prisma from '../config/prisma.js';
import { createChatSnapshot } from '../utils/promptCompaction.js';
import { createNextVersion } from './versioning.js';
import { resolveProviderKey } from './providers/providerKeyService.js';
import { DEFAULT_MODELS } from './providers/index.js';
import logger from '../config/logger.js';

/**
 * Resolve the provider/model/key for a chat turn from the analysis's stored prompt
 * settings. Chat edits generate new SRS versions, so they run on the user's own key
 * exactly like the main pipeline — never the platform key. No-ops under MOCK_AI.
 */
async function resolveChatProvider(userId, currentAnalysis) {
    if (process.env.MOCK_AI === 'true') return {};
    const settings = currentAnalysis?.metadata?.promptSettings || {};
    const resolved = await resolveProviderKey(userId, settings.modelProvider, settings.modelName);
    // userId/allowModelFallback/fallbackModels were previously dropped here, which silently
    // broke quota attribution (recordUsage/recordExhausted no-op on a falsy userId) and made
    // fallback impossible for chat calls (selectNextFallbackModel requires userId).
    return { ...resolved, userId, allowModelFallback: settings.allowModelFallback === true, fallbackModels: settings.fallbackModels };
}

// Same heuristic-keyword-branching philosophy already used in analysisService.js's
// reflection loop (hasAppendicesFeedback/hasNFRFeedback/hasFeatureFeedback) — cheap,
// local, no extra AI call just to decide whether an AI call is worth making. False
// positives just cost one extra (parallel, non-blocking) JSON call; false negatives
// mean a genuine edit request gets answered conversationally without being applied,
// which the user will immediately notice and can rephrase.
const EDIT_INTENT_PATTERN = /\b(add|remove|delete|rename|change|update|modify|replace|include|insert|revise|rewrite|adjust|expand|shorten|reword)\b/i;

export const looksLikeEditRequest = (message) => EDIT_INTENT_PATTERN.test(message);

/**
 * Shared setup for a chat turn: ownership check, dedup lookup, rolling history,
 * and the compact SRS snapshot. Returns `{ dedupedReply }` instead of proceeding
 * further when this exact send was already processed.
 */
async function loadChatContext(userId, analysisId, clientMessageId) {
    const currentAnalysis = await prisma.analysis.findFirst({ where: { id: analysisId, userId } });

    if (!currentAnalysis) throw new Error('Analysis not found or unauthorized');

    // Dedup: if this exact send was already processed (double-click, retried fetch,
    // browser back/forward replaying the request), return the stored reply instead
    // of re-invoking the AI and creating a duplicate turn.
    if (clientMessageId) {
        const existingTurn = await prisma.chatMessage.findUnique({ where: { clientMessageId } });
        if (existingTurn) {
            const existingReply = await prisma.chatMessage.findFirst({
                where: { analysisId: existingTurn.analysisId, role: 'assistant', createdAt: { gte: existingTurn.createdAt } },
                orderBy: { createdAt: 'asc' }
            });
            return { dedupedReply: { reply: existingReply?.content || '', newAnalysisId: null } };
        }
    }

    const rootId = currentAnalysis.rootId || currentAnalysis.id;
    const chainAnalyses = await prisma.analysis.findMany({
        where: { OR: [{ id: rootId }, { rootId: rootId }] },
        select: { id: true }
    });
    const chainIds = chainAnalyses.map(a => a.id);

    const history = await prisma.chatMessage.findMany({
        where: { analysisId: { in: chainIds } },
        orderBy: { createdAt: 'asc' },
        take: 20 // last 20 messages for rolling context window
    });
    const historyText = history.map(msg => `${msg.role}: ${msg.content}`).join('\n');

    // Compact SRS snapshot — avoids serialising the full 50KB+ resultJson into every
    // chat turn. createChatSnapshot targets ~6-8K tokens max.
    const srsSnapshot = createChatSnapshot(currentAnalysis.resultJson || {});

    return { currentAnalysis, historyText, srsSnapshot };
}

/** Configured default Gemini model, or null when none is set (mock/test runs). */
function configuredGeminiModel() {
    try {
        return DEFAULT_MODELS.GEMINI;
    } catch {
        return null;
    }
}

/**
 * Persists the turn (dedup-safe) and, if an edit was produced, creates a new
 * versioned analysis record. Shared tail end of both processChat and processChatStream.
 */
import { getRedisClient } from '../config/redis.js';
import { publishProgress } from './progressService.js';

/**
 * Acquire distributed single-flight mutex for chat turns
 */
export async function acquireChatLock(clientMessageId) {
    if (!clientMessageId) return null;
    const redis = getRedisClient();
    if (!redis) return null;
    try {
        const lockKey = `lock:chat:${clientMessageId}`;
        const acquired = await redis.set(lockKey, 'in_flight', 'PX', 45000, 'NX');
        return acquired ? lockKey : null;
    } catch {
        return null;
    }
}

export async function releaseChatLock(lockKey) {
    if (!lockKey) return;
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await redis.del(lockKey);
    } catch (_err) {
        // Ignore lock release error on teardown
    }
}

/**
 * Persists the user message immediately upon turn arrival before AI invocation.
 */
async function persistUserMessage(userId, analysisId, userMessage, clientMessageId) {
    if (clientMessageId) {
        return await prisma.chatMessage.upsert({
            where: { clientMessageId },
            create: { analysisId, userId, role: 'user', content: userMessage, clientMessageId },
            update: {}
        });
    }
    return await prisma.chatMessage.create({
        data: { analysisId, userId, role: 'user', content: userMessage }
    });
}

/**
 * Persists the assistant reply and, if an edit was produced, creates a new
 * versioned analysis record. Emits real-time progress to synchronize all devices.
 */
async function finalizeChatTurn(userId, currentAnalysis, userMessage, clientMessageId, replyText, updatedAnalysis) {
    // User message was already created up front; create assistant reply
    await prisma.chatMessage.create({
        data: { analysisId: currentAnalysis.id, userId, role: 'assistant', content: replyText }
    });

    let newAnalysisId = null;

    if (updatedAnalysis) {
        const effectiveRootId = currentAnalysis.rootId || currentAnalysis.id;

        await prisma.$transaction(async (tx) => {
            const newAnalysis = await createNextVersion(tx, effectiveRootId, (version) => ({
                userId,
                inputText: currentAnalysis.inputText,
                resultJson: updatedAnalysis,
                version,
                title: updatedAnalysis.projectTitle || `Version ${version}`,
                rootId: effectiveRootId,
                parentId: currentAnalysis.id,
                metadata: {
                    trigger: 'chat',
                    source: 'ai',
                    promptSettings: {
                        ...(currentAnalysis.metadata?.promptSettings || {}),
                        modelName: currentAnalysis.metadata?.promptSettings?.modelName
                            || configuredGeminiModel(),
                        modelProvider: currentAnalysis.metadata?.promptSettings?.modelProvider || 'google'
                    }
                }
            }));
            newAnalysisId = newAnalysis.id;
        });

        logger.info(`[Chat Service] Created new analysis version ${newAnalysisId} from chat edit.`);
    }

    // Broadcast real-time event for any open tabs / devices
    await publishProgress(currentAnalysis.id, {
        stage: 'chat_completed',
        newAnalysisId,
        replyPreview: replyText.slice(0, 100)
    });

    return newAnalysisId;
}

/**
 * Processes a single chat turn for an analysis session.
 */
export async function processChat(userId, analysisId, userMessage, clientMessageId = null) {
    const lockKey = await acquireChatLock(clientMessageId);
    try {
        const context = await loadChatContext(userId, analysisId, clientMessageId);
        if (context.dedupedReply) return context.dedupedReply;
        const { currentAnalysis, historyText, srsSnapshot } = context;

        // Persist user message immediately before AI generation
        await persistUserMessage(userId, currentAnalysis.id, userMessage, clientMessageId);

        const chatAgent = new ChatAgent(await resolveChatProvider(userId, currentAnalysis));
        let parsedResponse;

        if (process.env.MOCK_AI === 'true') {
            parsedResponse = {
                reply: 'Mocked AI Reply',
                updatedAnalysis: {
                    projectTitle: 'Mocked V2',
                    functionalRequirements: ['New Reqs'],
                    nonFunctionalRequirements: [],
                    userStories: []
                }
            };
        } else {
            parsedResponse = await chatAgent.chat(srsSnapshot, historyText, userMessage);
        }

        const newAnalysisId = await finalizeChatTurn(userId, currentAnalysis, userMessage, clientMessageId, parsedResponse.reply, parsedResponse.updatedAnalysis);

        return {
            reply: parsedResponse.reply,
            newAnalysisId
        };
    } finally {
        await releaseChatLock(lockKey);
    }
}

/**
 * Streaming variant of processChat: decouples AI generation from HTTP connection lifetimes.
 * If the user closes the tab mid-stream, generation continues in the background and
 * persists the complete assistant response and versioned document to PostgreSQL.
 */
export async function processChatStream(userId, analysisId, userMessage, clientMessageId = null, onChunk = () => {}, _signal = null) {
    const lockKey = await acquireChatLock(clientMessageId);
    try {
        const context = await loadChatContext(userId, analysisId, clientMessageId);
        if (context.dedupedReply) {
            if (context.dedupedReply.reply) onChunk(context.dedupedReply.reply);
            return context.dedupedReply;
        }
        const { currentAnalysis, historyText, srsSnapshot } = context;

        // Persist user message immediately before AI generation starts
        await persistUserMessage(userId, currentAnalysis.id, userMessage, clientMessageId);

        const chatAgent = new ChatAgent(await resolveChatProvider(userId, currentAnalysis));
        const shouldProposeEdit = looksLikeEditRequest(userMessage);

        if (process.env.MOCK_AI === 'true') {
            const mockReply = 'Mocked AI Reply';
            for (const word of mockReply.split(' ')) onChunk(`${word} `);
            const updatedAnalysis = shouldProposeEdit ? {
                projectTitle: 'Mocked V2',
                functionalRequirements: ['New Reqs'],
                nonFunctionalRequirements: [],
                userStories: []
            } : null;
            const newAnalysisId = await finalizeChatTurn(userId, currentAnalysis, userMessage, clientMessageId, mockReply, updatedAnalysis);
            return { reply: mockReply, newAnalysisId };
        }

        // Fire the edit-detection/production call in parallel
        const editPromise = shouldProposeEdit
            ? chatAgent.proposeEdit(srsSnapshot, historyText, userMessage).catch(err => {
                logger.warn({ msg: '[Chat Service] proposeEdit failed (non-fatal — reply still streams)', error: err.message });
                return { updatedAnalysis: null };
            })
            : Promise.resolve({ updatedAnalysis: null });

        let fullReply = '';
        try {
            for await (const chunk of chatAgent.chatStream(srsSnapshot, historyText, userMessage)) {
                fullReply += chunk;
                try {
                    onChunk(chunk);
                } catch {
                    // Client disconnected from stream; continue server-side generation
                }
            }
        } catch (streamErr) {
            logger.error({ msg: '[Chat Service] Stream generation encountered error', error: streamErr.message });
            if (!fullReply) fullReply = 'Sorry, an error occurred while generating the reply.';
        }

        const { updatedAnalysis } = await editPromise;
        const newAnalysisId = await finalizeChatTurn(userId, currentAnalysis, userMessage, clientMessageId, fullReply, updatedAnalysis);

        return { reply: fullReply, newAnalysisId };
    } finally {
        await releaseChatLock(lockKey);
    }
}
