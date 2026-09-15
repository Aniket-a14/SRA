/**
 * Shared ownership-check for user-scoped resources (Project, Analysis, ...).
 *
 * Every model here uses `userId` as its owner FK. On a missing record or an
 * owner mismatch this throws the SAME 404 — never 403 — so a non-owner probing
 * another user's resource id can't tell "doesn't exist" apart from "exists but
 * isn't yours". That's a deliberate choice (see projectController's original
 * comments), not an oversight, so keep it 404 here even though a 403 would be
 * more "technically" accurate.
 */
export const assertOwned = (record, userId, resourceName = 'Resource') => {
    if (!record || record.userId !== userId) {
        const error = new Error(`${resourceName} not found`);
        error.statusCode = 404;
        throw error;
    }
    return record;
};
