import prisma from '../../config/prisma.js';
import { embedText } from './embeddingService.js';
import logger from '../../config/logger.js';

/**
 * Look for an existing finalized analysis close enough to reuse, referenced or drawn on.
 *
 * Scoped to the caller. Unscoped, this compared the submitted text against every finalized
 * analysis on the platform and returned the winning row's **id** plus a similarity score in
 * the `POST /analyze` response — so submitting text told you whether any other customer had
 * a near-identical specification, and handed you the identifier for it.
 *
 * @param {string} text
 * @param {string} userId - required; a reuse candidate is only ever your own prior work
 */
export const findReuseCandidate = async (text, userId) => {
    let reuseMetadata = { found: false };

    if (!userId) {
        throw new Error('findReuseCandidate requires a userId — reuse candidates are scoped to the requesting user');
    }

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
                    AND "userId" = ${userId}
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
