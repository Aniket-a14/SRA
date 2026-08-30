export interface DocSection {
    id: string
    title: string
    summary: string
    content: string
    subsections?: {
        id: string
        title: string
        content: string
        codeSnippet?: {
            language: string
            tabs?: {
                label: string
                language: string
                code: string
            }[]
            code?: string
        }
    }[]
}

export interface DocCategory {
    id: string
    slug: string
    title: string
    shortTitle?: string
    description: string
    icon: string
    badge?: string
    sections: DocSection[]
}

export const DOCS_CATEGORIES: DocCategory[] = [
    {
        id: "getting-started",
        slug: "getting-started",
        title: "1. Getting Started & System Overview",
        shortTitle: "Getting Started",
        description: "Executive architecture, value proposition, 5-minute fast-track quickstart, and BYOK multi-provider setup.",
        icon: "Sparkles",
        badge: "Essential",
        sections: [
            {
                id: "overview",
                title: "Executive System Overview",
                summary: "Why traditional one-shot prompting fails for software specifications, and how SRA treats requirements engineering as a precision manufacturing process.",
                content: `### The Paradigm Shift in Requirements Engineering

Modern enterprise software projects frequently fail or experience massive scope creep due to ambiguous, untraceable, or contradictory specifications. Traditional AI tools attempt "one-shot" prompt generation, resulting in generic, ungrounded text that lacks architectural rigor, adherence to industry standards, or bi-directional traceability to the actual codebase.

The **SRA (Smart Requirements Analyzer)** platform re-engineers requirements engineering into a multi-layered manufacturing pipeline. Raw stakeholder intent is systematically ingested, validated across multi-agent systems, benchmarked against rigorous quality standards, refined through interactive human-in-the-loop loops, and indexed into a vector knowledge base for enterprise-wide reuse.

\`\`\`mermaid
graph LR
    Intent[Raw Stakeholder Intent] --> L1[L1: Intake Mapping]
    L1 --> L2[L2: Multi-Agent MAS]
    L2 --> L3[L3: 6Cs & RAG Audit]
    L3 --> L4[L4: Refinement Hub]
    L4 --> L5[L5: Knowledge Index]
    L5 --> Code[Traceable Production Code]
\`\`\`

#### Key Enterprise Capabilities:
- **Multi-Standard Synthesis**: Generates specifications formatted strictly according to IEEE 830-1998, ISO/IEC/IEEE 29148:2018, Volere, or Agile PRD.
- **Bi-Directional Code Traceability**: The SRA CLI bridges cloud specifications and local Git repositories, verifying that requirements are implemented without link rot.
- **Granular RAG & Knowledge Recycling**: Historical requirements are shredded into semantic vectors and indexed via Supabase \`pgvector\` to accelerate new projects.
- **Zero-Trust BYOK Security**: User provider API keys are encrypted at rest with AES-256-GCM and never retained in server logs.`,
                subsections: [
                    {
                        id: "core-pillars",
                        title: "Core Architectural Guarantees",
                        content: `SRA is built upon four non-negotiable architectural invariants:

1. **Immutability & Recursive Version Trees**: Every modification or chat refinement branches a new analysis node (\`rootId\` and \`parentId\`). Prior versions are preserved forever for regulatory auditability.
2. **Deterministic Quality Gates**: No specification is marked complete without undergoing a reflection loop scoring Clarity, Completeness, Conciseness, Consistency, Correctness, and Context (6Cs score $\ge 85$).
3. **Multi-Tenant Scoping**: All database reads, RAG context queries, and session management are isolated strictly by \`userId\` at the query layer.
4. **Resilient Serverless Checkpointing**: Asynchronous jobs execute through Upstash QStash with self-checkpointing budgets (\`pipelineBudget.js\`), preventing serverless timeout drops.`
                    }
                ]
            },
            {
                id: "quickstart",
                title: "5-Minute Fast-Track Quickstart",
                summary: "Get up and running with your first requirements specification in under 5 minutes using the Web Workspace or Terminal CLI.",
                content: `You can generate, inspect, and export your first software specification using either the Web Workspace or the Developer CLI.`,
                subsections: [
                    {
                        id: "web-quickstart",
                        title: "Option A: Web Workspace Quickstart",
                        content: `1. **Sign In**: Navigate to \`/auth/login\` and authenticate via Google OAuth or Email.
2. **Add Provider Key**: Go to **Settings $\\rightarrow$ AI Provider Keys** and enter your Google Gemini, OpenAI, Claude, or Grok API key.
3. **Create Analysis**: Click **New Analysis** (\`⌘N\`), enter your project title (e.g., *"Healthcare Patient Intake Portal"*), and paste your unstructured business requirements or user stories.
4. **Select Standard**: Choose your target specification standard (IEEE 830-1998, ISO 29148, Volere, or Agile PRD).
5. **Monitor Live Stream**: Watch the multi-agent system process through Intake Mapping, Architecture Synthesis, and the 6Cs Quality Audit in real time.
6. **Refine & Export**: Switch between **Conversation** mode (to prompt changes) and **Document** mode to download your specification in DOCX, Markdown, LaTeX, or Typst.`
                    },
                    {
                        id: "cli-quickstart",
                        title: "Option B: Developer CLI Quickstart",
                        content: `Install the global SRA CLI and generate specifications directly from your local terminal workspace:`,
                        codeSnippet: {
                            language: "bash",
                            tabs: [
                                {
                                    label: "npm",
                                    language: "bash",
                                    code: `# 1. Install CLI globally\nnpm install -g @sra-srs/sra-cli\n\n# 2. Authenticate session\nsra auth login\n\n# 3. Analyze intent file and watch live progress\nsra analyze --input requirements.md --format ieee830 --watch\n\n# 4. Sync requirements specification locally\nsra sync --output sra.spec.json`
                                },
                                {
                                    label: "pnpm",
                                    language: "bash",
                                    code: `pnpm add -g @sra-srs/sra-cli\nsra auth login\nsra analyze -i specs.txt -f volere -w\nsra sync`
                                }
                            ]
                        }
                    }
                ]
            },
            {
                id: "byok-setup",
                title: "BYOK (Bring Your Own Key) Multi-Provider Configuration",
                summary: "Configure your own API keys for Google Gemini, OpenAI GPT-4o, Anthropic Claude, or xAI Grok with AES-256-GCM zero-trust encryption.",
                content: `### Zero-Trust BYOK Security Model

SRA operates on a strict **Bring Your Own Key (BYOK)** architecture for all generation workloads. Your API keys are encrypted at rest using AES-256-GCM symmetric encryption with unique initialization vectors (IVs) and authentication tags.

> [!NOTE]
> The platform's built-in Gemini key is used **strictly for vector embeddings** (\`text-embedding-004\`, dimension 768) to maintain dimensional consistency in the Supabase \`pgvector\` database. All generation, reasoning, and reflection workloads run through your own nominated provider key.

#### Supported Providers & Recommended Models:
| Provider | Default Model | Best Used For |
| :--- | :--- | :--- |
| **Google Gemini** | \`gemini-2.5-flash\` | Ultra-fast drafting, large context window (1M+ tokens), low latency |
| **OpenAI** | \`gpt-4o\` | Structured JSON synthesis, detailed technical schemas |
| **Anthropic Claude** | \`claude-3-5-sonnet\` | Complex domain reasoning, deep code architecture, formal methods |
| **xAI Grok** | \`grok-beta\` | Rapid alternative analysis, high-speed reflection audits |`,
                subsections: [
                    {
                        id: "key-encryption",
                        title: "Cryptographic Key Storage & Lifecycle",
                        content: `When you save an API key in **Settings**:
1. The backend \`providerKeyService.js\` generates a cryptographically random 12-byte IV.
2. The key is encrypted via AES-256-GCM using the server's master encryption key (\`ENCRYPTION_KEY\`).
3. Only the ciphertext and auth tag are persisted in PostgreSQL.
4. During an analysis job, keys are decrypted temporarily in ephemeral memory and discarded immediately after HTTP calls to the AI provider.
5. Server logs and error handlers automatically scrub and redact any credential-shaped strings.`
                    }
                ]
            }
        ]
    },
    {
        id: "pipeline",
        slug: "pipeline",
        title: "2. The 5-Layer Multi-Agent AI Pipeline",
        shortTitle: "Analysis Pipeline",
        description: "In-depth breakdown of the 5-layer manufacturing process, prompt engineering v2.1.0, and 6Cs automated quality auditing.",
        icon: "Cpu",
        badge: "Architecture",
        sections: [
            {
                id: "pipeline-lifecycle",
                title: "Asynchronous Pipeline Lifecycle",
                summary: "How background jobs are scheduled, executed, checkpointed, and streamed to the client without timing out.",
                content: `Requirements generation is an intensive process requiring 60–180 seconds of multi-agent reasoning. SRA orchestrates this using an asynchronous event-driven model:

1. **Job Dispatch**: \`queueService.js\` computes an MD5 hash of the input for idempotency, creates an \`Analysis\` record with status \`PENDING\`, and publishes the job to **Upstash QStash**.
2. **Worker Ingestion**: QStash delivers the webhook to \`POST /api/worker/process\`. \`workerController.js\` atomically transitions the record to \`IN_PROGRESS\` via \`updateMany\` to guarantee that duplicate webhook deliveries are safely ignored.
3. **Live SSE Streaming**: The client connects to \`GET /api/analyze/:id/stream\`. Progress events (stage transitions, agent thoughts, section completions) are published to Redis Pub/Sub and pushed to the browser via Server-Sent Events (SSE).
4. **Serverless Budget Checkpointing (\`pipelineBudget.js\`)**: On serverless environments (e.g. Vercel 300s limit), the pipeline checks execution budgets before heavy stages. If time runs low, it checkpoints intermediate state to PostgreSQL and re-enqueues itself to continue seamlessly without data loss.`,
                subsections: [
                    {
                        id: "pipeline-stages",
                        title: "The 5 Sequential Layers",
                        content: `| Layer | Name | Primary Responsibility | Agent / Service |
| :--- | :--- | :--- | :--- |
| **Layer 1** | **Intake Mapping** | Translates unstructured vision into canonical JSON draft schema | \`ProductOwnerAgent\` |
| **Layer 2** | **Multi-Agent System** | Parallel business value modeling, architecture design, and document synthesis | \`ProductOwner\`, \`Architect\`, \`Developer\` |
| **Layer 3** | **Objective Review** | Automated 6Cs quality audit and RAG faithfulness scoring | \`ReviewerAgent\`, \`CriticAgent\`, \`evalService\` |
| **Layer 4** | **Refinement Hub** | Human-in-the-loop chat iterations, version branching, and self-healing diagrams | \`ChatAgent\`, \`DiagramRepair\` |
| **Layer 5** | **Knowledge Indexing** | Semantic shredding and vector embedding into \`pgvector\` for reuse | \`ragService\`, \`embeddingService\` |`
                    }
                ]
            },
            {
                id: "multi-agent-system",
                title: "Layer 2: Multi-Agent System (MAS v2.1.0)",
                summary: "Coordinated role separation between Product Owner, Systems Architect, and Developer Agents using the v2.1.0 Gold Standard prompt registry.",
                content: `### Role-Based Agent Choreography

Rather than asking a single LLM to write an entire specification, SRA utilizes specialized agents with distinct domain responsibilities:

\`\`\`mermaid
sequenceDiagram
    participant PO as Product Owner Agent
    participant Arch as Systems Architect Agent
    participant Dev as Developer Agent
    participant DB as Knowledge Base (RAG)

    PO->>PO: Decompose Scope & User Classes
    PO->>DB: Query Relevant Historical Chunks
    DB-->>Arch: Vector Context (Interfaces & Schemas)
    Arch->>Arch: Synthesize System Architecture & Entity Models
    PO->>Dev: Functional Requirements Intent
    Arch->>Dev: Architectural Constraints & Schemas
    Dev->>Dev: Sectional Document Synthesis (IEEE / ISO / Volere / PRD)
\`\`\`

#### 1. Product Owner Agent
- Decomposes business goals, identifies primary/secondary user classes, defines operating environments, and establishes boundary constraints.
- Formulates feature candidate lists and stimulus/response sequences.

#### 2. Systems Architect Agent
- Determines external interface requirements (User Interfaces, Hardware Interfaces, Software APIs, and Communication Protocols).
- Generates Mermaid architecture diagrams (Sequence Diagrams, Flowcharts, Entity-Relationship Models).
- Injects relevant historical design patterns retrieved from the vector knowledge base.

#### 3. Developer Agent
- Synthesizes the formal normative requirement statements ("The system shall...").
- Formats each section according to the target standard's exact schema descriptor with intentional rate-limit cooldown throttles.`,
                subsections: []
            },
            {
                id: "6cs-audit",
                title: "Layer 3: Objective Review & 6Cs Quality Audit",
                summary: "Algorithmic grading against the 6Cs quality standard and LLM-as-a-judge faithfulness scoring.",
                content: `### The 6Cs Quality Standard

Every generated specification is audited by the \`CriticAgent\` against six core software engineering metrics:

1. **Clarity**: Unambiguous phrasing free of vague qualifiers (*"fast"*, *"user-friendly"*, *"robust"*).
2. **Completeness**: Compulsory coverage of all required sections, external interfaces, and non-functional constraints.
3. **Conciseness**: High information density without fluff or duplicate requirement definitions.
4. **Consistency**: Zero internal contradictions between functional rules, database entities, and user roles.
5. **Correctness**: Valid Mermaid diagram syntax, proper RFC 2119 normative verbs (*"SHALL"*, *"SHOULD"*), and accurate schema types.
6. **Context**: Alignment with user-provided domain knowledge and historical organizational standards.

#### Reflection & Surgical Repair Loop:
- If the aggregate quality score falls below **85/100**, the \`ReviewerAgent\` flags specific deficient sections.
- The pipeline enters a **reflection pass** (maximum 2 passes) where the Developer Agent performs surgical refinement *only on the flagged sections*, preserving the rest of the document intact.`,
                subsections: []
            }
        ]
    },
    {
        id: "standards",
        slug: "standards",
        title: "3. Requirements Standards & Specifications",
        shortTitle: "Standards & Formats",
        description: "Comparative guide to IEEE 830, ISO 29148, Volere, Agile PRD, and universal multi-format export engines.",
        icon: "FileText",
        badge: "Standards",
        sections: [
            {
                id: "standards-matrix",
                title: "Supported Standards Comparison Matrix",
                summary: "Detailed comparison between IEEE 830, ISO 29148, Volere, and Agile PRD formats.",
                content: `SRA provides first-class support for the world's four leading requirements engineering methodologies:

| Standard / Format | Target Audience | Primary Syntax Style | Verification Mechanism | Ideal Project Type |
| :--- | :--- | :--- | :--- | :--- |
| **IEEE 830-1998** | Traditional Engineering, Defense, Aerospace | Strict *"The system shall..."* | Functional Acceptance Criteria | Monoliths, Safety-Critical, Enterprise Backend |
| **ISO/IEC/IEEE 29148:2018** | Modern Systems Engineering, Large Enterprises | Contextual Capabilities & Constraints | Verification & Validation Matrices | Distributed Systems, Cloud Platforms, Embedded |
| **Volere** | Quality Assurance, Regulated Systems | Volere Requirement Shells | Quantitative **Fit Criteria** & Methods | FinTech, MedTech, High-Compliance Systems |
| **Agile PRD** | Product Management, Scrum/Kanban Teams | Epics, User Stories, Gherkin BDD | Acceptance Criteria (*Given/When/Then*) | SaaS, Consumer Web/Mobile Apps, Rapid MVPs |`,
                subsections: [
                    {
                        id: "volere-spec",
                        title: "Volere Requirement Shell Structure",
                        content: `When Volere is selected, every requirement is structured as a formal requirement shell:
- **Requirement ID**: Unique alphanumeric identifier (e.g., \`VOL-REQ-042\`).
- **Requirement Type**: Functional, Performance, Security, Usability, etc.
- **Description**: Natural language statement of intent.
- **Rationale**: The justification for why this requirement exists.
- **Originator / Stakeholder**: The stakeholder group requesting the capability.
- **Fit Criterion**: A measurable, testable metric determining compliance (e.g., *"99.9% of queries return within 200ms at 1,000 req/sec"*).
- **Verification Method**: \`Inspection\`, \`Analysis\`, \`Demonstration\`, or \`Test\`.`
                    },
                    {
                        id: "agile-prd-spec",
                        title: "Agile PRD & Gherkin BDD Syntax",
                        content: `Agile PRD documents emphasize user outcomes:
- **User Stories**: *"As a [role], I want to [action], so that [benefit]."*
- **Gherkin BDD Acceptance Scenarios**:
\`\`\`gherkin
Scenario: Successful multi-factor authentication
  Given a registered user on the login screen
  When the user enters valid credentials and submits the correct 6-digit OTP
  Then the system issues a session JWT and redirects to the dashboard
\`\`\``
                    }
                ]
            },
            {
                id: "export-engine",
                title: "Universal Multi-Format Export Engine",
                summary: "Download your completed specifications in Microsoft Word, Markdown, LaTeX, Typst, or Executive Print PDF.",
                content: `### Production Document Compilation

SRA includes an enterprise-grade document compilation engine that transforms the in-memory specification JSON into polished, publication-ready files:

1. **Microsoft Word (.docx)**: Generated via \`docx\` library with custom IEEE typography, executive headers, callout boxes, and formatted requirement tables.
2. **GitHub-Flavored Markdown (.md)**: Clean Markdown with embedded Mermaid diagrams, badges, and code blocks.
3. **LaTeX (.tex) & Overleaf Integration**: Formal academic/engineering LaTeX documents with \`hyperref\`, \`booktabs\`, and one-click export to Overleaf Cloud.
4. **Typst (.typ)**: Modern, blazing-fast typesetting for technical specifications.
5. **Executive Print PDF**: High-resolution print styling with automatic page-break management and cover page rendering.`,
                subsections: []
            }
        ]
    },
    {
        id: "cli",
        slug: "cli",
        title: "4. Developer Platform & SRA CLI Toolkit",
        shortTitle: "CLI & Developer Tools",
        description: "Complete guide to @sra-srs/sra-cli: installation, authentication, code traceability, AST reverse engineering, and CI/CD pipelines.",
        icon: "Terminal",
        badge: "CLI",
        sections: [
            {
                id: "cli-installation",
                title: "Installation & Dual Authentication",
                summary: "Install the CLI globally and authenticate using browser OAuth or long-lived CI/CD API keys.",
                content: `### Global CLI Setup

The SRA CLI (\`@sra-srs/sra-cli\`) enables developers to integrate requirements engineering directly into their local development workflow and CI/CD pipelines.`,
                subsections: [
                    {
                        id: "install-commands",
                        title: "Installation Commands",
                        content: `Install globally using your preferred package manager:`,
                        codeSnippet: {
                            language: "bash",
                            tabs: [
                                {
                                    label: "npm",
                                    language: "bash",
                                    code: `npm install -g @sra-srs/sra-cli\nsra --version`
                                },
                                {
                                    label: "pnpm",
                                    language: "bash",
                                    code: `pnpm add -g @sra-srs/sra-cli\nsra --version`
                                },
                                {
                                    label: "yarn",
                                    language: "bash",
                                    code: `yarn global add @sra-srs/sra-cli\nsra --version`
                                }
                            ]
                        }
                    },
                    {
                        id: "auth-methods",
                        title: "Authentication Methods",
                        content: `**Method 1: Interactive Browser Login (Local Dev)**
\`\`\`bash
sra auth login
\`\`\`
Opens your default browser to authorize the CLI session and stores a secure session token locally in \`~/.sra/config.json\`.

**Method 2: Long-Lived API Key (CI/CD Pipelines)**
\`\`\`bash
export SRA_API_KEY="sra_live_xxxxxxxxxxxxxxxx"
sra auth whoami
\`\`\``
                    }
                ]
            },
            {
                id: "cli-commands",
                title: "CLI Command Reference",
                summary: "Comprehensive reference for sra analyze, sync, check, push, reverse, and status.",
                content: `### Command Catalog

#### 1. \`sra analyze\` — Submit New Requirements Analysis
Submits a raw input file or string to the cloud pipeline and streams live progress to the terminal:
\`\`\`bash
sra analyze --input specs.md --format ieee830 --watch
\`\`\`

#### 2. \`sra sync\` — Synchronize Specification Locally
Pulls the latest requirement specification into your repository as \`sra.spec.json\`:
\`\`\`bash
sra sync --id <analysis-id> --output sra.spec.json
\`\`\`

#### 3. \`sra check\` & \`sra check --deep\` — Traceability Verification
Verifies that all files linked to requirements actually exist in the codebase:
\`\`\`bash
# Standard check: Verifies file path existence
sra check

# Deep check: Validates that code files contain requirement IDs (e.g. @sra-req REQ-001)
sra check --deep
\`\`\`

#### 4. \`sra push\` — Sync Verification Status to Cloud
Uploads local code verification results back to the cloud workspace metadata:
\`\`\`bash
sra push --id <analysis-id>
\`\`\`

#### 5. \`sra reverse\` — AST Codebase Reverse Engineering
Inspects a local codebase repository, builds an Abstract Syntax Tree (AST) structural digest (modules, interfaces, database entities), and reverse-engineers a complete requirements specification:
\`\`\`bash
sra reverse --dir ./src --format ieee830 --output reverse-srs.json
\`\`\``,
                subsections: []
            },
            {
                id: "ci-cd-recipes",
                title: "CI/CD Pipeline Automation Recipes",
                summary: "Automate requirements traceability compliance in GitHub Actions and GitLab CI.",
                content: `### Continuous Requirements Verification (CRV)

Ensure no Pull Request merges without verifying that modified code complies with project requirements:`,
                subsections: [
                    {
                        id: "github-actions-recipe",
                        title: "GitHub Actions Workflow Recipe",
                        content: `Create \`.github/workflows/requirements-check.yml\`:`,
                        codeSnippet: {
                            language: "yaml",
                            tabs: [
                                {
                                    label: "GitHub Actions",
                                    language: "yaml",
                                    code: `name: Requirements Compliance Check\non: [pull_request]\n\njobs:\n  verify-traceability:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm install -g @sra-srs/sra-cli\n      - name: Verify Requirements Traceability\n        env:\n          SRA_API_KEY: \${{ secrets.SRA_API_KEY }}\n        run: |\n          sra check --deep\n          sra push`
                                },
                                {
                                    label: "GitLab CI",
                                    language: "yaml",
                                    code: `stages:\n  - compliance\n\nrequirements_verification:\n  stage: compliance\n  image: node:20\n  script:\n    - npm install -g @sra-srs/sra-cli\n    - sra check --deep\n  only:\n    - merge_requests`
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    },
    {
        id: "api",
        slug: "api",
        title: "5. REST API Reference & Integration",
        shortTitle: "REST API Reference",
        description: "Complete OpenAPI endpoint catalog, authentication headers, request/response schemas, error codes, and webhooks.",
        icon: "Code",
        badge: "API",
        sections: [
            {
                id: "api-auth",
                title: "API Authentication & Envelopes",
                summary: "Dual credential headers, JSON response envelope contracts, and HTTP status code matrices.",
                content: `### Authentication Headers

All REST API endpoints require standard Bearer token authorization:

\`\`\`http
Authorization: Bearer <JWT_TOKEN | sra_live_xxxxxxxx>
Content-Type: application/json
\`\`\`

#### Response Envelope Contract
Standard responses follow the unified envelope:
\`\`\`json
{
  "success": true,
  "data": {
    "id": "dc71920c-14e2-4bf0-ab7c-211818f3206a",
    "status": "COMPLETED",
    "version": 1
  },
  "message": "Analysis retrieved successfully"
}
\`\`\``,
                subsections: []
            },
            {
                id: "endpoints-catalog",
                title: "Core Endpoints Reference",
                summary: "Interactive request and response examples for Analyses, Projects, Formats, and Health Probes.",
                content: `### Endpoints Catalog`,
                subsections: [
                    {
                        id: "post-analyze",
                        title: "1. Create Analysis Job — POST /api/analyze",
                        content: `Creates an asynchronous requirements generation task.`,
                        codeSnippet: {
                            language: "json",
                            tabs: [
                                {
                                    label: "cURL",
                                    language: "bash",
                                    code: `curl -X POST https://sra-backend.onrender.com/api/analyze \\\n  -H "Authorization: Bearer sra_live_xxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "inputText": "Design an automated incident response platform...",\n    "projectTitle": "OpsBridge",\n    "format": "ieee830"\n  }'`
                                },
                                {
                                    label: "TypeScript",
                                    language: "typescript",
                                    code: `const response = await fetch("https://sra-backend.onrender.com/api/analyze", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer sra_live_xxx",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    inputText: "Design an automated incident response platform...",\n    projectTitle: "OpsBridge",\n    format: "ieee830"\n  })\n});\nconst result = await response.json();`
                                },
                                {
                                    label: "Python",
                                    language: "python",
                                    code: `import requests\n\nres = requests.post(\n    "https://sra-backend.onrender.com/api/analyze",\n    headers={"Authorization": "Bearer sra_live_xxx"},\n    json={\n        "inputText": "Design an automated incident response platform...",\n        "projectTitle": "OpsBridge",\n        "format": "ieee830"\n    }\n)\ndata = res.json()`
                                }
                            ]
                        }
                    },
                    {
                        id: "get-stream",
                        title: "2. Live SSE Progress Stream — GET /api/analyze/:id/stream",
                        content: `Subscribes to real-time Server-Sent Events (SSE) for a running analysis job:
\`\`\`http
GET /api/analyze/dc71920c-14e2-4bf0-ab7c-211818f3206a/stream
Accept: text/event-stream
\`\`\`

**Event Stream Payloads**:
\`\`\`text
event: progress
data: {"stage":"MULTI_AGENT_ANALYSIS","percent":40,"message":"Architect Agent designing schema..."}

event: complete
data: {"status":"COMPLETED","analysisId":"dc71920c-14e2-4bf0-ab7c-211818f3206a"}
\`\`\``
                    },
                    {
                        id: "get-health",
                        title: "3. Deep Health Probe — GET /api/health",
                        content: `Returns comprehensive health status of database connectivity, Redis cache, and embedding keys:
\`\`\`json
{
  "status": "healthy",
  "timestamp": "2026-08-30T12:00:00.000Z",
  "database": { "status": "connected", "latencyMs": 4 },
  "redis": { "status": "connected" },
  "embeddings": { "configured": true }
}
\`\`\``
                    }
                ]
            }
        ]
    },
    {
        id: "security",
        slug: "security",
        title: "6. Security, Compliance & Governance",
        shortTitle: "Security & Governance",
        description: "Zero-trust BYOK encryption, PostgreSQL RLS, multi-tenant isolation, anti-prompt injection, and GDPR compliance.",
        icon: "ShieldCheck",
        badge: "Security",
        sections: [
            {
                id: "security-model",
                title: "Zero-Trust Security & Encryption",
                summary: "Field-level AES-256-GCM encryption for API keys, in-transit TLS 1.3, and strict query isolation.",
                content: `### Security Architecture

SRA enforces defense-in-depth across all system layers:

1. **Field-Level Encryption**: All customer provider API keys are encrypted with AES-256-GCM using unique initialization vectors. The master encryption key is managed via environment variables and never checked into source control.
2. **Multi-Tenant Row-Level Isolation**: Every Prisma query enforces \`where: { id, userId }\`. A request referencing another tenant's ID receives a 404 response without leaking resource existence.
3. **RAG Corpus Tenant Scoping**: Vector similarity searches explicitly filter by \`userId\`. No customer's requirement chunks or project titles can ever appear in another organization's RAG context.
4. **Anti-Prompt Injection Sanitization**: All user inputs entering system prompts pass through choke-point sanitizers (\`constructMasterPrompt\`) in \`utils/promptSanitizer.js\`.`,
                subsections: [
                    {
                        id: "gdpr-compliance",
                        title: "GDPR Article 17 (Right to be Forgotten) Purge Engine",
                        content: `SRA implements transactional, cascading account deletion:
- When a user requests account erasure (\`DELETE /api/auth/me\`), sessions are revoked immediately.
- \`accountDeletionService.hardDeleteUser\` cascades across foreign keys in a single database transaction:
  $$\\text{KnowledgeChunks} \\rightarrow \\text{Analyses} \\rightarrow \\text{Projects} \\rightarrow \\text{User}$$
- Vector embeddings and graph entities are wiped completely, fulfilling GDPR Article 17 and CCPA requirements.`
                    }
                ]
            }
        ]
    },
    {
        id: "operations",
        slug: "operations",
        title: "7. Operations, Reliability & DevOps",
        shortTitle: "Operations & DevOps",
        description: "Docker containerization, Terraform cloud infrastructure, database connection pooling, and disaster recovery runbooks.",
        icon: "Server",
        badge: "Operations",
        sections: [
            {
                id: "docker-deployment",
                title: "Docker & Container Orchestration",
                summary: "Multi-stage production Dockerfiles and docker-compose configurations.",
                content: `### Containerized Production Setup

The SRA monorepo includes production-ready Docker configurations for all microservices:

\`\`\`yaml
version: '3.8'
services:
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_BACKEND_URL=http://backend:5000

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:pass@db:5432/sra
      - REDIS_URL=redis://redis:6379

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
\`\`\``,
                subsections: [
                    {
                        id: "database-pooling",
                        title: "Database Connection Pooling Architecture",
                        content: `To ensure high availability and prevent connection exhaustion:
- **Application Web Traffic**: Connects through Supabase PgBouncer transaction pooler (port \`6543\`) for short-lived queries.
- **Migrations & Backup Exports**: Direct connection via \`DIRECT_URL\` (port \`5432\`) bypasses poolers, preventing statement timeouts during large exports or schema updates.`
                    }
                ]
            }
        ]
    },
    {
        id: "recipes",
        slug: "recipes",
        title: "8. Enterprise Recipes & Case Studies",
        shortTitle: "Enterprise Recipes",
        description: "Production recipes for Microservices specifications, Regulated Industries (Health/FinTech), and Legacy Code Modernization.",
        icon: "BookOpen",
        badge: "Case Studies",
        sections: [
            {
                id: "microservices-recipe",
                title: "Recipe: Event-Driven Microservices Architecture",
                summary: "How to generate comprehensive ISO 29148 specifications for Kafka and gRPC distributed architectures.",
                content: `### Distributed Systems Blueprint

When specifying microservice topologies:
1. Provide component boundaries and message payloads in the intake text.
2. Select **ISO/IEC/IEEE 29148:2018** for interface validation matrices.
3. The Systems Architect Agent automatically synthesizes Sequence Diagrams and async message queues.
4. Export the resulting specification to LaTeX or Word DOCX for enterprise architecture review.`,
                subsections: []
            },
            {
                id: "legacy-modernization",
                title: "Recipe: Legacy Codebase Modernization",
                summary: "Reverse-engineering undocumented repositories into formal specifications using sra reverse.",
                content: `### Modernizing Brownfield Applications

1. Clone the legacy codebase locally.
2. Run \`sra reverse --dir ./legacy-app --format ieee830 --output srs.json\`.
3. SRA constructs an AST digest of all controllers, database models, and external APIs.
4. The cloud AI pipeline synthesizes a comprehensive IEEE 830 specification documenting the existing system's behavior.
5. Use \`sra check --deep\` to establish a baseline traceability matrix for modern rewrite efforts.`,
                subsections: []
            }
        ]
    }
]

export function getDocCategory(slug: string): DocCategory | undefined {
    return DOCS_CATEGORIES.find(c => c.slug === slug)
}

export function getAllDocCategories(): DocCategory[] {
    return DOCS_CATEGORIES
}
