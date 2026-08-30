const cleanTruncate = (value, maxChars = 1200) => {
    if (value === null || value === undefined) return value;
    const text = typeof value === 'string' ? value.trim() : JSON.stringify(value);
    if (text.length <= maxChars) return text;

    // Truncate at nearest sentence or word boundary to prevent corrupted tokens
    const sliced = text.slice(0, maxChars);
    const lastPunctuation = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf(';\n'), sliced.lastIndexOf('\n'));
    if (lastPunctuation > maxChars * 0.5) {
        return sliced.slice(0, lastPunctuation + 1);
    }
    const lastSpace = sliced.lastIndexOf(' ');
    return lastSpace > 0 ? `${sliced.slice(0, lastSpace)}...` : `${sliced}...`;
};

export const stringifyForPrompt = (value, maxChars = null) => {
    if (value === undefined) return '';
    let text;
    try {
        text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    } catch {
        text = String(value);
    }
    if (!text) return '';
    return maxChars ? cleanTruncate(text, maxChars) : text;
};

const compactFeature = (feature) => {
    const rawReqs = Array.isArray(feature?.functionalRequirements) ? feature.functionalRequirements : [];
    return {
        name: feature?.name || feature?.featureName || "Unnamed Feature",
        priority: feature?.priority || "Medium",
        description: cleanTruncate(feature?.description, 800),
        stimulusResponseSequences: Array.isArray(feature?.stimulusResponseSequences)
            ? feature.stimulusResponseSequences.slice(0, 8).map(item => cleanTruncate(item, 400))
            : [],
        functionalRequirements: rawReqs.map(item => cleanTruncate(item, 400)),
        functionalRequirementCount: rawReqs.length,
    };
};

const compactRequirementGroup = (requirements = {}) => Object.fromEntries(
    Object.entries(requirements && typeof requirements === 'object' ? requirements : {}).map(([key, value]) => [
        key,
        {
            count: Array.isArray(value) ? value.length : (value ? 1 : 0),
            items: Array.isArray(value) ? value.map(item => cleanTruncate(item, 400)) : cleanTruncate(value, 800),
        }
    ])
);

/**
 * Creates a comprehensive snapshot of original requirements & draft for Critic 6Cs audits.
 * Preserves ALL system feature keys and full requirements to eliminate Critic blindspots.
 */
export const createReviewSnapshot = (originalRequirements, srsContent) => {
    const origFeatures = originalRequirements?.features || originalRequirements?.systemFeatures || [];
    const draftFeatures = srsContent?.systemFeatures || [];

    return {
        originalIntent: {
            projectTitle: originalRequirements?.projectTitle,
            scopeSummary: cleanTruncate(originalRequirements?.scopeSummary, 1500),
            features: origFeatures.map(compactFeature),
            userStories: Array.isArray(originalRequirements?.userStories)
                ? originalRequirements.userStories.map(story => ({
                    role: story?.role,
                    action: story?.action,
                    benefit: story?.benefit,
                    acceptanceCriteria: Array.isArray(story?.acceptanceCriteria)
                        ? story.acceptanceCriteria.map(item => cleanTruncate(item, 350))
                        : [],
                }))
                : [],
        },
        srsDraft: {
            projectTitle: srsContent?.projectTitle,
            introduction: {
                purpose: cleanTruncate(srsContent?.introduction?.purpose, 1200),
                productScope: cleanTruncate(srsContent?.introduction?.productScope, 1200),
            },
            productFunctions: Array.isArray(srsContent?.overallDescription?.productFunctions)
                ? srsContent.overallDescription.productFunctions.map(item => cleanTruncate(item, 400))
                : [],
            systemFeatures: draftFeatures.map(compactFeature),
            systemFeatureCount: draftFeatures.length,
            externalInterfaceRequirements: compactRequirementGroup(srsContent?.externalInterfaceRequirements),
            nonFunctionalRequirements: compactRequirementGroup(srsContent?.nonFunctionalRequirements),
            otherRequirements: Array.isArray(srsContent?.otherRequirements)
                ? srsContent.otherRequirements.map(item => cleanTruncate(item, 400))
                : [],
            glossary: Array.isArray(srsContent?.glossary)
                ? srsContent.glossary.slice(0, 20).map(item => cleanTruncate(item, 300))
                : [],
            appendices: {
                tbdList: Array.isArray(srsContent?.appendices?.tbdList)
                    ? srsContent.appendices.tbdList.map(item => cleanTruncate(item, 400))
                    : [],
                diagramCaptions: Object.fromEntries(
                    Object.entries(srsContent?.appendices?.analysisModels || {}).map(([key, value]) => [
                        key,
                        {
                            caption: value?.caption,
                            hasCode: Boolean(value?.code),
                        }
                    ])
                ),
            },
        },
    };
};

/**
 * Creates a compact snapshot of the SRS optimised for chat prompt injection.
 */
export const createChatSnapshot = (srsContent) => ({
    projectTitle: srsContent?.projectTitle,
    introduction: {
        purpose: cleanTruncate(srsContent?.introduction?.purpose, 1200),
        productScope: cleanTruncate(srsContent?.introduction?.productScope, 1200),
        intendedAudience: cleanTruncate(srsContent?.introduction?.intendedAudience, 600),
    },
    overallDescription: {
        productPerspective: cleanTruncate(srsContent?.overallDescription?.productPerspective, 1000),
        productFunctions: Array.isArray(srsContent?.overallDescription?.productFunctions)
            ? srsContent.overallDescription.productFunctions.map(item => cleanTruncate(item, 400))
            : [],
        userClassesAndCharacteristics: Array.isArray(srsContent?.overallDescription?.userClassesAndCharacteristics)
            ? srsContent.overallDescription.userClassesAndCharacteristics.map(uc => ({
                userClass: uc?.userClass,
                characteristics: cleanTruncate(uc?.characteristics, 350)
            }))
            : [],
    },
    systemFeatureCount: Array.isArray(srsContent?.systemFeatures) ? srsContent.systemFeatures.length : 0,
    systemFeatures: Array.isArray(srsContent?.systemFeatures)
        ? srsContent.systemFeatures.map(feature => ({
            name: feature?.name || feature?.featureName || 'Unnamed',
            priority: feature?.priority,
            description: cleanTruncate(feature?.description, 800),
            functionalRequirements: Array.isArray(feature?.functionalRequirements)
                ? feature.functionalRequirements.map(r => cleanTruncate(r, 350))
                : [],
            functionalRequirementCount: Array.isArray(feature?.functionalRequirements) ? feature.functionalRequirements.length : 0,
        }))
        : [],
    nonFunctionalRequirements: compactRequirementGroup(srsContent?.nonFunctionalRequirements),
    appendices: {
        diagramCaptions: Object.fromEntries(
            Object.entries(srsContent?.appendices?.analysisModels || {}).map(([key, value]) => [
                key, { caption: value?.caption, hasCode: Boolean(value?.code) }
            ])
        ),
    },
});
