/**
 * Compares two analysis objects format-agnostically and returns all section differences.
 * Works dynamically across IEEE 830, ISO 29148, Volere, Agile PRD, and custom standards.
 */
export const compareAnalyses = (v1, v2) => {
    const changes = {};

    // 1. Input Text Diff
    if (v1.inputText !== v2.inputText) {
        changes.inputText = {
            old: v1.inputText,
            new: v2.inputText
        };
    }

    const r1 = v1.resultJson || {};
    const r2 = v2.resultJson || {};

    const EXCLUDED_META_KEYS = new Set([
        'qualityAudit',
        'promptSettings',
        'checkpoint',
        'draftData'
    ]);

    // 2. Collect all section keys from both documents
    const allKeys = Array.from(new Set([...Object.keys(r1), ...Object.keys(r2)]));

    for (const key of allKeys) {
        if (EXCLUDED_META_KEYS.has(key)) continue;

        const val1 = r1[key];
        const val2 = r2[key];

        if (JSON.stringify(val1) !== JSON.stringify(val2)) {
            changes[key] = {
                old: val1,
                new: val2
            };
        }
    }

    return changes;
};
