# Changelog

All notable changes to this project will be documented in this file.

## [4.0.0] - 2026-02-18

### 🚀 SRA CLI Toolkit (Major Release)
- **Launched** the official SRA CLI ecosystem (`@aniket_a14/sra-cli`).
- **Implemented** full Spec-to-Code traceability loop.
- **Added** commands: `init`, `sync`, `check`, `push`, `reverse`, and `doctor`.
- **Refactored** CLI to an Enterprise-grade modular architecture (`src/` layered pattern).
- **Established** professional API client with resilience interceptors and multi-stage config management.

### 🏛️ Backend & Data Integrity
- **Hardened** `analysisController.js` with advanced data-merging logic to synchronize CLI verification data with cloud updates without data loss.
- **Implemented** secure spread operations for project metadata preservation.

### 📊 Frontend & Export Polish
- **Updated** `FeatureDisplay` to reflect real-time local verification status synced from the CLI.
- **Enhanced** `export-utils.ts` to include a full **Audit Trail** in PDF reports, listing implementation files for every requirement.

---

## [3.2.1] - 2026-02-14

### 🔍 AI Reliability & Quality
- **Implemented** a 6-minute (360s) timeout and jittered retry logic in `BaseAgent` for robust long-form document generation.
- **Added** full raw response logging in `BaseAgent` on JSON parsing failures to accelerate debugging.
- **Improved** standard prompts (v1.1.0) with a `noSchema` option, resolving architectural mapping conflicts for specialized agents.
- **Standardized** all core analysis agents to use **Google Gemini 2.5 Flash**.

### ⚡ Frontend Performance
- **Implemented** Next.js Dynamic Imports in `HomeClient.tsx` to reduce the initial JS bundle size.
- **Added** Tab-level Code Splitting in `ResultsTabs.tsx`, ensuring that heavy components are only loaded on demand.
- **Achieved** perfect lint scores and optimized lighthouse-ready production builds.

## [3.2.0] - 2026-02-12

### 🤖 Multi-Agent Orchestration
- **Implemented** a Multi-Agent System (MAS) featuring specialized AI Personas:
    - **Product Owner**: ROI-focused scope refinement.
    - **System Architect**: Scalable technical design with RAG context.
    - **Lead Developer**: IEEE 830-1998 compliant specification generation.
- **Unified** prompt governance using the `utils/versions` dynamic registry (v1.1.0 Gold Standard).

### 📊 Industry Benchmarks & QA
- **Implemented** `evalService.js` for RAGAS-style metrics (Faithfulness, Answer Relevancy).
- **Added** `CriticAgent.js` for automated **6Cs Quality Auditing** (Clarity, Completeness, Conciseness, Consistency, Correctness, Context).
- **Integrated** real-time benchmarking into the `analysisService.js` visualization flow.
- **Created** `verify_benchmarks.js` for automated pipeline validation.

### 🏗️ Requirements Engineering
- **Enforced** strict IEEE 830-1998 structured output across all generation layers.
- **Improved** requirement identifier governance with project-prefixed sequential naming.

## [3.1.1] - 2026-02-01


### 💎 Database & ORM
- **Upgraded** Prisma ORM to **v7.3.0** (Major architectural upgrade)
- **Implemented** Prisma Driver Adapters using `@prisma/adapter-pg` for enhanced PostgreSQL performance
- **Added** Centralized Prisma configuration via `prisma.config.js`
- **Updated** Prisma Client initialization to use the new adapter-based architecture
- **Optimized** Database connection strategies using separate `DIRECT_URL` for migrations and `DATABASE_URL` (with PgBouncer) for application queries

### 🏗️ Infrastructure & DevOps
- **Updated** Terraform configuration for Prisma 7 compatibility (Node.js 20.x enforcement)
- **Synchronized** Vercel deployment structure for multi-repo support (`SRA_frontend` and `SRA_backend`)
- **Enhanced** Docker builds with `prisma.config.js` support and non-root execution safety
- **Added** Node.js version enforcement (`engines`) across backend and frontend

### 🛡️ Security & Quality
- **Patched** Transitive vulnerabilities in `lodash` and `hono` via selective `npm overrides`
- **Updated** ESLint configuration to ignore generated Prisma client artifacts
- **Updated** Documentation (READMEs) across the repository to reflect v3.2 requirements


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
