import logger from '../../config/logger.js';

export const FEATURE_CHUNK_SIZE = 2;

/**
 * Developer sectional generation. The SRS is written in ordered sections — shell → features
 * (in chunks) → requirements/glossary → appendices/diagrams — with provider-aware cooldowns
 * between calls (a no-op for paid/BYOK providers; see utils/throttle.js). Generating sectionally
 * keeps each call under the model's output-token ceiling and lets later sections reference the
 * earlier ones.
 *
 * Extracted verbatim from analysisService.performAnalysis (behavior unchanged).
 *
 * @param {object} p
 * @param {string} p.text
 * @param {object} p.poOutput
 * @param {object} p.archOutput
 * @param {Array}  p.featureList
 * @param {object} p.devAgent
 * @param {string} p.projectName
 * @param {string} p.promptVersion
 * @param {string} p.ragContext
 * @param {(ms:number)=>Promise<void>} p.sleep
 * @param {(stage:string,msg:string,extra?:object)=>void} p.emitProgress
 * @param {number} p.cooldownMs
 * @returns {Promise<{ srsShell, allFeatures, srsRequirements, srsAppendices, srsDraft }>}
 */
export async function generateSrsSections({
    text, poOutput, archOutput, featureList, devAgent,
    projectName, promptVersion, ragContext, sleep, emitProgress, cooldownMs
}) {
    // Resolve both system instructions in parallel — each triggers an async
    // getDiagramAuthorityPrompt() I/O call; running concurrently saves ~1 round-trip.
    const [developerSystemInstruction, appendicesSystemInstruction] = await Promise.all([
        devAgent.getSystemInstruction({ projectName, version: promptVersion }),
        devAgent.getSystemInstruction(
            { projectName, version: promptVersion },
            { profile: 'developer', noSchema: true }
        )
    ]);
    const developerPromptSettings = {
        projectName,
        version: promptVersion,
        ragContext,
        systemInstruction: developerSystemInstruction,
        appendicesSystemInstruction
    };

    logger.info("--> Agent: Developer (Sectional Generation: Shell)");
    emitProgress('developer_shell', 'Drafting the SRS shell (introduction, scope, overview)...');
    const srsShell = await devAgent.generateShell(text, poOutput, archOutput, developerPromptSettings);

    await sleep(cooldownMs); // Cooling period

    logger.info("--> Agent: Developer (Sectional Generation: Features)");
    emitProgress('developer_features', `Writing system features (0/${featureList.length})...`);
    let allFeatures = [];

    for (let i = 0; i < featureList.length; i += FEATURE_CHUNK_SIZE) {
        const chunk = featureList.slice(i, i + FEATURE_CHUNK_SIZE);
        logger.info(`    [Features] Processing chunk ${Math.floor(i / FEATURE_CHUNK_SIZE) + 1}/${Math.ceil(featureList.length / FEATURE_CHUNK_SIZE)}`);
        const featuresOutput = await devAgent.generateFeatures(text, srsShell, poOutput, archOutput, chunk, developerPromptSettings);
        if (featuresOutput.systemFeatures) {
            allFeatures = [...allFeatures, ...featuresOutput.systemFeatures];
        }
        emitProgress('developer_features', `Writing system features (${Math.min(i + FEATURE_CHUNK_SIZE, featureList.length)}/${featureList.length})...`);
        if (i + FEATURE_CHUNK_SIZE < featureList.length) {
            await sleep(cooldownMs); // Delay between feature chunks
        }
    }

    await sleep(cooldownMs); // Cooling period

    logger.info("--> Agent: Developer (Sectional Generation: Requirements & Glossary)");
    emitProgress('developer_requirements', 'Writing functional/non-functional requirements and glossary...');
    const sections1And2 = { ...srsShell, systemFeatures: allFeatures };
    const srsRequirements = await devAgent.generateRequirements(text, sections1And2, poOutput, archOutput, developerPromptSettings);

    await sleep(cooldownMs); // Cooling period

    logger.info("--> Agent: Developer (Sectional Generation: Appendices & Diagrams)");
    emitProgress('developer_appendices', 'Generating appendices and diagrams...');
    const sections123 = { ...sections1And2, ...srsRequirements };
    const srsAppendices = await devAgent.generateAppendices(text, sections123, poOutput, archOutput, developerPromptSettings);

    // STITCHING: Assemble the final draft
    const srsDraft = {
        ...srsShell,
        systemFeatures: allFeatures,
        ...srsRequirements,
        ...srsAppendices
    };

    return { srsShell, allFeatures, srsRequirements, srsAppendices, srsDraft };
}
