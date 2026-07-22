import { ChatAgent } from '../agents/ChatAgent.js';
import prisma from '../config/prisma.js';
import { createChatSnapshot } from '../utils/promptCompaction.js';
import { createNextVersion } from './versioning.js';
import logger from '../config/logger.js';

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
    const currentAnalysis = await prisma.analysis.findUnique({ where: { id: analysisId } });

    if (!currentAnalysis) throw new Error('Analysis not found');
    if (currentAnalysis.userId !== userId) throw new Error('Unauthorized');

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

/**
 * Persists the turn (dedup-safe) and, if an edit was produced, creates a new
 * versioned analysis record. Shared tail end of both processChat and processChatStream.
 */
async function finalizeChatTurn(userId, currentAnalysis, userMessage, clientMessageId, replyText, updatedAnalysis) {
    if (clientMessageId) {
        await prisma.chatMessage.upsert({
            where: { clientMessageId },
            create: { analysisId: currentAnalysis.id, role: 'user', content: userMessage, clientMessageId },
            update: {}
        });
    } else {
        await prisma.chatMessage.create({
            data: { analysisId: currentAnalysis.id, role: 'user', content: userMessage }
        });
    }
    await prisma.chatMessage.create({
        data: { analysisId: currentAnalysis.id, role: 'assistant', content: replyText }
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
                            || process.env.GEMINI_MODEL_NAME
                            || 'gemini-3-flash-preview',
                        modelProvider: currentAnalysis.metadata?.promptSettings?.modelProvider || 'google'
                    }
                }
            }));
            newAnalysisId = newAnalysis.id;
        });

        logger.info(`[Chat Service] Created new analysis version ${newAnalysisId} from chat edit.`);
    }

    return newAnalysisId;
}

/**
 * Processes a single chat turn for an analysis session (non-streaming — single
 * combined JSON call for {reply, updatedAnalysis}).
 *
 * Token-efficiency improvements:
 *  - Uses ChatAgent (extends BaseAgent) instead of a raw genAI call,
 *    eliminating ~40 lines of duplicated retry/timeout/JSON-repair logic.
 *  - Injects a compact SRS snapshot (createChatSnapshot) instead of the full
 *    resultJson, cutting prompt size from 50KB+ down to ~6-8KB per turn.
 */
export async function processChat(userId, analysisId, userMessage, clientMessageId = null) {
    const context = await loadChatContext(userId, analysisId, clientMessageId);
    if (context.dedupedReply) return context.dedupedReply;
    const { currentAnalysis, historyText, srsSnapshot } = context;

    const chatAgent = new ChatAgent();
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
        newAnalysisId // If present, frontend should redirect/refresh to the new version
    };
}

/**
 * Streaming variant of processChat: the conversational reply is streamed token-by-token
 * via onChunk while, only when the message looks like an edit request, a separate
 * non-streamed JSON call runs concurrently to produce the document update. Both are
 * persisted/versioned the same way as the non-streaming path once the reply finishes.
 *
 * @param {(chunk: string) => void} onChunk — called for each reply text chunk as it streams
 * @returns {Promise<{reply: string, newAnalysisId: string|null}>}
 */
export async function processChatStream(userId, analysisId, userMessage, clientMessageId = null, onChunk = () => {}) {
    const context = await loadChatContext(userId, analysisId, clientMessageId);
    if (context.dedupedReply) {
        // Already processed — replay the stored reply as a single chunk so callers
        // that expect at least one onChunk invocation still render something.
        if (context.dedupedReply.reply) onChunk(context.dedupedReply.reply);
        return context.dedupedReply;
    }
    const { currentAnalysis, historyText, srsSnapshot } = context;

    const chatAgent = new ChatAgent();
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

    // Fire the edit-detection/production call in parallel with the stream — it's a
    // completely separate AI call so it doesn't have to wait for streaming to finish.
    const editPromise = shouldProposeEdit
        ? chatAgent.proposeEdit(srsSnapshot, historyText, userMessage).catch(err => {
            logger.warn({ msg: '[Chat Service] proposeEdit failed (non-fatal — reply still streams)', error: err.message });
            return { updatedAnalysis: null };
        })
        : Promise.resolve({ updatedAnalysis: null });

    let fullReply = '';
    for await (const chunk of chatAgent.chatStream(srsSnapshot, historyText, userMessage)) {
        fullReply += chunk;
        onChunk(chunk);
    }

    const { updatedAnalysis } = await editPromise;
    const newAnalysisId = await finalizeChatTurn(userId, currentAnalysis, userMessage, clientMessageId, fullReply, updatedAnalysis);

    return { reply: fullReply, newAnalysisId };
}
