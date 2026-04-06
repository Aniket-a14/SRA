# Security Policy: SRA Platform

## 🛡️ Commitment to Security
At SRA, security is not an afterthought—it is a foundational component of our architectural design. We are committed to maintaining the integrity, confidentiality, and availability of requirements engineering data.

## 🔒 Data Privacy & PII Redaction
To protect sensitive stakeholder information, SRA implements a proactive **PII Redaction Layer**. Before any requirement text is transmitted to external AI providers (such as Google or OpenAI), it is passed through a high-performance sanitization engine that redacts:
- Email Addresses
- Phone Numbers
- Credit Card Information
- IPv4/IPv6 Addresses
- Sensitive Authentication Tokens

This ensures that your proprietary project vision remains private, even when leveraging the power of Large Language Models.

## 🚀 Supported Versions
We provide security updates for the following versions:

| Version | Lifecycle Stage | Security Support |
| :--- | :--- | :---: |
| **3.2.x** | **Current Release (MAS/Audit)** | :white_check_mark: |
| 3.1.x | Legacy Production | :white_check_mark: |
| 2.2.x | Active Maintenance | :white_check_mark: |
| 2.0.x | Legacy Stable | :warning: |
| < 2.0.0 | Deprecated | :x: |

## 🔍 Vulnerability Disclosure Process
If you discover a security vulnerability within SRA, we appreciate your efforts in disclosing it to us in a responsible manner.

**Please do NOT open a public GitHub issue for security vulnerabilities.**

### Reporting Channels
Please report vulnerabilities via the following channels:
1.  **Email**: Send a detailed report to `aniketsahaworkspace@gmail.com`.
2.  **GitHub Private Reporting**: Use the "Report a vulnerability" button on the **Security** tab of this repository.

### What to Include
*   A descriptive title of the vulnerability.
*   The version(s) affected.
*   A detailed step-by-step guide to reproduce the issue.
*   Potential impact (e.g., Data Leakage, RCE, Broken Auth).
*   Any suggested remediation or mitigation.

## 📝 Our Response Commitment
*   **Acknowledgment**: We aim to acknowledge your report within **24 hours**.
*   **Evaluation**: Our security team will perform a full triage and impact analysis within **3 business days**.
*   **Resolution**: We aim to resolve critical vulnerabilities within **7 business days** of confirmation.
*   **Public Disclosure**: Once a patch is released, we will issue a Security Advisory (GHSA) to inform the community.

## ⚖️ Bounty Program
We currently operate a private, invite-only bug bounty program. Exceptional researchers who submit high-quality, actionable reports via our disclosure channels may be invited to the program.

## 🔐 Encryption & Data Protection

### Field-Level Encryption
SRA implements **AES-256-GCM encryption** for sensitive data at rest, including:
- OAuth access and refresh tokens
- User IP addresses and location data
- Other personally identifiable information (PII)

**Encryption Key Management:**
- Separate keys for data encryption (`ENCRYPTION_KEY`) and backup encryption (`BACKUP_ENCRYPTION_KEY`)
- 90-day key rotation policy
- Secure key storage in environment variables (never committed to version control)

For detailed encryption implementation, see [docs/security/ENCRYPTION.md](docs/security/ENCRYPTION.md).

### Row-Level Security (RLS)
All database tables are protected with Row-Level Security policies implemented in Supabase, ensuring:
- Users can only access their own data
- Database-level enforcement (defense in depth)
- Protection against SQL injection and unauthorized access

## 🚨 Security Incident Response

We maintain a comprehensive incident response plan covering:
- **Severity Levels:** P0 (Critical) to P3 (Low)
- **Response Procedures:** Detection, Containment, Eradication, Recovery, Post-Incident
- **Communication Templates:** Internal and user-facing notifications
- **Emergency Contacts:** 24/7 escalation paths

For full incident response procedures, see [docs/security/INCIDENT_RESPONSE.md](docs/security/INCIDENT_RESPONSE.md).

## 📚 Additional Security Documentation

- [ENCRYPTION.md](docs/security/ENCRYPTION.md) - Field-level encryption implementation
- [INCIDENT_RESPONSE.md](docs/security/INCIDENT_RESPONSE.md) - Security incident procedures
- [OPERATIONS.md](OPERATIONS.md) - Backup, disaster recovery, and secrets rotation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture and security design

---
*Thank you for helping us keep SRA secure.*
