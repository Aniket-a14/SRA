import prisma from '../../config/prisma.js';
import logger from '../../config/logger.js';

/**
 * Account erasure (GDPR Art. 17, CCPA right to delete), in two steps.
 *
 * There was no way to delete an account at all, and it was not merely missing — it was
 * blocked. `User → Analysis` and `KnowledgeChunk → Analysis` are both ON DELETE RESTRICT,
 * so a naive `prisma.user.delete()` fails outright for anyone who has ever finalized an
 * analysis. Hence the explicit ordering in `hardDeleteUser` rather than leaning on cascades.
 */

/** How long a deleted account can still be recovered before the data is actually gone. */
export const DELETION_GRACE_DAYS = 30;

/**
 * Step one: mark the account deleted and end every session immediately.
 *
 * The account stops working the moment this returns — login is refused, refresh tokens are
 * rejected, and existing access tokens fail because `authMiddleware` checks the session
 * behind them. Only the erasure of the data itself waits for the grace window, so that an
 * accidental deletion (or one performed with a stolen token) is recoverable by a human
 * rather than instantly final.
 */
export async function requestAccountDeletion(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, deletedAt: true }
    });

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    if (user.deletedAt) {
        const error = new Error('This account is already scheduled for deletion.');
        error.statusCode = 409;
        throw error;
    }

    const deletedAt = new Date();
    const purgeAt = new Date(deletedAt.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { deletedAt } }),
        prisma.session.deleteMany({ where: { userId } })
    ]);

    logger.info({ msg: 'Account deletion requested', userId, purgeAt: purgeAt.toISOString() });

    return { deletedAt: deletedAt.toISOString(), purgeAt: purgeAt.toISOString(), graceDays: DELETION_GRACE_DAYS };
}

/** Undo a deletion request inside the grace window. */
export async function cancelAccountDeletion(userId) {
    const { count } = await prisma.user.updateMany({
        where: { id: userId, deletedAt: { not: null } },
        data: { deletedAt: null }
    });

    if (count === 0) {
        const error = new Error('This account is not scheduled for deletion.');
        error.statusCode = 409;
        throw error;
    }

    logger.info({ msg: 'Account deletion cancelled', userId });
    return { restored: true };
}

/**
 * Step two: irreversibly remove the user and everything belonging to them.
 *
 * The order is dictated by the foreign keys, not by preference:
 *
 *   KnowledgeChunk → Analysis   is RESTRICT, so chunks go before analyses
 *   Analysis(parent/root/self)  self-references, so the whole set is deleted in one
 *                               statement and Postgres resolves it within the transaction
 *   Analysis → User             is RESTRICT, so analyses go before the user
 *   ChatMessage, GraphNode/Edge, Session, ApiKey, UserProviderKey, Project all cascade
 *
 * AuditLog is deliberately NOT deleted: its FK is ON DELETE SET NULL, so the rows survive
 * with the subject detached. The record that something happened is retained for security
 * and accountability; the link identifying who did it is destroyed, which is what erasure
 * requires.
 */
export async function hardDeleteUser(userId) {
    return prisma.$transaction(async (tx) => {
        const analyses = await tx.analysis.findMany({
            where: { userId },
            select: { id: true }
        });
        const analysisIds = analyses.map(a => a.id);

        let chunksDeleted = 0;
        if (analysisIds.length > 0) {
            ({ count: chunksDeleted } = await tx.knowledgeChunk.deleteMany({
                where: { sourceAnalysisId: { in: analysisIds } }
            }));
        }

        const { count: analysesDeleted } = await tx.analysis.deleteMany({ where: { userId } });
        const { count: projectsDeleted } = await tx.project.deleteMany({ where: { userId } });

        await tx.user.delete({ where: { id: userId } });

        return { userId, chunksDeleted, analysesDeleted, projectsDeleted };
    }, { timeout: 30000 });
}

/**
 * Purge every account whose grace window has elapsed. Driven by the existing reconciliation
 * sweep, so erasure happens on a schedule rather than depending on someone remembering.
 */
export async function purgeExpiredDeletions() {
    const cutoff = new Date(Date.now() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

    const due = await prisma.user.findMany({
        where: { deletedAt: { not: null, lte: cutoff } },
        select: { id: true }
    });

    let purged = 0;
    for (const user of due) {
        try {
            await hardDeleteUser(user.id);
            purged += 1;
            logger.info({ msg: 'Account purged after grace period', userId: user.id });
        } catch (error) {
            // One account that will not delete must not stop the rest of the sweep. It does
            // need to be loud, though — a purge that silently fails is a compliance failure
            // that looks like success.
            logger.error({ msg: 'Account purge failed', userId: user.id, error: error.message });
        }
    }

    return { due: due.length, purged };
}
