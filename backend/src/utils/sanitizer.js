/**
 * Utility to redact PII (Personally Identifiable Information) from strings.
 * Used to sanitize user-generated requirements before sending them to external AI providers.
 */

const PII_PATTERNS = {
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    PHONE: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    CREDIT_CARD: /\b(?:\d[ -]*?){13,16}\b/g,
    IPV4: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
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

/**
 * Recursively sanitizes objects containing text.
 */
export const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            newObj[key] = sanitizePII(value);
        } else if (typeof value === 'object') {
            newObj[key] = sanitizeObject(value);
        } else {
            newObj[key] = value;
        }
    }
    return newObj;
};
