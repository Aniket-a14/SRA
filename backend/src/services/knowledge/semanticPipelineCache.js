import prisma from '../../config/prisma.js';
import { embedText } from './embeddingService.js';
import logger from '../../config/logger.js';

/**
 * Caches DeveloperAgent.refineSRS's surgical section refinements across analyses. A hit
 * means the reflection loop can skip an LLM call outright and replay the earlier output —
 * unlike RAG retrieval, a false hit here doesn't just add irrelevant context, it silently
 * substitutes a different refinement, so the bar for reuse is a near-duplicate, not a
 * topical match. 0.25 (retrieveContext's threshold) would be reckless here; this asks for
 * essentially the same complaint about essentially the same draft.
 */
const SIMILARITY_THRESHOLD = 0.97;

const cacheKeyText = (sectionName, targetDraft, feedback) =>
    JSON.stringify({ sectionName, targetDraft, feedback });

/**
 * Looks up a prior refinement whose (section, draft, feedback) is a near-duplicate of the
 * one about to be requested, scoped to the calling user. Returns the cached output on a hit,
 * or null on a miss — callers fall through to a real refineSRS call either way.
 *
 * @param {{ userId: string, sectionName: string, targetDraft: object, feedback: unknown[] }} p
 * @returns {Promise<object|null>}
 */
export async function lookupRefinement({ userId, sectionName, targetDraft, feedback }) {
    if (!userId) {
        throw new Error('lookupRefinement requires a userId — the cache is scoped to the requesting user');
    }
    // MOCK_AI runs never call embedText for anything else either (see retrieveContext) — this
    // keeps the reflection loop's test suite deterministic and network-free.
    if (process.env.MOCK_AI === 'true') return null;

    try {
        const embedding = await embedText(cacheKeyText(sectionName, targetDraft, feedback));
        const vectorStr = `[${embedding.join(',')}]`;

        const [match] = await prisma.$queryRaw`
            SELECT id, output, 1 - (embedding <=> ${vectorStr}::vector) as similarity
            FROM "SemanticPipelineCache"
            WHERE "userId" = ${userId}
              AND "sectionName" = ${sectionName}
              AND embedding IS NOT NULL
            ORDER BY embedding <=> ${vectorStr}::vector ASC
            LIMIT 1;
        `;

        if (!match || match.similarity < SIMILARITY_THRESHOLD) return null;

        // Bookkeeping only — a failure here must not turn a cache hit into a wasted LLM call.
        prisma.semanticPipelineCache.update({
            where: { id: match.id },
            data: { hitCount: { increment: 1 }, lastHitAt: new Date() }
        }).catch(err => logger.warn({ msg: '[SemanticPipelineCache] Hit bookkeeping failed', error: err.message }));

        logger.info({ msg: '[SemanticPipelineCache] Reusing prior refinement', sectionName, similarity: match.similarity });
        return match.output;
    } catch (err) {
        // A cache miss and a cache error look identical from here: fall through to a real
        // refinement rather than fail the pipeline over a caching layer.
        logger.warn({ msg: '[SemanticPipelineCache] Lookup failed, refining normally', error: err.message });
        return null;
    }
}

/**
 * Stores a freshly generated refinement for future reuse. Best-effort and non-throwing: a
 * write failure here must not fail the refinement that just succeeded.
 *
 * @param {{ userId: string, sectionName: string, targetDraft: object, feedback: unknown[], output: object }} p
 */
export async function storeRefinement({ userId, sectionName, targetDraft, feedback, output }) {
    if (!userId) {
        throw new Error('storeRefinement requires a userId — the cache is scoped to the requesting user');
    }
    if (process.env.MOCK_AI === 'true') return;

    try {
        const embedding = await embedText(cacheKeyText(sectionName, targetDraft, feedback));
        const vectorStr = `[${embedding.join(',')}]`;

        const created = await prisma.semanticPipelineCache.create({
            data: { userId, sectionName, output }
        });
        await prisma.$executeRaw`
            UPDATE "SemanticPipelineCache" SET embedding = ${vectorStr}::vector WHERE id = ${created.id};
        `;
    } catch (err) {
        logger.warn({ msg: '[SemanticPipelineCache] Store failed — refinement still applied, just not cached', error: err.message });
    }
}
