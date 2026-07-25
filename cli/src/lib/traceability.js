import { CLI_VERSION } from './version.js';
import { reqToString } from './spec.js';

/**
 * Build the canonical, format-independent record of what the CLI verified locally.
 *
 * This is the payload the website renders for *every* format. Section-shaped writeback
 * (patching `verification_files` onto feature objects) only works where the format has
 * feature objects to patch; a Volere or Agile document has none, and inventing an IEEE
 * `systemFeatures` key to hold them would corrupt the document with a section the format
 * does not define and nothing renders.
 *
 * @param {object} spec - the local `sra.spec.json`
 * @returns {object} traceability record for `metadata.cliTraceability`
 */
export function buildTraceability(spec) {
    const groups = (spec.features || []).map(feature => ({
        id: feature.id,
        name: feature.name,
        section: feature.source?.section || null,
        index: feature.source?.index ?? null,
        kind: feature.source?.kind || null,
        status: feature.status || 'pending',
        verification_files: feature.verification_files || [],
        requirements: (feature.functionalRequirements || [])
            .filter(req => req && typeof req === 'object' && req.metadata)
            .map(req => ({
                id: req.id,
                description: reqToString(req),
                verification_status: req.metadata.verification_status,
                verifiedAt: req.metadata.verifiedAt,
                verifiedBy: req.metadata.verifiedBy
            }))
    }));

    const countBy = (predicate) => groups.filter(predicate).length;
    const allRequirements = groups.flatMap(g => g.requirements);

    return {
        updatedAt: new Date().toISOString(),
        cliVersion: CLI_VERSION,
        formatId: spec.formatId || null,
        summary: {
            groups: groups.length,
            verified: countBy(g => g.status === 'verified'),
            partial: countBy(g => g.status === 'partial'),
            failed: countBy(g => g.status === 'failed'),
            // `proposed` is a heuristic link from `sra reverse` that no one has confirmed
            // yet — kept distinct from `verified` so the website never presents a guess as
            // a checked fact.
            proposed: countBy(g => g.status === 'proposed'),
            pending: countBy(g => g.status === 'pending'),
            filesLinked: groups.reduce((n, g) => n + g.verification_files.length, 0),
            approved: allRequirements.filter(r => r.verification_status === 'APPROVED_HUMAN').length,
            rejected: allRequirements.filter(r => r.verification_status === 'REJECTED_HUMAN').length
        },
        groups
    };
}
