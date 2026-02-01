# Field-Level Encryption Documentation

## Overview
SRA uses AES-256-GCM encryption for sensitive data at rest to protect user privacy and comply with security best practices.

## Encryption Implementation

### Encryption Service
**Location:** `backend/src/utils/dataEncryption.js`

The encryption service provides two main functions:
- `encryptData(plaintext)` - Encrypts sensitive data
- `decryptData(encryptedData)` - Decrypts encrypted data

### Algorithm Details
- **Algorithm:** AES-256-GCM (Galois/Counter Mode)
- **Key Size:** 256 bits (32 bytes)
- **IV (Initialization Vector):** 16 bytes (randomly generated per encryption)
- **Authentication:** Built-in authentication tag for integrity verification

## Encrypted Fields

### User Table
| Field | Encrypted | Reason |
|-------|-----------|--------|
| `email` | ❌ No | Used for lookups and authentication |
| `password` | ❌ No | Hashed with bcrypt (not encrypted) |
| `name` | ⚠️ Conditional | Encrypted if contains PII patterns |
| `image` | ❌ No | Public URL |

### Account Table (OAuth)
| Field | Encrypted | Reason |
|-------|-----------|--------|
| `access_token` | ✅ Yes | Sensitive OAuth credential |
| `refresh_token` | ✅ Yes | Sensitive OAuth credential |
| `provider` | ❌ No | Non-sensitive metadata |
| `providerAccountId` | ❌ No | Non-sensitive identifier |

### Session Table
| Field | Encrypted | Reason |
|-------|-----------|--------|
| `token` | ❌ No | Hashed (not encrypted) |
| `ipAddress` | ✅ Yes | PII - user location data |
| `location` | ✅ Yes | PII - user location data |
| `userAgent` | ❌ No | Non-sensitive metadata |

### Analysis Table
| Field | Encrypted | Reason |
|-------|-----------|--------|
| `inputText` | ⚠️ Sanitized | PII removed before storage, not encrypted |
| `resultJson` | ❌ No | Operational data, no PII |
| `generatedCode` | ❌ No | Generated content, no PII |
| `metadata` | ❌ No | Non-sensitive metadata |

## Environment Variables

### Required Keys
```bash
# Master encryption key (32 bytes hex-encoded)
ENCRYPTION_KEY=<64-character-hex-string>

# Backup encryption key (separate for backup files)
BACKUP_ENCRYPTION_KEY=<64-character-hex-string>
```

### Key Generation
```bash
# Generate a secure 256-bit encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Usage Examples

### Encrypting Data
```javascript
import { encryptData } from './utils/dataEncryption.js';

// Encrypt sensitive data before storing
const sensitiveData = "user@example.com's IP: 192.168.1.1";
const encrypted = encryptData(sensitiveData);

// Store encrypted object in database
await prisma.session.create({
  data: {
    ipAddress: JSON.stringify(encrypted),
    // ... other fields
  }
});
```

### Decrypting Data
```javascript
import { decryptData } from './utils/dataEncryption.js';

// Retrieve encrypted data from database
const session = await prisma.session.findUnique({ where: { id } });

// Decrypt when needed
const encryptedData = JSON.parse(session.ipAddress);
const decrypted = decryptData(encryptedData);
```

## Key Rotation Procedure

### When to Rotate
- **Scheduled:** Every 90 days (see OPERATIONS.md)
- **Emergency:** Immediately upon suspected compromise
- **Compliance:** As required by security audits

### Rotation Steps

1. **Generate New Key**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Update Environment Variables**
   ```bash
   # Add new key to environment
   export ENCRYPTION_KEY_NEW=<new-key>
   
   # Update Vercel secrets
   vercel env add ENCRYPTION_KEY production
   ```

3. **Re-encrypt Existing Data**
   ```bash
   # Run migration script
   node scripts/rotate-encryption-key.js --old-key $ENCRYPTION_KEY --new-key $ENCRYPTION_KEY_NEW
   ```

4. **Verify Migration**
   ```bash
   # Test decryption with new key
   node scripts/verify-encryption.js
   ```

5. **Update Production**
   ```bash
   # Deploy with new key
   vercel --prod
   ```

## Security Best Practices

### ✅ Do's
- ✅ Store encryption keys in secure environment variables
- ✅ Use separate keys for different purposes (data vs backups)
- ✅ Rotate keys regularly (every 90 days)
- ✅ Generate keys using cryptographically secure random sources
- ✅ Encrypt all PII (IP addresses, location data, OAuth tokens)
- ✅ Use authenticated encryption (GCM mode)

### ❌ Don'ts
- ❌ Never commit encryption keys to version control
- ❌ Never log decrypted sensitive data
- ❌ Never reuse initialization vectors (IVs)
- ❌ Never use the same key for encryption and hashing
- ❌ Never store keys in the database
- ❌ Never transmit keys over insecure channels

## Compliance & Auditing

### Data Protection Compliance
- **GDPR:** Encryption at rest for EU user data
- **CCPA:** Protection of California resident PII
- **SOC 2:** Encryption controls for sensitive data

### Audit Trail
All encryption operations are logged (without sensitive data):
```javascript
logger.info('Data encrypted', {
  operation: 'encrypt',
  timestamp: new Date().toISOString(),
  keyVersion: 'v2',
  // Never log: plaintext, encrypted data, or keys
});
```

## Troubleshooting

### Common Issues

#### "ENCRYPTION_KEY environment variable is required"
**Cause:** Missing or empty `ENCRYPTION_KEY` in environment  
**Solution:** Set the environment variable with a valid 64-character hex string

#### "Invalid authentication tag"
**Cause:** Data tampered with or wrong decryption key  
**Solution:** Verify key is correct, check data integrity

#### "Cannot decrypt data"
**Cause:** Key rotation without data migration  
**Solution:** Use old key to decrypt, then re-encrypt with new key

## Related Documentation
- [SECURITY.md](../../SECURITY.md) - Overall security policy
- [OPERATIONS.md](../../OPERATIONS.md) - Key rotation procedures
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) - Breach response procedures
