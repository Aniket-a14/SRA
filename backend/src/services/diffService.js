// import { diff } from 'jest-diff'; // jest-diff is great but might not be installed.// Actually, for simple text diffing we might need 'diff' package or just simple comparison.
// "compare two JSON objects". 
// Let's implement a simple field-by-field comparison for v1.

/**
 * Compares two analysis objects and returns differences for scoped fields.
 * Scoped Fields: inputText, functionalRequirements, nonFunctionalRequirements, userStories
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

    // Helper for arrays (FRs, NFRs, Stories)
    // improving it to simple JSON stringify comparison for now if they are arrays.
    // If we want detailed array diff (added/removed items), we can do set logic.
    const compareArrays = (arr1, arr2) => {
        const str1 = JSON.stringify(arr1 || []);
        const str2 = JSON.stringify(arr2 || []);
        if (str1 !== str2) {
            return {
                old: arr1,
                new: arr2
            };
        }
        return null;
    };

    // 2. Functional Requirements
    const frDiff = compareArrays(v1.resultJson.functionalRequirements, v2.resultJson.functionalRequirements);
    if (frDiff) changes.functionalRequirements = frDiff;

    // 3. Non-Functional Requirements
    const nfrDiff = compareArrays(v1.resultJson.nonFunctionalRequirements, v2.resultJson.nonFunctionalRequirements);
    if (nfrDiff) changes.nonFunctionalRequirements = nfrDiff;

    // 4. User Stories
    const usDiff = compareArrays(v1.resultJson.userStories, v2.resultJson.userStories);
    if (usDiff) changes.userStories = usDiff;

    return changes;
};
