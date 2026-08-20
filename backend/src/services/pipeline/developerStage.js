import logger from '../../config/logger.js';
import { createTokenBroadcaster } from './tokenStream.js';

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
    // Warms devAgent's per-run system-instruction cache for both variants before the
    // sequential sectional calls below — each miss triggers an async getDiagramAuthorityPrompt()
    // I/O call, so resolving both concurrently here saves ~1 round-trip versus letting the
    // first shell call and the first appendices call each pay for their own miss in series.
    // The sectional methods always re-derive their own instruction via getSystemInstruction
    // (a cache hit after this) rather than accepting one as a settings override — that override
    // was a way to bypass constructMasterPrompt's sanitizePromptSettings choke point.
    await Promise.all([
        devAgent.getSystemInstruction({ projectName, version: promptVersion }),
        devAgent.getSystemInstruction(
            { projectName, version: promptVersion },
            { profile: 'developer', noSchema: true }
        )
    ]);
    // Relays the prose out of each section's JSON token stream to the live progress channel.
    const tokens = createTokenBroadcaster(emitProgress);
    const developerPromptSettings = {
        projectName,
        version: promptVersion,
        ragContext,
        onStream: tokens.onStream
    };

    try {
        logger.info("--> Agent: Developer (Sectional Generation: Shell)");
        emitProgress('developer_shell', 'Drafting the SRS shell (introduction, scope, overview)...');
        tokens.newDocument();
        const srsShell = await devAgent.generateShell(text, poOutput, archOutput, developerPromptSettings);

        await sleep(cooldownMs); // Cooling period

        logger.info("--> Agent: Developer (Sectional Generation: Features)");
        emitProgress('developer_features', `Writing system features (0/${featureList.length})...`);
        let allFeatures = [];

        for (let i = 0; i < featureList.length; i += FEATURE_CHUNK_SIZE) {
            const chunk = featureList.slice(i, i + FEATURE_CHUNK_SIZE);
            logger.info(`    [Features] Processing chunk ${Math.floor(i / FEATURE_CHUNK_SIZE) + 1}/${Math.ceil(featureList.length / FEATURE_CHUNK_SIZE)}`);
            tokens.newDocument();
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
        tokens.newDocument();
        const sections1And2 = { ...srsShell, systemFeatures: allFeatures };
        const srsRequirements = await devAgent.generateRequirements(text, sections1And2, poOutput, archOutput, developerPromptSettings);

        await sleep(cooldownMs); // Cooling period

        logger.info("--> Agent: Developer (Sectional Generation: Appendices & Diagrams)");
        emitProgress('developer_appendices', 'Generating appendices and diagrams...');
        tokens.newDocument();
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
    } finally {
        // A pending flush timer would hold the worker's event loop open past the stage.
        tokens.clear();
    }
}
