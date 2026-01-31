# SRA (Smart Requirements Analyzer)

[![Publish Docker Images](https://github.com/Aniket-a14/SRA/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/Aniket-a14/SRA/actions/workflows/docker-publish.yml)
[![Bundle Size Check](https://github.com/Aniket-a14/SRA/actions/workflows/bundle-size.yml/badge.svg)](https://github.com/Aniket-a14/SRA/actions/workflows/bundle-size.yml)
[![Scheduled Health Check](https://github.com/Aniket-a14/SRA/actions/workflows/health-check.yml/badge.svg)](https://github.com/Aniket-a14/SRA/actions/workflows/health-check.yml)
[![CodeQL Security](https://github.com/Aniket-a14/SRA/actions/workflows/codeql.yml/badge.svg)](https://github.com/Aniket-a14/SRA/actions/workflows/codeql.yml)
[![Linting Quality](https://github.com/Aniket-a14/SRA/actions/workflows/lint.yml/badge.svg)](https://github.com/Aniket-a14/SRA/actions/workflows/lint.yml)
[![Deployment Status](https://img.shields.io/badge/Deployment-Verified-brightgreen)](https://github.com/Aniket-a14/SRA)
[![IEEE-830](https://img.shields.io/badge/Compliance-IEEE--830-blue)](https://ieeexplore.ieee.org/document/720577)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/Aniket-a14/SRA/graphs/commit-activity)

**SRA** is an enterprise-grade, AI-orchestrated ecosystem designed to formalize the software requirements engineering lifecycle. By combining Large Language Model (LLM) reasoning with rigorous architectural standards, SRA transforms fragmented project visions into high-fidelity, production-ready technical specifications (IEEE-830).

---

## 🏛️ Executive Summary

In contemporary software development, **43% of project failures** are attributed to poor requirements gathering. **SRA** mitigates this risk by providing an automated, multi-layered validation and synthesis engine. It serves as the bridge between business objectives and technical execution, ensuring that every project starts with a cohesive, logical, and architecturally sound foundation.

### Core Value Propositions
*   **Zero-Ambiguity Intake**: Standardizes raw stakeholder descriptions into structured architectural models.
*   **AI-Driven Governance**: Real-time logic checking to identify contradictions, missing logic, and technical gaps.
*   **High-Fidelity Visuals**: Automated generation of multi-level Data Flow Diagrams (DFD) and system-level Mermaid diagrams.
*   **Semantic Intelligence**: Leverages vector-based knowledge retrieval (RAG) to ensure consistency across complex project portfolios.

---

## �️ The 5-Layer Analysis Pipeline

SRA operates on a proprietary 5-layer pipeline that ensures every requirement is processed through a rigid quality-control sequence.

```mermaid
graph TD
    subgraph "The SRA Pipeline"
    L1[<b>Layer 1: Strategic Intake</b><br/>Unstructured Input Mapping]
    L2[<b>Layer 2: Logic Validation</b><br/>AI-Gatekeeper Verification]
    L3[<b>Layer 3: Analysis & Synthesis</b><br/>IEEE SRS Generation]
    L4[<b>Layer 4: Iterative Refinement</b><br/>Live Workspace & Diff Tracking]
    L5[<b>Layer 5: Knowledge Persistence</b><br/>Semantic Indexing & Reuse]
    end

    Stakeholder((Stakeholder)) -->|Raw Vision| L1
    L1 --> L2
    L2 -->|FAIL: Ambiguity Detected| L1
    L2 -->|PASS| L3
    L3 --> L4
    L4 -->|Export| Artifacts[IEEE SRS, PDF, DFD, API Spec]
    L4 --> L5
```

### Layer Breakdown
1.  **Strategic Intake**: Translates free-text into a mapped JSON model aligned with IEEE section hierarchies.
2.  **Logic Validation**: A high-speed reasoning pass (Gatekeeper) that evaluates clarity, consistency, and detail sufficiency.
3.  **Analysis & Synthesis**: Heavy LLM processing to generate the full document, including User Stories, Acceptance Criteria, and Entity-Relationship maps.
4.  **Iterative Refinement**: A premium Workspace UI for manual adjustments, version branching, and intelligent diagram repair.
5.  **Knowledge Persistence**: Finalized requirements are "shredded" and indexed into a Vector Database for cross-project intelligence and RAG.

---

## ✨ Enterprise Feature Modules

### 📊 Professional Requirements Engineering
*   **IEEE-830 Compliance**: Automated generation of standard sections (Product Perspective, System Features, NFRs).
*   **User Story Evolution**: Generates "Jira-Ready" user stories with granular acceptance criteria.
*   **Entity Mapping**: Automated identification of core data entities, system actors, and external interfaces.

### 🎨 Advanced Architectural Visualization
*   **Multi-Level DFDs**: Generates Level 0 (Context) and Level 1 (Functional Decomposition) Gane-Sarson diagrams.
-   **Interactive Explorer**: Powered by `@xyflow/react` with support for high-fidelity **PNG Export**.
*   **Self-Healing Diagrams**: Integrated **Mermaid Repair Engine** that identifies and fixes syntax errors in generated UML.

### 🔒 Security, Privacy & Governance
*   **Proactive PII Redaction**: Automated sanitization of user intent (Emails, Phone, CC) before processing by external AI providers.
*   **RBAC Architecture**: Secure access control with JWT integration and social OAuth (Google/GitHub).
*   **Revision History**: Complete versioning system with visual diff tracking between requirement updates.
*   **Audit-Ready Exports**: One-click professional PDF generation with table of contents and revision logs.

---

## 🛡️ Production Hardening

SRA is engineered for stability, security, and enterprise-grade performance.

### 🧩 Infrastructure Security
- **Multi-Stage Docker Builds**: Minimized production images using separate build/runtime environments.
- **Non-Root Execution**: Containers run as unprivileged users (`nodejs`/`nextjs`) to mitigate security risks.
- **Dependency Pinning**: Strict versioning of core dependencies (e.g., Next.js 15.5.11) to ensure environment parity.

### 🌐 Network & Content Security
- **Hardened CSP**: Strict Content Security Policy injected via Next.js and Express security headers.
- **HSTS & Frame Protection**: Production-grade `Strict-Transport-Security` and `X-Frame-Options` (DENY/SAMEORIGIN) enforcement.
- **Privacy Sanitization**: Integrated `sanitizer.js` layer to prevent data leakage to LLM providers.
- **Rate Limiting**: Intelligent API throttling across auth, analysis, and worker endpoints.

### 🔍 Search & Performance Optimization
- **Automated SEO**: Dynamic `sitemap.xml` and `robots.txt` generation for search engine discoverability.
- **Graceful Shutdown**: Native handling of `SIGTERM`/`SIGINT` to ensure zero-downtime deployments and safe process termination.
- **Standalone Mode**: Next.js optimized standalone output for significantly faster boot times in containerized environments.

---

## 🚀 CI/CD & Monitoring

SRA leverages professional GitHub Actions for continuous quality assurance and operational excellence.

### 🔄 Continuous Integration & Delivery
- **Automated Docker Builds**: Multi-stage Docker builds triggered on every push to `main`, publishing optimized images to GHCR.
- **Bundle Size Monitoring**: Tracks and reports JavaScript bundle size changes for the Next.js frontend, preventing performance regressions.
- **Linting & Formatting**: Enforces consistent code style and catches potential errors early in the development cycle.

### 🩺 Health & Security Monitoring
- **Scheduled Health Checks**: Hourly automated uptime verification of the entire SRA pipeline.
- **Real-time Observability**: Dedicated `/api/health` endpoint for deep system diagnostics (DB, AI Provider).
- **Docker Healthchecks**: Infrastructure-aware readiness probes ensure the frontend only serves traffic once the backend is fully initialized.
- **CodeQL Security Scans**: Proactive identification of security vulnerabilities and common coding errors.
- **Dependency Vulnerability Checks**: Scans for known vulnerabilities in project dependencies.

---

## 💻 Tech Stack & Rationale

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Frontend** | [Next.js 15.5.11](https://nextjs.org/) | App Router with standalone output for enterprise scalability. |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Next-gen JIT engine for high-performance, responsive UI. |
| **Backend** | [Node.js 20](https://nodejs.org/) / [Prisma 6](https://www.prisma.io/) | Type-safe ORM for robust asynchronous data orchestration. |
| **Database** | [PostgreSQL 16+](https://www.postgresql.org/) | High-concurrency persistence with `pgvector` RAG support. |
| **Orchestration** | [Upstash QStash](https://upstash.com/) | Serverless job queue for reliable, long-running AI tasks. |
| **LLM Engine** | [Gemini 2.0 Flash](https://ai.google.dev/) | Advanced reasoning and context window for complex architectural mapping. |

---

## ⚙️ Operational Guide & Deployment

### 1. Advanced Environment Configuration

Ensure the following variables are defined in your infrastructure (see `.env.example` files in `backend/` and `frontend/` for details):

| Group | Key | Required | Description |
|-------|-----|:--------:|-------------|
| **Database** | `DATABASE_URL` | Yes | Postgres connection string with pooling. |
| **Database** | `DIRECT_URL` | Yes | Direct connection string for Prisma migrations. |
| **Database** | `REDIS_URL` | Optional | Redis connection string for rate limiting/caching. |
| **AI (Gemini)** | `GEMINI_API_KEY` | Yes | API key for Google Gemini 2.0 Flash (Primary). |
| **AI (OpenAI)**| `OPENAI_API_KEY` | Optional | API key for OpenAI (Secondary/Internal). |
| **Async** | `QSTASH_TOKEN` | Yes | Bearer token for Upstash QStash job publishing. |
| **Async** | `QSTASH_SIGNING_KEYS` | Yes | Signing keys for verifying QStash webhooks. |
| **Auth** | `JWT_SECRET` | Yes | Secret key for signing authorization tokens. |
| **Auth** | `COOKIE_SECRET` | Yes | Secret key for signed cookies. |
| **Social Auth** | `GOOGLE_CLIENT_ID` | Optional | Google OAuth 2.0 Client ID. |
| **Social Auth** | `GITHUB_CLIENT_ID` | Optional | GitHub OAuth App Client ID. |

### 2. Deployment Strategies

#### 🐳 Docker Orchestration (Recommended)
SRA is fully containerized for cloud-agnostic deployment. Our CI pipeline automatically publishes production-ready images to **GitHub Container Registry (GHCR)**.

```bash
# Pull and run the latest images
docker-compose up --build -d
```
*   **API Service**: `http://localhost:3000` (Optimized Multi-stage Build)
*   **Application UI**: `http://localhost:3001` (Next.js Standalone Build)
*   **Registry**: `ghcr.io/aniket-a14/sra-backend:latest`

#### ⚒️ Manual Infrastructure Setup
For local development or specialized environments:
```bash
# Initialize Identity & Data
cd backend && npm install && npx prisma migrate dev

# Initialize Application Layer
cd ../frontend && npm install && npm run dev
```

#### 🤖 Agentic & CI Workflows
SRA leverages professional GitHub Actions for continuous quality assurance:
*   **Publish Docker**: Automated image pushes to [GHCR](https://github.com/Aniket-a14/SRA/pkgs/container/sra-frontend).
*   **Bundle Size**: Continuous monitoring of Next.js JS payloads on every branch.
*   **Health Checks**: Hourly automated uptime verification of the entire pipeline.
*   **Security Scans**: Integrated CodeQL and dependency vulnerability checks.

---

## 📂 Project Structure

```bash
SRA/
├── .github/                # CI/CD Workflows (Lint, CodeQL, Stale)
├── .agent/                 # Agentic Workflows (Setup, Test, Deploy)
├── backend/                # API Engine & AI Orchestration
│   ├── prisma/             # Schema & Migrations
│   ├── src/
│   │   ├── services/       # AI logic, QStash workers, & business rules
│   │   └── controllers/    # API request handlers
├── frontend/               # Next.js 15 Application Layer
│   ├── app/                # Server-driven App Router
│   ├── components/         # High-fidelity React components
│   └── lib/                # Shared utilities & API clients
└── README.md
```

---

## 🗺️ Roadmap & Governance

- [x] **v2.0**: Strategic 5-Layer Pipeline Implementation.
- [x] **v2.1**: Interactive DFD Explorer & PNG Export.
- [x] **v2.2**: GitHub CI/CD & Agentic Automation.
- [ ] **v2.5**: Collaborative Real-time Multi-User Editing.
- [ ] **v3.0**: Enterprise Custom Model Fine-tuning (MLOps integration).

### Contributing
We welcome contributions from the community. Please review our [Contribution Guidelines](CONTRIBUTING.md) for architectural context and coding standards.

### Security Policy
To report vulnerabilities, please contact the security team via the repository's security advisory tab.

---

## 📄 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for the full legal text.

