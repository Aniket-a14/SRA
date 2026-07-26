import { createReadableTextExtractor } from '../../src/utils/jsonTextStream.js';

/** Feed a whole document through as one chunk. */
const readAll = (json, options) => createReadableTextExtractor(options).push(json);

/** Feed the same document one character at a time — what the network actually does. */
const readByChar = (json, options) => {
    const extractor = createReadableTextExtractor(options);
    return [...json].map(ch => extractor.push(ch)).join('');
};

describe('createReadableTextExtractor', () => {
    it('returns string values and none of the surrounding JSON syntax', () => {
        const json = '{"name":"Secure Upload","description":"Accepts files."}';
        expect(readAll(json)).toBe('Secure Upload\nAccepts files.\n');
    });

    it('never emits a key, only what the key holds', () => {
        // Keys and values are both quoted strings; confusing them prints the schema at the reader.
        const out = readAll('{"purpose":"State the goal."}');
        expect(out).not.toContain('purpose');
        expect(out).toBe('State the goal.\n');
    });

    it('skips machine fields and diagram source', () => {
        const json = '{"id":"FTP-REQ-001","code":"graph TD; A-->B","name":"Upload"}';
        expect(readAll(json)).toBe('Upload\n');
    });

    it('carries the enclosing key into an array of plain strings', () => {
        // Bare strings in a list have no key of their own; without inheriting one they are lost.
        const json = '{"functionalRequirements":["The system shall log in.","The system shall log out."]}';
        expect(readAll(json)).toBe('The system shall log in.\nThe system shall log out.\n');
    });

    it('reads nested arrays of objects', () => {
        const json = '{"systemFeatures":[{"id":"F-1","name":"Upload","description":"Accepts files."},{"id":"F-2","name":"Export"}]}';
        expect(readAll(json)).toBe('Upload\nAccepts files.\nExport\n');
    });

    it('produces identical output when the document is split at every character', () => {
        // Real chunk boundaries land mid-key, mid-string and mid-escape; none may change the output.
        const json ='{"introduction":{"purpose":"A goal.","productScope":"In scope: X. Out: Y."},"glossary":[{"term":"SRS","definition":"Software Requirements Specification"}]}';
        expect(readByChar(json)).toBe(readAll(json));
        expect(readAll(json)).toBe('A goal.\nIn scope: X. Out: Y.\nSRS\nSoftware Requirements Specification\n');
    });

    it('decodes escapes rather than printing them', () => {
        const json = String.raw`{"description":"Line one\nLine two \"quoted\" and é"}`;
        expect(readAll(json)).toBe('Line one\nLine two "quoted" and é\n');
    });

    it('does not mistake an escaped quote for the end of a value', () => {
        const json = String.raw`{"name":"He said \"go\"","id":"X-1"}`;
        expect(readAll(json)).toBe('He said "go"\n');
    });

    it('emits nothing for text arriving before any object is open', () => {
        // A stray fence or leading newline must not be rendered as part of the document.
        expect(readAll('```json\n{"name":"Upload"}')).toBe('Upload\n');
    });

    it('reset() clears scanner state so a new section starts clean', () => {
        const extractor = createReadableTextExtractor();
        extractor.push('{"description":"An unfinished sentence');
        extractor.reset();
        expect(extractor.push('{"name":"Fresh"}')).toBe('Fresh\n');
    });

    it('honours a caller-supplied skip list', () => {
        const out = readAll('{"name":"Upload","description":"Accepts files."}', { skipKeys: new Set(['description']) });
        expect(out).toBe('Upload\n');
    });
});
