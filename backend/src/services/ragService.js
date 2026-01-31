import prisma from '../config/prisma.js';
import { embedText } from './embeddingService.js';

/**
 * Retrieves granular knowledge chunks based on semantic similarity and keywords.
 * This is the core of Layer 5 "Granular RAG".
 */
export const retrieveContext = async (queryText, limit = 5) => {
    try {
        if (process.env.MOCK_AI === 'true') {
            return [];
        }

        const embedding = await embedText(queryText);
        const vectorStr = `[${embedding.join(',')}]`;

        // Hybrid Search: Vector Similarity + Tag Matching
        // Join with Analysis/Project to get tracing metadata
        const matches = await prisma.$queryRaw`
            SELECT 
                kc.id, 
                kc.type, 
                kc.content, 
                kc.tags,
                1 - (kc.embedding <=> ${vectorStr}::vector) as similarity,
                COALESCE(p.name, a.title, 'Historical Project') as source_title
            FROM "KnowledgeChunk" kc
            JOIN "Analysis" a ON kc."sourceAnalysisId" = a.id
            LEFT JOIN "Project" p ON a."projectId" = p.id
            WHERE kc.embedding IS NOT NULL
            ORDER BY kc.embedding <=> ${vectorStr}::vector ASC
            LIMIT ${limit};
        `;

        return matches.map(m => ({
            type: m.type,
            content: m.content,
            similarity: m.similarity,
            tags: m.tags,
            sourceTitle: m.source_title
        }));
    } catch (error) {
        console.error("[RAG Service] Retrieval failed:", error);
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
        context += `--- REFERENCE ${i + 1} (${chunk.type}${sourceInfo}) ---\n`;
        context += JSON.stringify(chunk.content, null, 2);
        context += "\n\n";
    });

    context += "[RELEVANT_KNOWLEDGE_BASE_CONTEXT_END]\n";
    return context;
};
