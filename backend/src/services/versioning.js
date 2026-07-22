import { Prisma } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const MAX_RETRIES = 3;

/**
 * Creates the next Analysis version under a rootId chain without the
 * read-max-then-write race that used to be duplicated in queueService.js,
 * chatService.js, and analysisController.js. Relies on the DB-level
 * @@unique([rootId, version]) constraint (see the Phase 3 migration) as the
 * source of truth, retrying with a re-read max version on a P2002 collision
 * instead of trusting an in-memory computation under concurrent writers.
 *
 * @param {import('../generated/prisma/index.js').PrismaClient} tx - transaction client
 * @param {string} rootId
 * @param {(version: number) => object} buildData - returns the `data` object for
 *   `tx.analysis.create`, given the version number to use for this attempt.
 */
export async function createNextVersion(tx, rootId, buildData) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const maxVersionAgg = await tx.analysis.findFirst({
            where: { rootId },
            orderBy: { version: 'desc' },
            select: { version: true }
        });
        const version = (maxVersionAgg?.version || 0) + 1;

        try {
            return await tx.analysis.create({ data: buildData(version) });
        } catch (error) {
            const isVersionCollision = error instanceof Prisma.PrismaClientKnownRequestError
                && error.code === 'P2002'
                && error.meta?.target?.includes?.('rootId');

            if (!isVersionCollision || attempt === MAX_RETRIES - 1) {
                throw error;
            }
            logger.warn({ msg: 'Version collision, retrying', rootId, attemptedVersion: version, attempt });
        }
    }
    throw new Error(`Failed to create next version for rootId ${rootId} after ${MAX_RETRIES} attempts`);
}
