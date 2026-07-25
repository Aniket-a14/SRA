import { api, describeError } from '../api/api-client.js';
import { logger } from '../utils/logger.js';

export const DEFAULT_FORMAT_ID = 'ieee830';

/**
 * Last-resort format list.
 *
 * The platform's registry at `GET /api/formats` is the source of truth — this exists only
 * so `sra formats` and `sra analyze --format` still work offline or against a backend that
 * predates that endpoint. Ids, not section layouts: a stale layout would silently produce
 * a wrong round-trip, whereas a stale id list just means a newer format isn't offered.
 */
export const FALLBACK_FORMATS = Object.freeze([
    { id: 'ieee830', name: 'IEEE 830-1998', description: 'Classic Software Requirements Specification.', tier: 'detailed' },
    { id: 'iso29148', name: 'ISO/IEC/IEEE 29148:2018', description: 'Modern systems & software requirements engineering.', tier: 'detailed' },
    { id: 'volere', name: 'Volere', description: 'Requirements shells with fit criteria.', tier: 'light' },
    { id: 'agile-prd', name: 'Agile PRD', description: 'Product requirements doc with user stories.', tier: 'light' }
]);

const unwrap = (response) => response?.data ?? response;

/** Format ids and names the platform can generate. Falls back to the built-in list. */
export async function fetchFormats() {
    try {
        const payload = unwrap(await api.get('/api/formats'));
        const formats = payload?.formats;
        if (Array.isArray(formats) && formats.length > 0) {
            return { formats, defaultFormatId: payload.defaultFormatId || DEFAULT_FORMAT_ID, live: true };
        }
    } catch (error) {
        logger.debug(`Format registry unavailable (${describeError(error)}); using the built-in list.`);
    }
    return { formats: [...FALLBACK_FORMATS], defaultFormatId: DEFAULT_FORMAT_ID, live: false };
}

/**
 * Full descriptor for one format — sections, their kinds, and the requirement model.
 *
 * This is what lets `sync`/`push` round-trip a spec without hardcoding IEEE's section
 * names. Returns null when unavailable so callers can fall back to shape heuristics
 * rather than failing outright.
 */
export async function fetchFormatSpec(formatId) {
    if (!formatId) return null;
    try {
        return unwrap(await api.get(`/api/formats/${encodeURIComponent(formatId)}`));
    } catch (error) {
        logger.debug(`Descriptor for '${formatId}' unavailable (${describeError(error)}); falling back to shape detection.`);
        return null;
    }
}
