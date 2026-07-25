import fs from 'fs/promises';

export const SPEC_FILE = 'sra.spec.json';

/** Section kinds that carry requirements a local codebase can be traced against. */
const REQUIREMENT_KINDS = new Set(['feature-list', 'user-stories', 'requirement-group', 'shell-list']);

const randId = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const asArray = (v) => (Array.isArray(v) ? v : []);

/** Coerce a requirement item (IEEE string, Volere shell object, or story object) to a string. */
export function reqToString(item) {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
        if (item.description) return String(item.description);
        if (item.action || item.role) return `As a ${item.role || 'user'}, I want ${item.action || ''}${item.benefit ? `, so that ${item.benefit}` : ''}.`;
        if (item.requirement) return String(item.requirement);
    }
    return '';
}

/**
 * Give a requirement a stable object form (`{id, description, metadata}`).
 *
 * The pipeline emits requirements as bare strings; `sra review` needs somewhere to record
 * an approval. Ids embedded in the text ("SRA-FR-1.2: The system shall…") are reused so a
 * requirement keeps its identity across syncs rather than getting a fresh random one.
 */
export function normalizeRequirement(item) {
    if (item && typeof item === 'object' && item.description) {
        return { ...item, metadata: item.metadata || { verification_status: 'DRAFT_AI' } };
    }
    const description = reqToString(item);
    const match = description.match(/^([A-Z]+-[A-Z]+-\d+(?:\.\d+)?)/);
    return {
        id: match ? match[1] : `REQ-${randId()}`,
        description,
        metadata: { verification_status: 'DRAFT_AI' }
    };
}

const looksLikeFeature = (f) => f && typeof f === 'object' && ('functionalRequirements' in f || 'requirements' in f);

const makeEntry = ({ id, name, description = '', requirements, section, index = null, kind }) => ({
    id: id || `FEAT-${randId()}`,
    name,
    description,
    functionalRequirements: requirements,
    status: 'pending',
    verification_files: [],
    // Where this entry came from in resultJson. Push writes verification back here instead
    // of assuming IEEE's `systemFeatures` — which, on a Volere or Agile spec, would inject
    // a section the format does not have and that nothing on the website renders.
    source: { section, index, kind }
});

/**
 * Pull verifiable requirement groups out of a spec using the format's own descriptor.
 *
 * One entry per requirement *carrier*: a feature object for feature-list formats, the
 * whole section for flat formats (Volere shells, Agile stories), which keeps traceability
 * at the granularity a developer actually maps to files.
 */
function extractByDescriptor(srs, formatSpec) {
    const features = [];

    for (const section of asArray(formatSpec.sections)) {
        if (section.appendix || !REQUIREMENT_KINDS.has(section.kind)) continue;

        const value = srs[section.id];
        if (!value) continue;

        if (section.kind === 'feature-list') {
            asArray(value).forEach((f, index) => {
                if (!f || typeof f !== 'object') return;
                const requirements = asArray(f.functionalRequirements ?? f.requirements)
                    .map(reqToString)
                    .filter(Boolean);
                if (requirements.length === 0 && !f.name) return;

                features.push(makeEntry({
                    id: f.id,
                    name: f.name || f.title || `${section.title} ${index + 1}`,
                    description: f.description || '',
                    requirements,
                    section: section.id,
                    index,
                    kind: section.kind
                }));
            });
            continue;
        }

        // Flat carriers — the section itself is the unit.
        const requirements = asArray(value).map(reqToString).filter(Boolean);
        if (requirements.length === 0) continue;

        features.push(makeEntry({
            name: section.title,
            description: `${formatSpec.name || formatSpec.id} §${section.number || ''} ${section.title}`.trim(),
            requirements,
            section: section.id,
            kind: section.kind
        }));
    }

    return features;
}

/**
 * Shape-based extraction for when the platform's format descriptor is unavailable
 * (offline, or a backend without `GET /api/formats/:id`). Recognises the known section
 * names plus anything that structurally looks like a feature list.
 */
function extractByShape(srs) {
    const features = [];
    const seen = new Set();

    const featureSections = ['systemFeatures', 'systemFunctions', 'specificRequirements', 'features'];
    for (const key of Object.keys(srs)) {
        if (featureSections.includes(key)) continue;
        if (Array.isArray(srs[key]) && srs[key].some(looksLikeFeature)) featureSections.push(key);
    }

    for (const key of featureSections) {
        asArray(srs[key]).forEach((f, index) => {
            if (!looksLikeFeature(f)) return;
            const requirements = asArray(f.functionalRequirements ?? f.requirements).map(reqToString).filter(Boolean);
            if (requirements.length === 0 && !f.name) return;

            const name = f.name || f.title || `Feature ${features.length + 1}`;
            if (seen.has(name)) return;
            seen.add(name);

            features.push(makeEntry({
                id: f.id,
                name,
                description: f.description || '',
                requirements,
                section: key,
                index,
                kind: 'feature-list'
            }));
        });
    }

    const stories = asArray(srs.userStories).map(reqToString).filter(Boolean);
    if (stories.length > 0) {
        features.push(makeEntry({
            name: 'User Stories',
            description: 'Agile user stories.',
            requirements: stories,
            section: 'userStories',
            kind: 'user-stories'
        }));
    }

    if (features.length === 0) {
        for (const key of Object.keys(srs)) {
            if (!/requirement|functional/i.test(key)) continue;
            const value = srs[key];
            const flat = [];
            if (Array.isArray(value)) flat.push(...value.map(reqToString).filter(Boolean));
            else if (value && typeof value === 'object') {
                for (const sub of Object.values(value)) {
                    if (Array.isArray(sub)) flat.push(...sub.map(reqToString).filter(Boolean));
                }
            }
            if (flat.length > 0) {
                features.push(makeEntry({
                    name: key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim(),
                    requirements: flat,
                    section: key,
                    kind: 'requirement-group'
                }));
            }
        }
    }

    return features;
}

/**
 * Extract verifiable requirement groups from a generated spec.
 *
 * @param {object} srs - the analysis `resultJson`
 * @param {object|null} formatSpec - descriptor from `GET /api/formats/:id`, when reachable
 */
export function extractFeatures(srs, formatSpec = null) {
    if (!srs || typeof srs !== 'object') return [];

    if (formatSpec && Array.isArray(formatSpec.sections)) {
        const byDescriptor = extractByDescriptor(srs, formatSpec);
        // A descriptor that yields nothing means the stored document doesn't match the
        // format it claims (hand-edited, or generated before a spec change) — the shape
        // pass still finds the requirements rather than handing back an empty spec.
        if (byDescriptor.length > 0) return byDescriptor;
    }

    return extractByShape(srs);
}

/**
 * Carry local-only state across a re-sync. Verification files and review decisions live
 * only on disk, so a fresh pull must not wipe them; requirement *text* still comes from
 * the platform, which is the authority on content.
 */
export function mergeLocalState(fresh, existing = []) {
    const byId = new Map(existing.filter(f => f.id).map(f => [f.id, f]));
    const byName = new Map(existing.map(f => [f.name, f]));

    return fresh.map(feature => {
        const prior = byId.get(feature.id) || byName.get(feature.name);
        if (!prior) return feature;

        // Review decisions are keyed on requirement text: ids are regenerated for bare
        // strings, so matching on them would drop every approval on the next sync.
        const decisions = new Map();
        for (const req of asArray(prior.functionalRequirements)) {
            if (req && typeof req === 'object' && req.description && req.metadata) {
                decisions.set(req.description.trim(), req.metadata);
            }
        }

        const functionalRequirements = feature.functionalRequirements.map(req => {
            const text = reqToString(req).trim();
            const metadata = decisions.get(text);
            return metadata ? { ...normalizeRequirement(req), metadata } : req;
        });

        return {
            ...feature,
            functionalRequirements,
            verification_files: prior.verification_files || [],
            status: prior.status || 'pending'
        };
    });
}

export async function readSpec(file = SPEC_FILE) {
    const data = await fs.readFile(file, 'utf-8');
    return JSON.parse(data);
}

export async function writeSpec(spec, file = SPEC_FILE) {
    await fs.writeFile(file, `${JSON.stringify(spec, null, 2)}\n`);
}

export async function specExists(file = SPEC_FILE) {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
}
