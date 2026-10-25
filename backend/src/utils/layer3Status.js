/**
 * Layer-3 alignment status labels (resultJson.layer3Status). Pure, so every caller and test
 * shares one mapping without pulling in the AI-calling qualityService.
 */

/** checkAlignment's own status when the model call failed (never produced by the model). */
export const ALIGNMENT_CHECK_FAILED = 'CHECK_FAILED';

/**
 * Map an alignment result to a layer3Status label. Strict on purpose: only an explicit
 * ALIGNED from the model counts as aligned. A failed check, a thrown error (pass null), or
 * any status outside the prompt's contract is UNVERIFIED, never ALIGNED.
 *
 * @param {{status?: string}|null|undefined} alignmentResult
 * @returns {'ALIGNED'|'MISMATCH'|'UNVERIFIED'}
 */
export const toLayer3Status = (alignmentResult) => {
    switch (alignmentResult?.status) {
        case 'ALIGNED': return 'ALIGNED';
        case 'MISMATCH_DETECTED': return 'MISMATCH';
        default: return 'UNVERIFIED';
    }
};
