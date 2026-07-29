import { createReadableTextExtractor } from '../../utils/jsonTextStream.js';

// Coalesced before publishing: one Redis command per token would cost far more than the effect.
export const TOKEN_FLUSH_MS = 180;
export const TOKEN_FLUSH_CHARS = 140;

/**
 * Below this length a repeated line is ordinary specification vocabulary — "TBD", "High",
 * a requirement id, a role name — and dropping it would corrupt the text. Above it, the same
 * sentence twice in one section is the model restating its input, not the document.
 */
export const DEDUPE_MIN_LENGTH = 40;

/** Bounds the memory a very long section can cost; far above any real section's line count. */
const MAX_TRACKED_LINES = 4000;

const canonical = (line) => line.trim().toLowerCase().replace(/\s+/g, ' ');

export function createTokenBroadcaster(emitProgress, stage = 'drafting') {
    const extractor = createReadableTextExtractor();
    let buffer = '';
    let timer = null;
    // Lines already sent for the section being drafted. The appendices prompt carries the
    // whole document written so far, and a model asked to extend it will sometimes replay it
    // first — which arrived on screen as the spec being written out a second time, at speed.
    let seen = new Set();
    let partial = '';

    const clear = () => {
        if (timer) { clearTimeout(timer); timer = null; }
    };

    const flush = () => {
        clear();
        if (!buffer) return;
        emitProgress(stage, undefined, { token: buffer });
        buffer = '';
    };

    /** Keep each line's first appearance in this section and drop the restatements. */
    const withoutRepeats = (readable) => {
        const lines = (partial + readable).split('\n');
        partial = lines.pop() ?? '';

        let kept = '';
        for (const line of lines) {
            const key = canonical(line);
            if (key.length >= DEDUPE_MIN_LENGTH) {
                if (seen.has(key)) continue;
                if (seen.size < MAX_TRACKED_LINES) seen.add(key);
            }
            kept += line + '\n';
        }
        return kept;
    };

    const onStream = (event) => {
        if (event.type === 'reset') {
            extractor.reset();
            buffer = '';
            partial = '';
            seen = new Set();
            clear();
            emitProgress(stage, undefined, { tokenReset: true });
            return;
        }

        const readable = extractor.push(event.text);
        if (!readable) return;

        buffer += withoutRepeats(readable);
        if (!buffer) return;
        if (buffer.length >= TOKEN_FLUSH_CHARS) flush();
        else if (!timer) timer = setTimeout(flush, TOKEN_FLUSH_MS);
    };

    /**
     * New section: clears scanner state but keeps what is already on screen (unlike a reset).
     * The repeat filter is per-section — a later section may legitimately restate an earlier
     * one, and only a section repeating *itself* is the echo this guards against.
     */
    const newDocument = () => {
        if (partial) { buffer += partial; partial = ''; }
        flush();
        extractor.reset();
        seen = new Set();
        // Marks everything sent so far as settled. A retry inside the *next* section then
        // rewinds only that section: `reset` used to clear the reader's whole document, so
        // one rate-limited call late in the run erased four minutes of visible drafting.
        emitProgress(stage, undefined, { sectionBreak: true });
    };

    return { onStream, flush, clear, newDocument };
}
