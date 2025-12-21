
/**
 * Compares two analysis objects and returns differences.
 * Supports deep comparison for IEEE SRS structure.
 */
export const compareAnalyses = (v1, v2) => {
    const changes = {};

    // 1. Input Text
    if (v1.inputText !== v2.inputText) {
        changes.inputText = {
            old: v1.inputText,
            new: v2.inputText
        };
    }

    // Helper: Deep JSON compare
    const getDiff = (obj1, obj2) => {
        if (JSON.stringify(obj1) === JSON.stringify(obj2)) return null;
        return {
            old: obj1,
            new: obj2
        };
    };

    // Helper: Array compare (naive)
    const getArrayDiff = (arr1, arr2) => {
        if (!arr1 && !arr2) return null;
        if (JSON.stringify(arr1) === JSON.stringify(arr2)) return null;
        return {
            old: arr1,
            new: arr2
        };
    };

    const r1 = v1.resultJson || {};
    const r2 = v2.resultJson || {};

    // 2. Sections Diff

    // Introduction
    const introDiff = getDiff(r1.introduction, r2.introduction);
    if (introDiff) changes.introduction = introDiff;

    // Overall Description
    const overallDiff = getDiff(r1.overallDescription, r2.overallDescription);
    if (overallDiff) changes.overallDescription = overallDiff;

    // System Features (The most complex one)
    // For now, simpler object diff. 
    // Ideally we match by 'name' and diff internals, but atomic replacement view is also fine for V1.
    const featuresDiff = getArrayDiff(r1.systemFeatures, r2.systemFeatures);
    if (featuresDiff) changes.systemFeatures = featuresDiff;

    // Non-Functional
    const nfrDiff = getDiff(r1.nonFunctionalRequirements, r2.nonFunctionalRequirements);
    if (nfrDiff) changes.nonFunctionalRequirements = nfrDiff;

    // External Interfaces
    const extDiff = getDiff(r1.externalInterfaceRequirements, r2.externalInterfaceRequirements);
    if (extDiff) changes.externalInterfaceRequirements = extDiff;

    // Appendices (Diagrams, Glossary)
    const appDiff = getDiff(r1.appendices, r2.appendices);
    if (appDiff) changes.appendices = appDiff;

    // Other Req
    const otherDiff = getArrayDiff(r1.otherRequirements, r2.otherRequirements);
    if (otherDiff) changes.otherRequirements = otherDiff;

    return changes;
};
