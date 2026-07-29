import logger from '../../config/logger.js';
import { getGenerationChunks } from '../../formats/index.js';
import { normalizeFormatDoc } from '../../formats/normalize.js';
import { createTokenBroadcaster } from './tokenStream.js';
import { normalizeScore } from './reflectionStage.js';

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
    const tokens = createTokenBroadcaster(emitProgress);
    let doc = {};

    try {
        for (let i = 0; i < chunks.length; i++) {
            const sectionIds = chunks[i];
            logger.info(`--> Agent: Developer (${spec.name} chunk ${i + 1}/${chunks.length}: ${sectionIds.join(', ')})`);
            emitProgress('developer_format', `Drafting ${spec.name} document (section group ${i + 1}/${chunks.length})...`);
            tokens.newDocument();

            const chunkResult = await devAgent.generateFormatChunk(text, {
                spec,
                sectionIds,
                poOutput,
                architecture: archOutput,
                priorSections: doc,
                settings: { projectName, version: promptVersion, ragContext, onStream: tokens.onStream }
            });

            // Merge chunk sections into the growing document (top-level keyed by section id).
            doc = { ...doc, ...chunkResult };

            if (i + 1 < chunks.length) await sleep(cooldownMs);
        }
    } finally {
        tokens.clear();
    }

    // Canonicalise attributes the schema can only *ask* for — the non-Gemini providers get no
    // responseSchema at all, so without this the verification column mixes spellings.
    doc = normalizeFormatDoc(doc, spec);

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
            // The spec is passed so the reviewers judge the document against its own method —
            // without it they default to IEEE 830 and mark a Volere shell or a PRD down for
            // not carrying section numbering that method never defined.
            qaAgent.reviewSRS(poOutput, doc, spec).catch(() => null),
            criticAgent.auditSRS(poOutput, doc, spec).catch(() => null)
        ]);
        if (review) logger.info(`    [${spec.name}] Reviewer status: ${review.status}`);
        // Same rescale as the IEEE loop. Nothing gates on the score here, but it is published
        // as the document's quality benchmark, and "0.86" on that badge is simply wrong.
        if (audit) {
            const score = normalizeScore(audit.overallScore, audit.scores);
            if (score !== null) audit.overallScore = score;
            logger.info(`    [${spec.name}] Quality score: ${score ?? 'unavailable'}`);
        }
        return audit;
    } catch (err) {
        logger.warn(`[Format Audit] Non-fatal audit failure for ${spec.name}: ${err.message}`);
        return null;
    }
}
