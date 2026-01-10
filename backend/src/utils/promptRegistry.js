
const registry = new Map();

export const registerPromptVersion = (version, generatorFn) => {
    registry.set(version, generatorFn);
};

export const getPromptByVersion = (version) => {
    if (!registry.has(version)) {
        throw new Error(`Prompt version ${version} not found`);
    }
    return registry.get(version);
};

export const getLatestVersion = () => {
    // Simple semantic version sort or hardcoded latest
    // For now, return the last registered
    const keys = Array.from(registry.keys());
    return keys[keys.length - 1]; // Naive latest
};

export const listVersions = () => Array.from(registry.keys());
