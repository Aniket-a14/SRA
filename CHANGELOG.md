# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
