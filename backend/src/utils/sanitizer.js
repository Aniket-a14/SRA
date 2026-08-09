/**
 * Utility to redact PII (Personally Identifiable Information) from strings.
 * Used to sanitize user-generated requirements before sending them to external AI providers.
 */

const PII_PATTERNS = {
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    PHONE: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/g,
    // Octet-range-validated so version strings like 2.0.0.1 aren't mistaken for addresses.
    IPV4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    // Add more patterns as needed (e.g., SSN, Aadhaar, etc.)
};

/**
 * Redacts common PII from a text string.
 * @param {string} text - The text to sanitize.
 * @returns {string} - The sanitized text.
 */
export const sanitizePII = (text) => {
    if (!text || typeof text !== 'string') return text;

    let sanitized = text;

    sanitized = sanitized.replace(PII_PATTERNS.EMAIL, '[EMAIL_REDACTED]');
    sanitized = sanitized.replace(PII_PATTERNS.PHONE, '[PHONE_REDACTED]');
    sanitized = sanitized.replace(PII_PATTERNS.CREDIT_CARD, '[CREDIT_CARD_REDACTED]');
    sanitized = sanitized.replace(PII_PATTERNS.IPV4, '[IP_REDACTED]');

    return sanitized;
};

const MAX_SANITIZE_DEPTH = 20;

/**
 * Recursively sanitizes objects containing text.
 *
 * Depth-limited: an unbounded recursive walk over attacker-controlled JSON (thousands of
 * nested brackets) exhausts the call stack and crashes the process. Past the limit, the
 * subtree is returned as-is rather than sanitized — a request this deeply nested is not
 * legitimate input, and refusing to descend further beats a hard crash.
 */
export const sanitizeObject = (obj, currentDepth = 0) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (currentDepth >= MAX_SANITIZE_DEPTH) return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, currentDepth + 1));
    }

    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            newObj[key] = sanitizePII(value);
        } else if (typeof value === 'object') {
            newObj[key] = sanitizeObject(value, currentDepth + 1);
        } else {
            newObj[key] = value;
        }
    }
    return newObj;
};
