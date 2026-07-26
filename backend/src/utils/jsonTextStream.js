// Pulls readable prose out of a JSON token stream — string values only, never keys or syntax.

/** Keys whose values are machine data or diagram source, not something to read. */
const DEFAULT_SKIP_KEYS = new Set([
    'id', 'type', 'code', 'priority', 'severity', 'category',
    'status', 'version', 'date', 'author', 'appliesTo'
]);

const ESCAPES = { n: '\n', t: ' ', r: '', b: '', f: '', '"': '"', '\\': '\\', '/': '/' };

export function createReadableTextExtractor({ skipKeys = DEFAULT_SKIP_KEYS } = {}) {
    let stack, inString, isKey, emitting, keyBuf, escaped, uniRemaining, uniBuf;

    const reset = () => {
        stack = [];
        inString = false;
        isKey = false;
        emitting = false;
        keyBuf = '';
        escaped = false;
        uniRemaining = 0;
        uniBuf = '';
    };
    reset();

    const top = () => stack[stack.length - 1];
    /** An array inherits the key that introduced it, so `["The system shall…"]` still reads. */
    const activeKey = () => top()?.key ?? null;

    const push = (chunk) => {
        if (!chunk) return '';
        let out = '';

        for (const ch of chunk) {
            if (inString) {
                if (uniRemaining > 0) {
                    uniBuf += ch;
                    if (--uniRemaining === 0) {
                        const decoded = String.fromCharCode(parseInt(uniBuf, 16));
                        uniBuf = '';
                        if (isKey) keyBuf += decoded;
                        else if (emitting) out += decoded;
                    }
                    continue;
                }
                if (escaped) {
                    escaped = false;
                    if (ch === 'u') { uniRemaining = 4; continue; }
                    const decoded = ESCAPES[ch] ?? ch;
                    if (isKey) keyBuf += decoded;
                    else if (emitting) out += decoded;
                    continue;
                }
                if (ch === '\\') { escaped = true; continue; }
                if (ch === '"') {
                    inString = false;
                    if (isKey) {
                        const frame = top();
                        if (frame) frame.key = keyBuf;
                        keyBuf = '';
                    } else if (emitting) {
                        out += '\n';
                        emitting = false;
                    }
                    continue;
                }
                if (isKey) keyBuf += ch;
                else if (emitting) out += ch;
                continue;
            }

            switch (ch) {
                case '"': {
                    inString = true;
                    const frame = top();
                    isKey = frame?.type === 'object' && frame.awaitingKey;
                    if (isKey) keyBuf = '';
                    else {
                        const key = activeKey();
                        emitting = !!key && !skipKeys.has(key);
                    }
                    break;
                }
                case '{':
                    stack.push({ type: 'object', key: null, awaitingKey: true });
                    break;
                case '[':
                    stack.push({ type: 'array', key: activeKey() });
                    break;
                case '}':
                case ']':
                    stack.pop();
                    break;
                case ':': {
                    const frame = top();
                    if (frame?.type === 'object') frame.awaitingKey = false;
                    break;
                }
                case ',': {
                    const frame = top();
                    if (frame?.type === 'object') { frame.awaitingKey = true; frame.key = null; }
                    break;
                }
                default:
                    break;
            }
        }

        return out;
    };

    return { push, reset };
}
