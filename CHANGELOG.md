# Changelog

All notable changes to this project will be documented in this file.

## [3.1.0] - 2026-02-01

### 🏗️ Infrastructure as Code
- **Added** Complete Terraform configuration for infrastructure management
- **Added** Terraform setup for Vercel project management (frontend & backend)
- **Added** Infrastructure versioning and disaster recovery capability
- **Added** `terraform/` directory with full IaC implementation
  - `main.tf` - Provider and backend configuration
  - `variables.tf` - Variable definitions
  - `vercel.tf` - Vercel project resources
  - `outputs.tf` - Infrastructure outputs
  - `terraform.tfvars.example` - Configuration template
  - `README.md` - Comprehensive Terraform usage guide

### 📚 Documentation
- **Added** Infrastructure as Code section to main README
- **Added** Terraform quick start guide
- **Added** Security documentation in `docs/security/`
  - `ENCRYPTION.md` - Field-level encryption documentation
  - `INCIDENT_RESPONSE.md` - Security incident response procedures
- **Updated** Project structure documentation to include `terraform/` and `docs/`
- **Updated** ARCHITECTURE.md with comprehensive CDN strategy documentation

### 🔒 Security & Compliance
- **Documented** Encryption practices (AES-256-GCM)
- **Documented** Incident response procedures with severity levels (P0-P3)
- **Documented** CDN caching policies and performance optimization
- **Confirmed** RLS policies active in Supabase database

### 🛠️ Developer Experience
- **Added** Helper scripts for Terraform environment setup
- **Added** Comprehensive implementation guides and walkthroughs
- **Improved** Infrastructure reproducibility and team collaboration
- **Improved** Disaster recovery procedures

### 📊 Infrastructure Benefits
- ✅ Version-controlled infrastructure
- ✅ One-command disaster recovery
- ✅ Self-documenting infrastructure code
- ✅ Complete audit trail for infrastructure changes
- ✅ Team collaboration via infrastructure PRs


The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.10] - 2026-02-01
### Added
- **SWR Data Fetching**: Migrated analysis pages to `useSWR` for smart polling, automatic caching, and background revalidation.
- **Automated Backup System**: Weekly encrypted database backups with AES-256-GCM encryption and SHA-256 integrity verification.
- **Backup CLI Tool**: Command-line interface for manual backup creation, restoration, listing, and verification.
- **Audit Logging**: Comprehensive middleware tracking all sensitive operations (create, delete, finalize, exports) with full metadata.
- **Security Monitoring**: Real-time threat detection for brute force attempts, mass deletions, and unusual access patterns.
- **Field-Level Encryption**: Data encryption utilities for PII protection with AES-256-GCM.
- **GitHub Actions Workflows**: Automated weekly backups and daily security audits (dependency scanning, secret leak detection).

### Changed
- **Data Fetching Architecture**: Replaced manual `setTimeout` polling with declarative SWR hooks (~150 lines of code reduction).
- **Environment Variables**: Added `BACKUP_ENCRYPTION_KEY`, `ENCRYPTION_KEY`, `BACKUP_DIR`, and `BACKUP_RETENTION_DAYS`.

### Security
- **Enhanced Security Posture**: Daily automated security audits including secret leak detection, permission checks, and header validation.
- **Backup Encryption**: All database backups are encrypted before storage with configurable retention policies.

## [3.0.9] - 2026-02-01
### Fixed
- **Post-Audit Stabilization**: Resolved project initialization regression caused by API response structure mismatch.

## [3.0.0] - 2026-01-31
### Added
- **System-Wide Audit**: Completed a full-stack audit across Frontend, Backend, AI Orchestration, and DevOps.
- **Modular Frontend Architecture**: Refactored `ResultsTabs.tsx` into 7 specialized, memoized sub-components for improved performance and maintainability.
- **Centralized API Orchestration**: Implemented `useAuthFetch` hook for standardized, authenticated API calls with proactive CSRF handling.
- **Security Hardening**: Enforced mandatory `CSRF_SECRET` validation in production environments.
- **Performance Optimization**: Memoized `StoryCard.tsx` to optimize dashboard rendering.

## [2.2.0] - 2026-01-30
### Added
- **Core Governance**: Integrated GitHub Actions for automated quality control (`Linting`, `CodeQL Security`, `Stale Bot`).
- **Agentic Workflows**: Created executable `.agent/workflows` for automated `Setup`, `Test`, and `Deploy` orchestration.
- **Enterprise Documentation**: Major overhaul of `README.md`, `ARCHITECTURE.md`, and `CHANGELOG.md` to production standards.
- **Lint Remediation**: Achieved zero-warning state across the frontend codebase.

## [2.1.0] - 2026-01-29
### Added
- **High-Fidelity Visuals**: Integrated `@xyflow/react` for interactive DFD exploration.
- **Visual Export**: Implemented High-Res **PNG Export** for all Data Flow Diagrams.
- **Premium UX**: Added glassmorphism-inspired loading sequences with animated phase indicators.
- **Self-Healing Diagrams**: Real-time AI-driven repair for Mermaid.js syntax errors.

## [2.0.0] - 2026-01-28
### Added
- **5-Layer Analysis Pipeline**: Formalized the requirements engineering process into 5 distinct architectural layers.
- **AI Engine Upgrade**: Migrated core processing to **Google Gemini 2.0 Flash**.
- **Vector Intelligence**: Implemented `pgvector` persistence for semantic requirement retrieval (RAG).
- **Asynchronous Orchestration**: Integrated **Upstash QStash** for serverless job execution.

## [1.0.0] - 2026-01-15
### Added
- Initial release of the Smart Requirements Analyzer.
- Basic IEEE-830 document generation.
- Supabase authentication and persistence.
