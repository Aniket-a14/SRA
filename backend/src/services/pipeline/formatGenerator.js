import logger from '../../config/logger.js';
import { getGenerationChunks } from '../../formats/index.js';

/**
 * Descriptor-driven generation for non-legacy formats (ISO 29148, Volere, Agile PRD).
 *
 * The document is produced chunk-by-chunk (spec.chunks) with provider-aware cooldowns between
 * calls, each chunk constrained to the format's schema and guided by the format's section
 * guidelines. Prior chunks are threaded forward as context so later sections stay consistent.
 * Returns a flat object keyed by the format's section ids, tagged with formatId/formatName.
 *
 * @param {object} p
 * @param {object} p.spec
 * @param {string} p.text
 * @param {object} p.poOutput
 * @param {object} p.archOutput  - null for light-tier formats
 * @param {object} p.devAgent
 * @param {string} p.projectName
 * @param {string} p.promptVersion
 * @param {string} p.ragContext
 * @param {(ms:number)=>Promise<void>} p.sleep
 * @param {(stage:string,msg:string,extra?:object)=>void} p.emitProgress
 * @param {number} p.cooldownMs
 * @returns {Promise<object>} the assembled format-shaped document
 */
export async function generateFormatDoc({
    spec, text, poOutput, archOutput, devAgent,
    projectName, promptVersion, ragContext, sleep, emitProgress, cooldownMs
}) {
    const chunks = getGenerationChunks(spec);
    let doc = {};

    for (let i = 0; i < chunks.length; i++) {
        const sectionIds = chunks[i];
        logger.info(`--> Agent: Developer (${spec.name} chunk ${i + 1}/${chunks.length}: ${sectionIds.join(', ')})`);
        emitProgress('developer_format', `Drafting ${spec.name} document (section group ${i + 1}/${chunks.length})...`);

        const chunkResult = await devAgent.generateFormatChunk(text, {
            spec,
            sectionIds,
            poOutput,
            architecture: archOutput,
            priorSections: doc,
            settings: { projectName, version: promptVersion, ragContext }
        });

        // Merge chunk sections into the growing document (top-level keyed by section id).
        doc = { ...doc, ...chunkResult };

        if (i + 1 < chunks.length) await sleep(cooldownMs);
    }

    doc.formatId = spec.id;
    doc.formatName = spec.name;
    return doc;
}

/**
 * Lightweight quality audit for detailed non-legacy formats. Runs the Reviewer + Critic once
 * to produce a benchmark score, WITHOUT the IEEE-coupled surgical refinement loop (that loop
 * targets Shell/Features/Requirements/Appendices, which only exist in the IEEE shape). Format
 * generation is schema-constrained so it does not need the same syntactic repair passes.
 *
 * @returns {Promise<object|null>} the Critic audit (finalIndustryAudit shape) or null
 */
export async function auditFormatDoc({ spec, poOutput, doc, agents, sleep, emitProgress, reflectionCooldownMs }) {
    const { qaAgent, criticAgent } = agents;
    try {
        await sleep(reflectionCooldownMs);
        emitProgress('reflection', `Auditing ${spec.name} quality...`);
        const [review, audit] = await Promise.all([
            qaAgent.reviewSRS(poOutput, doc).catch(() => null),
            criticAgent.auditSRS(poOutput, doc).catch(() => null)
        ]);
        if (review) logger.info(`    [${spec.name}] Reviewer status: ${review.status}`);
        if (audit) logger.info(`    [${spec.name}] Quality score: ${audit.overallScore}`);
        return audit;
    } catch (err) {
        logger.warn(`[Format Audit] Non-fatal audit failure for ${spec.name}: ${err.message}`);
        return null;
    }
}
