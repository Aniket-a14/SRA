import { describe, it, expect, jest } from '@jest/globals';

/**
 * What the drafting panel is allowed to show.
 *
 * Two things made the appendices stage unreadable in production: every diagram carries a
 * `syntaxExplanation` describing Mermaid grammar rather than the product, and the appendices
 * prompt carries the whole document written so far — which a model extending it will
 * sometimes replay first, so the specification appeared to be written out a second time.
 */

const { createReadableTextExtractor } = await import('../../src/utils/jsonTextStream.js');
const { createTokenBroadcaster, DEDUPE_MIN_LENGTH } =
    await import('../../src/services/pipeline/tokenStream.js');

const extractAll = (json) => {
    const extractor = createReadableTextExtractor();
    return extractor.push(json);
};

describe('createReadableTextExtractor — diagram sections', () => {
    it('reads a caption but not the Mermaid source or its syntax notes', () => {
        const out = extractAll(JSON.stringify({
            appendices: {
                analysisModels: {
                    flowchartDiagram: {
                        syntaxExplanation: 'Nodes are declared with square brackets and joined with -->.',
                        code: 'flowchart TD\n  A[Login] --> B[Dashboard]',
                        caption: 'How a user reaches the dashboard.'
                    }
                }
            }
        }));

        expect(out).toContain('How a user reaches the dashboard.');
        expect(out).not.toContain('square brackets');
        expect(out).not.toContain('flowchart TD');
    });
});

describe('createTokenBroadcaster', () => {
    const feed = (broadcaster, json) => broadcaster.onStream({ type: 'delta', text: json });
    const published = (emit) => emit.mock.calls
        .filter(([, , extra]) => typeof extra?.token === 'string')
        .map(([, , extra]) => extra.token)
        .join('');

    it('shows a restated sentence once', () => {
        const emit = jest.fn();
        const broadcaster = createTokenBroadcaster(emit);
        const sentence = 'The system shall authenticate every request with a bearer token.';

        feed(broadcaster, JSON.stringify({ purpose: sentence, productScope: sentence }));
        broadcaster.flush();

        const text = published(emit);
        expect(text).toContain(sentence);
        expect(text.split(sentence).length - 1).toBe(1);
    });

    it('keeps short repeats, which are ordinary specification vocabulary', () => {
        const emit = jest.fn();
        const broadcaster = createTokenBroadcaster(emit);

        feed(broadcaster, JSON.stringify({ a: 'TBD', b: 'TBD', c: 'TBD' }));
        broadcaster.flush();

        const text = published(emit);
        expect(text.split('TBD').length - 1).toBe(3);
        expect('TBD'.length).toBeLessThan(DEDUPE_MIN_LENGTH);
    });

    it('lets a later section restate an earlier one', () => {
        const emit = jest.fn();
        const broadcaster = createTokenBroadcaster(emit);
        const sentence = 'Authentication is handled by the platform, not by each service.';

        feed(broadcaster, JSON.stringify({ purpose: sentence }));
        broadcaster.newDocument();
        feed(broadcaster, JSON.stringify({ purpose: sentence }));
        broadcaster.flush();

        // Only a section repeating *itself* is the echo this guards against — a genuine
        // cross-reference between sections is part of the document.
        expect(published(emit).split(sentence).length - 1).toBe(2);
    });

    it('marks a section boundary so a later retry cannot erase it', () => {
        const emit = jest.fn();
        const broadcaster = createTokenBroadcaster(emit);

        feed(broadcaster, JSON.stringify({ purpose: 'The shell is drafted first.' }));
        broadcaster.newDocument();

        expect(emit).toHaveBeenCalledWith('drafting', undefined, { sectionBreak: true });
    });

    it('rewinds only the current section when an attempt is abandoned', () => {
        const emit = jest.fn();
        const broadcaster = createTokenBroadcaster(emit);

        feed(broadcaster, JSON.stringify({ purpose: 'Settled text from an earlier section.' }));
        broadcaster.newDocument();
        feed(broadcaster, JSON.stringify({ purpose: 'A partial attempt that is about to fail.' }));
        broadcaster.onStream({ type: 'reset' });

        expect(emit).toHaveBeenCalledWith('drafting', undefined, { tokenReset: true });
        // The retry starts from an empty section, not an empty document — the reader keeps
        // what was already settled.
        feed(broadcaster, JSON.stringify({ purpose: 'A partial attempt that is about to fail.' }));
        broadcaster.flush();
        expect(published(emit)).toContain('A partial attempt that is about to fail.');
    });

    it('does not drop a repeated sentence that straddles two stream chunks', () => {
        const emit = jest.fn();
        const broadcaster = createTokenBroadcaster(emit);
        const json = JSON.stringify({ purpose: 'A single long sentence that arrives in pieces across the wire.' });

        for (let i = 0; i < json.length; i += 7) feed(broadcaster, json.slice(i, i + 7));
        broadcaster.flush();

        expect(published(emit)).toContain('A single long sentence that arrives in pieces across the wire.');
    });
});
