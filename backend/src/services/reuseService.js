import prisma from '../config/prisma.js';
import { embedText } from './embeddingService.js';
import logger from '../config/logger.js';

const similarityToReuseType = (similarity) => {
    if (similarity > 0.90) return { type: 'EXACT', behavior: 'REWRITE_TECHNICAL_BRAIN' };
    if (similarity >= 0.60) return { type: 'HIGH', behavior: 'ADAPT_STRUCTURE' };
    if (similarity >= 0.30) return { type: 'PARTIAL', behavior: 'REFERENCE' };
    if (similarity >= 0.15) return { type: 'LOW', behavior: 'IGNORE' };
    return { type: 'NONE', behavior: 'IGNORE' };
};

export const findReuseCandidate = async (text) => {
    let reuseMetadata = { found: false };

    try {
        if (process.env.MOCK_AI !== 'true') {
            // Generate embedding
            const embeddingVector = await embedText(text);

            // Search for similar analyses (cosine distance)
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
                    }
                }

                if (reuseMetadata.found) {
                    logger.info({ msg: `[Reuse] Found ${reuseMetadata.type} match`, id: reuseMetadata.id });
                }
            }
        }
    } catch (e) {
        logger.warn({ msg: "[Reuse] Search failed", error: e.message });
    }

    return reuseMetadata;
};

export const buildReusePlan = async ({ text, userId }) => {
    const plan = {
        found: false,
        userSpecific: [],
        globalReference: [],
        policy: {
            userSpecific: 'Preserve technical intent, constraints, edge cases, and acceptance logic; rewrite wording for the current project.',
            globalReference: 'Use only as architectural and requirements-engineering reference. Do not copy wording or private project-specific facts.'
        }
    };

    try {
        if (process.env.MOCK_AI === 'true') return plan;

        const embeddingVector = await embedText(text);
        if (!embeddingVector || embeddingVector.length === 0) return plan;

        const vectorString = `[${embeddingVector.join(',')}]`;

        const userChunks = await prisma.$queryRaw`
            SELECT
                kc.id,
                kc.type,
                kc.content,
                kc.tags,
                kc."qualityScore",
                kc.metadata,
                kc."sourceAnalysisId",
                1 - (kc.embedding <=> ${vectorString}::vector) as similarity,
                COALESCE(p.name, a.title, 'User Project') as source_title
            FROM "KnowledgeChunk" kc
            JOIN "Analysis" a ON kc."sourceAnalysisId" = a.id
            LEFT JOIN "Project" p ON a."projectId" = p.id
            WHERE kc.embedding IS NOT NULL
            AND a."isFinalized" = true
            AND a."userId" = ${userId}
            ORDER BY
                COALESCE((kc.metadata->'trust'->>'priority')::int, 0) DESC,
                kc.embedding <=> ${vectorString}::vector ASC
            LIMIT 8;
        `;

        const globalChunks = await prisma.$queryRaw`
            SELECT
                kc.id,
                kc.type,
                kc.content,
                kc.tags,
                kc."qualityScore",
                kc.metadata,
                kc."sourceAnalysisId",
                1 - (kc.embedding <=> ${vectorString}::vector) as similarity,
                COALESCE(p.name, a.title, 'Global Project') as source_title
            FROM "KnowledgeChunk" kc
            JOIN "Analysis" a ON kc."sourceAnalysisId" = a.id
            LEFT JOIN "Project" p ON a."projectId" = p.id
            WHERE kc.embedding IS NOT NULL
            AND a."isFinalized" = true
            AND a."userId" <> ${userId}
            ORDER BY
                COALESCE((kc.metadata->'trust'->>'priority')::int, 0) DESC,
                kc.embedding <=> ${vectorString}::vector ASC
            LIMIT 5;
        `;

        plan.userSpecific = userChunks
            .filter(chunk => Number(chunk.similarity) >= 0.30)
            .map(chunk => {
                const tier = similarityToReuseType(Number(chunk.similarity));
                return {
                    ...chunk,
                    reuseScope: 'USER_SPECIFIC',
                    reuseMode: tier.behavior,
                    reuseType: tier.type
                };
            });

        plan.globalReference = globalChunks
            .filter(chunk => Number(chunk.similarity) >= 0.25)
            .map(chunk => ({
                ...chunk,
                reuseScope: 'GLOBAL_REFERENCE',
                reuseMode: 'REFERENCE_ONLY',
                reuseType: 'REFERENCE'
            }));

        plan.found = plan.userSpecific.length > 0 || plan.globalReference.length > 0;

        if (plan.found) {
            logger.info({
                msg: "[Reuse] Built scoped reuse plan",
                userSpecific: plan.userSpecific.length,
                globalReference: plan.globalReference.length
            });
        }
    } catch (error) {
        logger.warn({ msg: "[Reuse] Scoped plan failed", error: error.message });
    }

    return plan;
};

export const formatReusePlanContext = (reusePlan) => {
    if (!reusePlan || !reusePlan.found) return "";

    const lines = [
        "\n[SCOPED_REUSE_POLICY_START]",
        "Reuse policy:",
        `- User-specific chunks: ${reusePlan.policy.userSpecific}`,
        `- Global chunks: ${reusePlan.policy.globalReference}`,
        "- Never copy global wording. For user-specific chunks, keep the technical brain but rewrite the explanation in the current project's language.",
        "[SCOPED_REUSE_POLICY_END]\n"
    ];

    if (reusePlan.userSpecific?.length > 0) {
        lines.push("[USER_SPECIFIC_REUSABLE_CHUNKS_START]");
        reusePlan.userSpecific.forEach((chunk, index) => {
            lines.push(`--- USER CHUNK ${index + 1} (${chunk.type}, ${chunk.reuseType}, similarity=${Number(chunk.similarity).toFixed(3)}, source=${chunk.source_title}) ---`);
            lines.push(JSON.stringify(chunk.content, null, 2));
        });
        lines.push("[USER_SPECIFIC_REUSABLE_CHUNKS_END]\n");
    }

    if (reusePlan.globalReference?.length > 0) {
        lines.push("[GLOBAL_REFERENCE_KNOWLEDGE_START]");
        reusePlan.globalReference.forEach((chunk, index) => {
            lines.push(`--- GLOBAL REFERENCE ${index + 1} (${chunk.type}, similarity=${Number(chunk.similarity).toFixed(3)}, source=${chunk.source_title}) ---`);
            lines.push(JSON.stringify(chunk.content, null, 2));
        });
        lines.push("[GLOBAL_REFERENCE_KNOWLEDGE_END]\n");
    }

    return lines.join("\n");
};
