import prisma from '../config/prisma.js';
import { embedText } from './embeddingService.js';

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
                    console.log(`[Reuse] Found ${reuseMetadata.type} match: ${reuseMetadata.id}`);
                }
            }
        }
    } catch (e) {
        console.warn("Reuse search failed:", e.message);
    }

    return reuseMetadata;
};
