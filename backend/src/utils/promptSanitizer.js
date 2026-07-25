/**
 * Neutralizes prompt-injection vectors in untrusted values that get interpolated into
 * *system* instructions.
 *
 * The prompt templates delimit regions with XML-ish tags (`<context>`, `<input>`,
 * `<historical_patterns>`, `<system_extension>`, …). A value that can emit one of those tags —
 * or a bare newline followed by a forged directive — escapes its region and is then read with
 * system-level authority. `projectName` is the sharpest case: `aiService` lifts it straight out
 * of the user's raw input with a regex, and the v2_2_0 template interpolates it into instruction
 * sentences half a dozen times ("The project name is: **${projectName}** — immutable…").
 *
 * Two shapes of untrusted value, two treatments:
 *  - **labels** (`projectName`, `formatName`) — short and single-line; no markup, newline or
 *    control character is ever legitimate, so they are stripped outright.
 *  - **blocks** (`ragContext`, `systemPromptExtension`) — long-form prose that must keep its
 *    line structure, so structural tags are escaped rather than removed.
 */

/**
 * Structural tags in this codebase are all lowercase ASCII with underscores (`<system_extension>`,
 * `</historical_patterns>`). Matching only that shape leaves ordinary technical prose intact —
 * `a < b`, `<= 5` and capitalised JSX-ish `<Component>` are not delimiters and stay as written.
 */
const STRUCTURAL_TAG = /<(\/?[a-z][a-z_]*)>/g;

const DEFAULT_LABEL_MAX_LENGTH = 120;

/** C0 and C1 control ranges. Expressed as code points so no literal control byte sits in this file. */
const isControlChar = (code) => (code <= 0x1f) || (code >= 0x7f && code <= 0x9f);

/** Tab, line feed and carriage return carry meaning inside a prose block; nothing else does. */
const isStructuralWhitespace = (code) => code === 0x09 || code === 0x0a || code === 0x0d;

const stripControlChars = (value, { keepLineStructure }) => {
    let output = '';
    for (const char of value) {
        const code = char.codePointAt(0);
        if (!isControlChar(code)) {
            output += char;
        } else if (keepLineStructure && isStructuralWhitespace(code)) {
            output += char;
        } else if (!keepLineStructure) {
            // Collapsed away by the whitespace pass in sanitizePromptLabel.
            output += ' ';
        }
    }
    return output;
};

/**
 * Collapses an untrusted short label to a single safe line.
 * Returns `undefined` when nothing survives, so the caller's default (e.g. "Project") applies
 * instead of an empty string silently reaching the template.
 */
export const sanitizePromptLabel = (value, maxLength = DEFAULT_LABEL_MAX_LENGTH) => {
    if (typeof value !== 'string') return value;

    const cleaned = stripControlChars(value, { keepLineStructure: false })
        .replace(/[<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
        .trim();

    return cleaned || undefined;
};

/** Defangs delimiter forgery in a long-form untrusted block while preserving its prose. */
export const sanitizePromptBlock = (value) => {
    if (typeof value !== 'string') return value;

    return stripControlChars(value, { keepLineStructure: true })
        .replace(STRUCTURAL_TAG, '&lt;$1&gt;');
};

/**
 * Fills a `{{token}}` placeholder with untrusted text.
 *
 * `String.prototype.replace` expands `$&`, `$'`, `` $` `` and `$1` inside the *replacement*, so a
 * user whose project name contains `$&` would splice fragments of the template back into itself.
 * A replacer function performs no substitution at all.
 */
export const fillTemplate = (template, token, value) =>
    template.replaceAll(token, () => value);

/**
 * The single choke point for system-instruction construction (`constructMasterPrompt`).
 * Sanitizing here covers every agent that builds a system prompt — ArchitectAgent,
 * DeveloperAgent and aiService — rather than relying on each call site to remember.
 *
 * `formatGuidelines` is deliberately absent: it is generated server-side from the format
 * descriptor registry, not from user input.
 */
export const sanitizePromptSettings = (settings = {}) => {
    const sanitized = { ...settings };

    if ('projectName' in sanitized) sanitized.projectName = sanitizePromptLabel(sanitized.projectName);
    if ('formatName' in sanitized) sanitized.formatName = sanitizePromptLabel(sanitized.formatName);
    if ('ragContext' in sanitized) sanitized.ragContext = sanitizePromptBlock(sanitized.ragContext);
    if ('systemPromptExtension' in sanitized) {
        sanitized.systemPromptExtension = sanitizePromptBlock(sanitized.systemPromptExtension);
    }

    return sanitized;
};
