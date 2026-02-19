import { Prisma } from '../generated/prisma/index.js';
import prisma from '../config/prisma.js';
import { embedText } from './embeddingService.js';
import logger from '../config/logger.js';
import { traverseGraph } from './graphService.js';

/**
 * Retrieves granular knowledge chunks based on semantic similarity and keywords.
 * This is the core of Layer 5 "Granular RAG".
 * NOW ENHANCED WITH GRAPH RAG (Phase 1).
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
            -- PILLAR 2: Aggressive Prioritization of High-Quality (Gold Standard) fragments
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
            // Named Entity Heuristic: Extract capitalized words and filter common stop-words
            const stopWords = new Set(['The', 'And', 'For', 'This', 'That', 'With', 'From', 'Moreover', 'However', 'Furthermore']);
            const matches = queryText.match(/[A-Z][a-zA-Z0-9]+/g) || [];
            const potentialEntities = matches.filter(word => !stopWords.has(word));

            if (potentialEntities.length > 0) {
                const graphContext = await traverseGraph(potentialEntities, projectId);
                if (graphContext) {
                    // We append Graph Context as a special "System Knowledge" chunk
                    vectorResults.push({
                        type: 'GRAPH_RELATIONSHIPS',
                        content: graphContext,
                        similarity: 1.0, // High priority
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
 * Formats retrieved chunks into a string for LLM prompt injection.
 */
export const formatRagContext = (chunks) => {
    if (!chunks || chunks.length === 0) return "";

    let context = "\n[RELEVANT_KNOWLEDGE_BASE_CONTEXT_START]\n";
    context += "The following sections from similar finalized projects are provided for reference and pattern matching:\n\n";

    chunks.forEach((chunk, i) => {
        const sourceInfo = chunk.sourceTitle ? ` (from ${chunk.sourceTitle})` : "";
        const qualityLabel = (chunk.qualityScore && chunk.qualityScore >= 0.85) ? " [GOLD STANDARD]" : "";
        context += `--- REFERENCE ${i + 1} (${chunk.type}${sourceInfo})${qualityLabel} ---\n`;

        let contentStr = JSON.stringify(chunk.content, null, 2);
        // Truncate individual chunk content if it's excessively large (e.g. > 1500 chars)
        if (contentStr.length > 1500) {
            contentStr = contentStr.substring(0, 1500) + "\n... [TRUNCATED FOR BREVITY] ...";
        }

        context += contentStr;
        context += "\n\n";
    });

    context += "[RELEVANT_KNOWLEDGE_BASE_CONTEXT_END]\n";

    // Final safety cap: Ensure total context doesn't exceed 8000 characters
    if (context.length > 8000) {
        context = context.substring(0, 8000) + "\n\n... [ADDITIONAL CONTEXT OMITTED TO PRESERVE MODEL FOCUS] ...\n[RELEVANT_KNOWLEDGE_BASE_CONTEXT_END]";
    }

    return context;
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
