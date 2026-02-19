import crypto from 'crypto';
import logger from '../config/logger.js';

/**
 * Data Encryption Utilities
 * Provides field-level encryption for sensitive data
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = process.env.ENCRYPTION_SALT;

/**
 * Derive encryption key from master secret
 */
function deriveKey(masterSecret) {
    return crypto.scryptSync(masterSecret, SALT, KEY_LENGTH);
}

/**
 * Encrypt sensitive data
 * @param {string} plaintext - Data to encrypt
 * @param {string} masterSecret - Master encryption key from env
 * @returns {string} Base64 encoded encrypted data with IV and auth tag
 */
export function encryptData(plaintext, masterSecret = process.env.ENCRYPTION_KEY) {
    if (!masterSecret) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    if (!plaintext) {
        return null;
    }

    try {
        // Generate random IV
        const iv = crypto.randomBytes(IV_LENGTH);

        // Derive key
        const key = deriveKey(masterSecret);

        // Create cipher
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        // Encrypt data
        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final()
        ]);

        // Get authentication tag
        const authTag = cipher.getAuthTag();

        // Combine IV + auth tag + encrypted data
        const combined = Buffer.concat([iv, authTag, encrypted]);

        // Return as base64
        return combined.toString('base64');
    } catch (error) {
        logger.error({ msg: 'Encryption failed', error: error.message });
        throw new Error('Failed to encrypt data');
    }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} masterSecret - Master encryption key from env
 * @returns {string} Decrypted plaintext
 */
export function decryptData(encryptedData, masterSecret = process.env.ENCRYPTION_KEY) {
    if (!masterSecret) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    if (!encryptedData) {
        return null;
    }

    try {
        // Decode from base64
        const combined = Buffer.from(encryptedData, 'base64');

        // Extract IV, auth tag, and encrypted data
        const iv = combined.slice(0, IV_LENGTH);
        const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

        // Derive key
        const key = deriveKey(masterSecret);

        // Create decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        // Decrypt data
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        return decrypted.toString('utf8');
    } catch (error) {
        logger.error({ msg: 'Decryption failed', error: error.message });
        throw new Error('Failed to decrypt data');
    }
}

/**
 * Hash sensitive data (one-way, for passwords, etc.)
 * @param {string} data - Data to hash
 * @param {string} salt - Optional salt (auto-generated if not provided)
 * @returns {object} { hash, salt }
 */
export function hashData(data, salt = null) {
    if (!data) {
        throw new Error('Data is required for hashing');
    }

    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512').toString('hex');

    return { hash, salt: actualSalt };
}

/**
 * Verify hashed data
 * @param {string} data - Plain data to verify
 * @param {string} hash - Stored hash
 * @param {string} salt - Salt used for hashing
 * @returns {boolean} True if data matches hash
 */
export function verifyHash(data, hash, salt) {
    const { hash: computedHash } = hashData(data, salt);
    return computedHash === hash;
}

/**
 * Encrypt object fields selectively
 * @param {object} obj - Object to encrypt
 * @param {string[]} fields - Fields to encrypt
 * @returns {object} Object with encrypted fields
 */
export function encryptObjectFields(obj, fields) {
    const encrypted = { ...obj };

    for (const field of fields) {
        if (encrypted[field]) {
            encrypted[field] = encryptData(encrypted[field]);
        }
    }

    return encrypted;
}

/**
 * Decrypt object fields selectively
 * @param {object} obj - Object to decrypt
 * @param {string[]} fields - Fields to decrypt
 * @returns {object} Object with decrypted fields
 */
export function decryptObjectFields(obj, fields) {
    const decrypted = { ...obj };

    for (const field of fields) {
        if (decrypted[field]) {
            try {
                decrypted[field] = decryptData(decrypted[field]);
            } catch (error) {
                logger.error({ msg: `Failed to decrypt field ${field}`, error: error.message });
                // Keep encrypted value if decryption fails
            }
        }
    }

    return decrypted;
}

/**
 * Generate secure random token
 * @param {number} length - Token length in bytes (default: 32)
 * @returns {string} Hex-encoded random token
 */
export function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Mask sensitive data for logging
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of characters to show at start/end
 * @returns {string} Masked data
 */
export function maskSensitiveData(data, visibleChars = 4) {
    if (!data || data.length <= visibleChars * 2) {
        return '***';
    }

    const start = data.slice(0, visibleChars);
    const end = data.slice(-visibleChars);
    const masked = '*'.repeat(Math.min(data.length - visibleChars * 2, 10));

    return `${start}${masked}${end}`;
}

/**
 * Example usage for encrypting user PII
 */
export function encryptUserPII(user) {
    const sensitiveFields = ['email', 'phone', 'address'];
    return encryptObjectFields(user, sensitiveFields);
}

/**
 * Example usage for decrypting user PII
 */
export function decryptUserPII(encryptedUser) {
    const sensitiveFields = ['email', 'phone', 'address'];
    return decryptObjectFields(encryptedUser, sensitiveFields);
}
