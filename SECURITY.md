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
| **3.0.x** | **Current Release** | :white_check_mark: |
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

---
*Thank you for helping us keep SRA secure.*
