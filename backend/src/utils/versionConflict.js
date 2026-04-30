/**
 * Shared version conflict detection for Prisma transactions.
 * Used by analysisController and queueService.
 */

export const VERSION_CONFLICT_MAX_RETRIES = 3;

export const isVersionConflictError = (error) => {
    const msg = (error?.message || '').toLowerCase();
    const code = error?.code;
    return (
        code === 'P2002' ||
        code === 'P2034' ||
        msg.includes('unique constraint') ||
        msg.includes('write conflict') ||
        msg.includes('could not serialize')
    );
};
