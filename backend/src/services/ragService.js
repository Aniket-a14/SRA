import { Prisma } from '../generated/prisma/index.js';
import prisma from '../config/prisma.js';
import { embedText } from './embeddingService.js';
import logger from '../config/logger.js';
import { traverseGraph } from './graphService.js';
import { genAI } from '../config/gemini.js';

// Global token limit for context injection (Layer 5 policy)
// Increased to 32k tokens to leverage Gemini 2.5 Pro/Flash capacity while staying within Free Tier TPM limits.
const CONTEXT_TOKEN_LIMIT = 32768; 

/**
 * Retrieves granular knowledge chunks based on semantic similarity and keywords.
 */
export const retrieveContext = async (queryText, projectId = null, limit = 5) => {
    try {
        if (process.env.MOCK_AI === 'true') {
            return [];
        }

        // 1. Vector Search (Standard RAG)
        const embedding = await embedText(queryText);
        const vectorStr = `[${embedding.join(',')}]`;

        const matches = await prisma.$queryRaw`
            SELECT 
                kc.id, 
                kc.type, 
                kc.content, 
                kc.tags,
                kc."qualityScore",
                1 - (kc.embedding <=> ${vectorStr}::vector) as similarity,
                COALESCE(p.name, a.title, 'Historical Project') as source_title
            FROM "KnowledgeChunk" kc
            JOIN "Analysis" a ON kc."sourceAnalysisId" = a.id
            LEFT JOIN "Project" p ON a."projectId" = p.id
            WHERE kc.embedding IS NOT NULL
            ORDER BY 
                CASE WHEN kc."qualityScore" >= 0.85 THEN 1 ELSE 0 END DESC,
                kc.embedding <=> ${vectorStr}::vector ASC
            LIMIT ${limit};
        `;

        const vectorResults = matches.map(m => ({
            type: m.type,
            content: m.content,
            similarity: m.similarity,
            qualityScore: m.qualityScore,
            tags: m.tags,
            sourceTitle: m.source_title
        }));

        // 2. Graph Retrieval (If Project Context exists)
        if (projectId) {
            const stopWords = new Set(['The', 'And', 'For', 'This', 'That', 'With', 'From', 'Moreover', 'However', 'Furthermore']);
            const matches = queryText.match(/[A-Z][a-zA-Z0-9]+/g) || [];
            const potentialEntities = matches.filter(word => !stopWords.has(word));

            if (potentialEntities.length > 0) {
                const graphContext = await traverseGraph(potentialEntities, projectId);
                if (graphContext) {
                    vectorResults.push({
                        type: 'GRAPH_RELATIONSHIPS',
                        content: graphContext,
                        similarity: 1.0, 
                        sourceTitle: 'System Knowledge Graph'
                    });
                }
            }
        }

        return vectorResults;

    } catch (error) {
        logger.error({ msg: "[RAG Service] Retrieval failed", error: error.message });
        return [];
    }
};

/**
 * Formats retrieved chunks into a string for LLM prompt injection with token-awareness.
 * PILLAR 2: Aggressive prioritization of high-quality chunks.
 */
export const formatRagContext = async (chunks) => {
    if (!chunks || chunks.length === 0) return "";

    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL_NAME || "gemini-2.5-flash" });
    let contextHeader = "\n[RELEVANT_KNOWLEDGE_BASE_CONTEXT_START]\nThe following sections from similar finalized projects are provided for reference:\n\n";
    let formattedContext = contextHeader;
    let currentTokens = 0;

    // Prioritization: 1. Graph, 2. Gold Standard, 3. General Similarity
    const sortedChunks = [...chunks].sort((a, b) => {
        if (a.type === 'GRAPH_RELATIONSHIPS') return -1;
        if (b.type === 'GRAPH_RELATIONSHIPS') return 1;
        return (b.qualityScore || 0) - (a.qualityScore || 0);
    });

    try {
        const { totalTokens: initialTokens } = await model.countTokens(contextHeader);
        currentTokens = initialTokens;

        for (let i = 0; i < sortedChunks.length; i++) {
            const chunk = sortedChunks[i];
            const sourceInfo = chunk.sourceTitle ? ` (from ${chunk.sourceTitle})` : "";
            const qualityLabel = (chunk.qualityScore && chunk.qualityScore >= 0.85) ? " [GOLD STANDARD]" : "";
            
            let chunkText = `--- REFERENCE ${i + 1} (${chunk.type}${sourceInfo})${qualityLabel} ---\n`;
            let contentStr = JSON.stringify(chunk.content, null, 2);
            
            // Per-chunk safety cap before token check
            if (contentStr.length > 10000) {
                contentStr = contentStr.substring(0, 10000) + "... [DOC_SLICE] ...";
            }
            
            chunkText += contentStr + "\n\n";

            const { totalTokens: chunkTokens } = await model.countTokens(chunkText);

            if (currentTokens + chunkTokens > CONTEXT_TOKEN_LIMIT) {
                formattedContext += "--- [32768 TOKEN BUDGET REACHED: ADDITIONAL CONTEXT OMITTED] ---\n";
                break;
            }

            formattedContext += chunkText;
            currentTokens += chunkTokens;
        }
        
    } catch (tokenError) {
        logger.warn({ msg: "[RAG Service] Token counting failed, falling back to simple slicing", error: tokenError.message });
        return chunks.map(c => JSON.stringify(c.content)).join("\n\n").substring(0, 100000);
    }

    formattedContext += "[RELEVANT_KNOWLEDGE_BASE_CONTEXT_END]\n";
    return formattedContext;
};

/**
 * Explicitly searches for high-quality requirement fragments for manual reuse.
 * Pillar 2 specialized search.
 */
export const searchGoldStandardFragments = async (query, type = null) => {
    try {
        const embedding = await embedText(query);
        const vectorStr = `[${embedding.join(',')}]`;

        const matches = await prisma.$queryRaw`
            SELECT 
                id, type, content, tags, "qualityScore"
            FROM "KnowledgeChunk"
            WHERE embedding IS NOT NULL
            ${type ? Prisma.sql`AND type = ${type}` : Prisma.empty}
            AND "qualityScore" >= 0.70
            ORDER BY embedding <=> ${vectorStr}::vector ASC
            LIMIT 5;
        `;

        return matches;
    } catch (error) {
        logger.error({ msg: "[RAG Service] Gold Standard search failed", error: error.message });
        return [];
    }
};
