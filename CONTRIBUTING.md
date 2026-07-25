# Contributing to SRA

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to SRA. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## 📂 Project Structure & Navigation

Understanding the project structure is key to making effective contributions. **SRA follows a rigid 5-Layer Analysis Pipeline.**

### Backend (`/backend`)
The backend is built with **Node.js** and designed for **Vercel Serverless**, orchestrating the AI analysis layers.
-   **`src/server.js`**: The local entry point to start the server.
-   **`src/app.js`**: Express app configuration (also used by Vercel).
-   **`api/`**: Vercel Serverless Function entry points.
-   **`src/routes/`**: API route definitions.
-   **`src/controllers/`**: Logic for handling API requests.
-   **`src/services/`**: Business logic and orchestrators. `analysisService.js` is the pipeline itself — read it first.
-   **`src/services/providers/`**: Per-provider adapters (Gemini/OpenAI/Claude/Grok) behind one interface, plus the BYOK key and model resolver.
-   **`src/formats/`**: Format descriptors (IEEE 830, ISO 29148, Volere, Agile PRD). One descriptor drives generation, response schema, prompt guidelines, and the writable-key whitelist — add a format here, not by branching in the pipeline.
-   **`src/agents/`**: Multi-Agent System (MAS) implementations (PO, Architect, Developer, Reviewer, Critic). Extend `BaseAgent` rather than reimplementing retry/parse logic.
-   **`src/utils/versions/`**: **CRITICAL**. Versioned "Gold Standard" prompt generators. Old versions are kept for reproducibility — check which is active before editing.
-   **`src/utils/prompt_templates/`**: Supplemental templates and the **Diagram Syntax Authority**.
-   **`src/controllers/workerController.js`**: The QStash callback target. Handles duplicate deliveries and pipeline continuations.
-   **`src/middleware/`**: Middleware for auth, validation, rate limiting, audit logging and error handling.
-   **`.env`**: Stores environment variables like your API key and database URL. **Do not commit this file.**

### CLI (`/cli`)
The `@sra-srs/sra-cli` workspace. See [`cli/README.md`](cli/README.md) for the command reference.
-   **`src/lib/`**: Where the behaviour lives — spec extraction/merge, format registry client, codebase scanner, SSE progress consumer, traceability record. Tests target this, not the commands.
-   **`src/commands/`**: One file per command; mostly orchestration over `src/lib`.
-   **`src/api/api-client.js`**: HTTP client with retry, `Retry-After` handling, a host allowlist for the bearer token, and SSE support.

### Frontend (`/frontend`)
The frontend is built with **Next.js 16 (App Router)** and **TypeScript**, styled with **Tailwind CSS v4**.
-   **`app/`**: Contains the application routes and pages.
    -   `page.tsx`: The main landing page and UI.
    -   `layout.tsx`: The root layout wrapper.
-   **`components/`**: Reusable UI components.
    -   **`ui/`**: Base components from shadcn/ui.
    -   **`analysis/tabs/`**: Modular sub-components for each IEEE result tab.
    -   **`results-tabs.tsx`**: Coordinator for the IEEE 830 view; **`analysis/format-results.tsx`** is the generic, descriptor-driven renderer used by every other format.
    -   **`analysis/document-canvas.tsx`**: Chooses between the two, and hosts the format-independent panels (RAG sources, CLI traceability).
    -   **`MermaidRenderer.tsx`**: **Strict** renderer for diagrams (governed by Diagram Syntax Authority).
-   **`lib/`**: Utility functions and helpers.
    -   `data.ts`: Centralized static data repository.
    -   `formats/`: The frontend mirror of the format registry, driving the generic renderer.
    -   `srs-export/`: Structured DOCX export, derived from the same format descriptors.
-   **`public/`**: Static assets like images and icons.

## 🚀 Getting Started

### Prerequisites
Ensure you have the following installed or set up:
-   **Node.js** (v20 or higher)
-   **pnpm** (preferred package manager)
-   **Supabase Project** (PostgreSQL + pgvector)
-   **Upstash Account** (Redis + QStash)
-   A **provider API key of your own** — Gemini, OpenAI, Claude or Grok. Generation is BYOK on every provider, so a key is required to run any analysis; the platform key funds embeddings only. A [Gemini key](https://aistudio.google.com/app/apikey) is the quickest to obtain.

### Docker Setup (Preferred)
1.  **Configure Environment**: Ensure you have `.env` files in both `backend/` and `frontend/` directories.
2.  **Run with Docker Compose**:
    ```bash
    docker-compose up --build
    ```
    This spins up both services enabling you to test the full stack immediately.

### Backend Setup (Manual)
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3.  Create a `.env` file and add the required variables (see `README.md` for the template).
4.  Initialize the database:
    ```bash
    pnpm prisma migrate dev --name init
    ```
5.  Start the development server:
    ```bash
    pnpm run dev
    ```

### Frontend Setup
1.  Open a new terminal and navigate to the frontend directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3.  Start the development server:
    ```bash
    pnpm run dev
    ```
4.  Open [http://localhost:3001](http://localhost:3001) to view the app.

## 🛠️ Where to Make Changes

### Governance & Development Standards
**SRA enforces strict enterprise standards.**

#### Diagram Syntax Authority
-   **Strictness**: All diagram generation prompts in `src/utils/prompt_templates/` must adhere to strict Mermaid syntax limits.
-   **Verification**: Always verify changes using the "View Syntax Explanation" feature in the frontend.

#### Name Governance
-   **Consistency**: Ensure consistent naming across the "Introduction" section of the SRS.
-   **Sequential Identifiers**: All requirements must follow project-prefixed sequential naming (e.g., `PROJ-REQ-001`).

#### AI Quality Gating (MAS)
-   **6Cs Audit**: All AI generations must be compatible with the **Critic Agent** audit loop.
-   **RAG Faithfulness**: Requirements must be objectively grounded in retrieved context (verified via **Evaluation Service**).

### Adding New Features
-   **Backend Logic**:
    -   Add new routes in `src/routes/`.
    -   Implement logic in `src/controllers/` and `src/services/`.
    -   **Layer 4 (Refinement)** is implemented via `surgicalRefineService` in the backend.
    -   **Layer 5 (Document Compiler)** is pure client-side logic in `frontend/lib/srs-export/`. **Do not shift this to the backend.**
    -   **A new specification format** is a descriptor in `backend/src/formats/specs/` plus its mirror in `frontend/lib/formats/specs.ts` — not a branch in the pipeline. The response schema, prompt guidelines, renderer, export and the `updateAnalysis` writable-key whitelist all derive from it.
-   **Frontend UI**:
    -   To add a new section to the IEEE results view, create a component in `frontend/components/analysis/tabs/` and register it in `results-tabs.tsx`. Other formats render generically from their descriptor and need no component.
    -   **API Requests**: Use the `useAuthFetch` hook found in `lib/hooks.ts` for all authenticated requests. This hook handles bearer tokens automatically.
    -   To change the analysis composer, see `frontend/app/(shell)/analysis/new/page.tsx`.

### Styling
-   We use **Tailwind CSS v4**. You can apply utility classes directly to your JSX elements.
-   For complex components, check `frontend/components/ui` to see if a pre-built component (like a Button or Card) already exists (shadcn/ui).

## 🔄 Contribution Workflow

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/SRA.git
    cd SRA
    ```
3.  **Create a branch** for your feature or fix:
    ```bash
    git checkout -b feature/amazing-new-feature
    ```
4.  **Make your changes**. Follow the **Governance & Development Standards**.
5.  **Run the checks CI will run**:
    ```bash
    pnpm lint:all      # eslint across every workspace (also run by pre-commit)
    pnpm test:all      # backend + CLI Jest suites
    pnpm --filter frontend exec tsc --noEmit
    pnpm --filter frontend build
    pnpm audit --prod --audit-level=high   # CI fails on any high-severity production CVE
    ```
    Tests are native-ESM Jest: mock with `unstable_mockModule` before `await import(...)`, not `jest.mock`. The backend suite runs under `MOCK_AI=true`, so no real model calls happen.
6.  **Commit your changes** using **Conventional Commits**:
    -   `feat: add new analysis layer`
    -   `fix: resolve mermaid rendering error`
    -   `docs: update contributing guidelines`
    -   `chore: update dependencies`
    ```bash
    git commit -m "feat: add amazing new feature to results display"
    ```
7.  **Push to your fork**:
    ```bash
    git push origin feature/amazing-new-feature
    ```
8.  **Open a Pull Request** on the original repository.
9.  **Wait for Status Checks**: Ensure your PR adheres to the rules defined in [GOVERNANCE.md](GOVERNANCE.md).

## 🐛 Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub. Be sure to include:
-   Steps to reproduce the bug.
-   Expected behavior vs. actual behavior.
-   Screenshots (if applicable).

Happy Coding! 🚀
