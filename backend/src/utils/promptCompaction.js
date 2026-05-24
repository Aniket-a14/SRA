const MAX_TEXT = 900;
const MAX_CHAT_TEXT = 1200;
const MAX_ITEMS = 8;

const truncate = (value, max = MAX_TEXT) => {
    if (value === null || value === undefined) return value;
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}... [truncated ${text.length - max} chars]` : text;
};

export const stringifyForPrompt = (value, maxChars = null) => {
    if (value === undefined) return '';
    let text;
    try {
        text = typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
        text = String(value);
    }
    if (text === undefined) return '';
    if (!maxChars || text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}... [truncated ${text.length - maxChars} chars]`;
};

const take = (items, max = MAX_ITEMS) => Array.isArray(items) ? items.slice(0, max) : [];

const compactFeature = (feature) => ({
    name: feature?.name || feature?.featureName || "Unnamed Feature",
    priority: feature?.priority,
    description: truncate(feature?.description, 600),
    stimulusResponseSequences: take(feature?.stimulusResponseSequences, 5).map(item => truncate(item, 300)),
    functionalRequirements: take(feature?.functionalRequirements, 10).map(item => truncate(item, 300)),
    functionalRequirementCount: Array.isArray(feature?.functionalRequirements) ? feature.functionalRequirements.length : 0,
});

const compactRequirementGroup = (requirements = {}) => Object.fromEntries(
    Object.entries(requirements && typeof requirements === 'object' ? requirements : {}).map(([key, value]) => [
        key,
        {
            count: Array.isArray(value) ? value.length : (value ? 1 : 0),
            sample: Array.isArray(value) ? take(value, 6).map(item => truncate(item, 300)) : truncate(value, 600),
        }
    ])
);

export const createReviewSnapshot = (originalRequirements, srsContent) => ({
    originalIntent: {
        projectTitle: originalRequirements?.projectTitle,
        scopeSummary: truncate(originalRequirements?.scopeSummary, 900),
        features: take(originalRequirements?.features || originalRequirements?.systemFeatures, 12).map(compactFeature),
        userStories: take(originalRequirements?.userStories, 10).map(story => ({
            role: story?.role,
            action: story?.action,
            benefit: story?.benefit,
            acceptanceCriteria: take(story?.acceptanceCriteria, 5).map(item => truncate(item, 250)),
        })),
    },
    srsDraft: {
        projectTitle: srsContent?.projectTitle,
        introduction: {
            purpose: truncate(srsContent?.introduction?.purpose, 800),
            productScope: truncate(srsContent?.introduction?.productScope, 800),
        },
        productFunctions: take(srsContent?.overallDescription?.productFunctions, 10).map(item => truncate(item, 300)),
        systemFeatures: take(srsContent?.systemFeatures, 12).map(compactFeature),
        systemFeatureCount: Array.isArray(srsContent?.systemFeatures) ? srsContent.systemFeatures.length : 0,
        externalInterfaceRequirements: compactRequirementGroup(srsContent?.externalInterfaceRequirements),
        nonFunctionalRequirements: compactRequirementGroup(srsContent?.nonFunctionalRequirements),
        otherRequirements: take(srsContent?.otherRequirements, 8).map(item => truncate(item, 300)),
        glossary: take(srsContent?.glossary, 12).map(item => truncate(item, 250)),
        appendices: {
            tbdList: take(srsContent?.appendices?.tbdList, 12).map(item => truncate(item, 300)),
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
});

/**
 * Creates a compact snapshot of the SRS optimised for chat prompt injection.
 * Unlike createReviewSnapshot (which is for auditing), this snapshot is
 * structured for conversational Q&A and targeted edits. Stays well under 8K tokens.
 */
export const createChatSnapshot = (srsContent) => ({
    projectTitle: srsContent?.projectTitle,
    introduction: {
        purpose: truncate(srsContent?.introduction?.purpose, MAX_CHAT_TEXT),
        productScope: truncate(srsContent?.introduction?.productScope, MAX_CHAT_TEXT),
        intendedAudience: truncate(srsContent?.introduction?.intendedAudience, 500),
    },
    overallDescription: {
        productPerspective: truncate(srsContent?.overallDescription?.productPerspective, 800),
        productFunctions: take(srsContent?.overallDescription?.productFunctions, 10)
            .map(item => truncate(item, 300)),
        userClassesAndCharacteristics: take(srsContent?.overallDescription?.userClassesAndCharacteristics, 6)
            .map(uc => ({ userClass: uc?.userClass, characteristics: truncate(uc?.characteristics, 250) })),
    },
    systemFeatureCount: Array.isArray(srsContent?.systemFeatures) ? srsContent.systemFeatures.length : 0,
    systemFeatures: take(srsContent?.systemFeatures, 12).map(feature => ({
        name: feature?.name || feature?.featureName || 'Unnamed',
        priority: feature?.priority,
        description: truncate(feature?.description, 800),
        functionalRequirements: take(feature?.functionalRequirements, 8).map(r => truncate(r, 250)),
        functionalRequirementCount: Array.isArray(feature?.functionalRequirements) ? feature.functionalRequirements.length : 0,
    })),
    nonFunctionalRequirements: compactRequirementGroup(srsContent?.nonFunctionalRequirements),
    externalInterfaceRequirements: compactRequirementGroup(srsContent?.externalInterfaceRequirements),
    otherRequirements: take(srsContent?.otherRequirements, 6).map(item => truncate(item, 300)),
    glossary: take(srsContent?.glossary, 12).map(item => ({
        term: item?.term,
        definition: truncate(item?.definition, 200),
    })),
    appendices: {
        tbdList: take(srsContent?.appendices?.tbdList, 10).map(item => truncate(item, 250)),
        diagramCaptions: Object.fromEntries(
            Object.entries(srsContent?.appendices?.analysisModels || {}).map(([key, value]) => [
                key, { caption: value?.caption, hasCode: Boolean(value?.code) }
            ])
        ),
    },
});
