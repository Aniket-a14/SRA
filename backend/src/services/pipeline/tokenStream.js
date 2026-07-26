import { createReadableTextExtractor } from '../../utils/jsonTextStream.js';

// Coalesced before publishing: one Redis command per token would cost far more than the effect.
export const TOKEN_FLUSH_MS = 180;
export const TOKEN_FLUSH_CHARS = 140;

export function createTokenBroadcaster(emitProgress, stage = 'drafting') {
    const extractor = createReadableTextExtractor();
    let buffer = '';
    let timer = null;

    const clear = () => {
        if (timer) { clearTimeout(timer); timer = null; }
    };

    const flush = () => {
        clear();
        if (!buffer) return;
        emitProgress(stage, undefined, { token: buffer });
        buffer = '';
    };

    const onStream = (event) => {
        if (event.type === 'reset') {
            extractor.reset();
            buffer = '';
            clear();
            emitProgress(stage, undefined, { tokenReset: true });
            return;
        }

        const readable = extractor.push(event.text);
        if (!readable) return;

        buffer += readable;
        if (buffer.length >= TOKEN_FLUSH_CHARS) flush();
        else if (!timer) timer = setTimeout(flush, TOKEN_FLUSH_MS);
    };

    /** New section: clears scanner state but keeps what is already on screen (unlike a reset). */
    const newDocument = () => {
        flush();
        extractor.reset();
    };

    return { onStream, flush, clear, newDocument };
}
