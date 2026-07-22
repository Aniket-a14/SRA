# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SRA (Smart Requirements Analyzer) is a pnpm monorepo that turns raw stakeholder text into IEEE-830 requirements specs via a multi-agent LLM pipeline, plus a CLI that traces generated specs back to real source code. Workspaces: `frontend` (Next.js 16), `backend` (Node/Express API + worker), `cli` (`@sra-srs/sra-cli`), `model` (offline dataset/fine-tuning scripts, not part of the runtime app).

## Commands

Run from repo root unless noted. Package manager is **pnpm** (see `pnpm-workspace.yaml`: `frontend`, `backend`, `cli`, `model`).

```bash
pnpm install                      # install all workspaces
pnpm run dev:backend              # backend only (nodemon src/server.js)
pnpm run dev:frontend             # frontend only (next dev -p 3001)
pnpm run dev:all                  # both, concurrently

pnpm run lint:all                 # eslint across all workspaces (also run by pre-commit)
pnpm --filter backend lint        # single workspace
pnpm --filter frontend lint

pnpm test:backend                 # backend Jest suite (only workspace with tests)
pnpm --filter backend test        # equivalent
```

Backend test internals (`backend/package.json`):
- `test` script = `cross-env NODE_OPTIONS=--experimental-vm-modules MOCK_AI=true jest` — native ESM + Jest, with `MOCK_AI=true` so no real Gemini calls happen during tests.
- Run a single file: `pnpm --filter backend exec jest tests/unit/json_repair.test.js`
- Run by name: `pnpm --filter backend exec jest -t "some test name"`
- Test layout: `backend/tests/{unit,contract,e2e,snapshots}`.
- Tests mock ESM natively via Jest's `unstable_mockModule` at the top of the test file (not `jest.mock`), then `await import(...)` the module under test afterward — required because this is a native ESM codebase (`"type": "module"`), not transpiled CJS.

Backend/local dev without external services — set in `backend/.env`:
- `MOCK_AI=true` — skips Gemini, returns canned agent JSON (see `BaseAgent.callLLM`).
- `MOCK_QSTASH=true` (or `NODE_ENV=development`) — skips Upstash QStash and runs the analysis worker logic in-process instead of via HTTP callback.

Prisma (backend):
```bash
pnpm --filter backend exec prisma generate     # also runs automatically postinstall
pnpm --filter backend exec prisma migrate dev  # requires DATABASE_URL/DIRECT_URL
```
Generated client output is `backend/src/generated/prisma` (gitignored, excluded from eslint).

Docker (full stack incl. Nginx LB + 2 backend replicas): `docker compose up --build -d`.

Pre-commit (`.pre-commit-config.yaml`): trailing-whitespace, end-of-file-fixer, check-yaml, check-added-large-files, then `pnpm lint:all`. Install once with `pip install pre-commit && pre-commit install`.

## Architecture

### Request lifecycle (async job pipeline)

1. **Enqueue** — `backend/src/services/queueService.js: addAnalysisJob` creates an `Analysis` row with `status: 'PENDING'` immediately (before any AI work), hashes the input text (MD5) for idempotency (returns the existing PENDING job if a duplicate arrives), then either publishes to **Upstash QStash** (prod) or fires the worker logic in-process (`MOCK_QSTASH`/dev).
2. **Worker** — QStash calls back into `POST /api/worker/process` → `workerController.processJob`. This atomically transitions `PENDING → IN_PROGRESS` via `updateMany` (guards against duplicate QStash deliveries/retries — a `count === 0` means it's already being handled or doesn't belong to this user) and then calls `analysisService.performAnalysis`, the actual orchestrator.
3. **Orchestration** (`backend/src/services/analysisService.js`, single large function — this is the file to read to understand the whole pipeline):
   - `ProductOwnerAgent` refines raw input into scope/features.
   - Multi-query RAG retrieval per feature (`ragService.retrieveContext`, pgvector cosine similarity) runs in parallel via `Promise.all`.
   - `ArchitectAgent` designs the system using that RAG context.
   - `DeveloperAgent` generates the SRS **sectionally** (shell → features in chunks of 2 → requirements/glossary → appendices/diagrams), with deliberate `sleep()` cooldowns between calls — this throttles against Gemini free-tier rate limits, it is not dead code to remove.
   - **Reflection loop** (max 2 passes, quality threshold 85): `ReviewerAgent` (approve/reject) + `CriticAgent` (6Cs score) gate the draft. On failure, `DeveloperAgent.refineSRS` does a **surgical** refinement of only the flagged section (Shell/Features/Requirements/Appendices) rather than a full regeneration — feedback keyword-matching decides which section is targeted.
   - Diagrams get heuristic pre-checks + AI self-repair (`validateAndAutoRepairDiagrams` → `aiService.repairDiagram`) *before* the reflection loop scores them, so Mermaid syntax slips don't tank the audit.
   - `evalService.evaluateRAG` runs a RAGAS-style faithfulness/relevancy score as a final benchmark.
   - Everything is persisted in a single Prisma `$transaction`: updates the `Analysis` row, lazily creates a `Project` if none was passed, deletes a superseded `DRAFT` parent if converting, then kicks off async knowledge-graph extraction (`graphService.extractGraph`) without blocking the response.
4. **Versioning** — `Analysis.rootId`/`parentId` form a tree, not mutable history: every refinement/chat edit creates a new row. The frontend renders this tree as a version timeline.

### Reliability layer

- `backend/src/agents/BaseAgent.js` is the shared base for all 5 agents (`ProductOwner`, `Architect`, `Developer`, `Reviewer`, `Critic`) plus `ChatAgent`. It wraps every Gemini call with: a 6-minute timeout, jittered exponential backoff on 429/5xx/timeout (up to `retries`), and a multi-stage JSON repair pipeline in `parseJSON` (strip markdown fences → balance braces on detected truncation → `jsonrepair` library → raw `JSON.parse` fallback). Extend `BaseAgent` for any new agent rather than reimplementing retry/parse logic.
- AI persona/generation config (temperature, token limits) is centralized in `backend/src/utils/llmGenerationConfig.js`, not scattered per-agent.
- Prompts are versioned in `backend/src/utils/versions/` (`v1_0_0.js` … `v2_1_0.js`, "Gold Standard"); shared prompt fragments live in `backend/src/utils/prompt_templates/`. When changing agent behavior, check which prompt version is active before editing — old versions are kept for reproducibility/rollback, not deleted.
- `ChatAgent` + `backend/src/utils/promptCompaction.js` handle conversational refinement without re-sending the full SRS JSON: `createChatSnapshot()` / `createReviewSnapshot()` build small, character-token-counted context payloads.

### Data model (`backend/prisma/schema.prisma`)

Postgres with `pgvector` + `uuid-ossp` extensions. Key models: `User` → `Project` → `Analysis` (tree via `rootId`/`parentId`, `resultJson` holds the full generated SRS, `vectorSignature` for similarity), `ChatMessage` (per-analysis refinement chat), `KnowledgeChunk` (shredded, embedded requirement fragments for RAG/reuse, tagged with a GIN index), `GraphNode`/`GraphEdge` (project-level entity graph for Graph-RAG), `ApiKey`, `Session`.

### Backend module layout

`routes/` → `controllers/` → `services/` is the standard flow; `agents/` are only invoked from `services/analysisService.js` and `chatService.js`. `middleware/` includes rate limiting (Redis-backed via `rate-limit-redis`, distributed sliding window), audit logging, and JWT auth. `config/` holds all external client setup (Prisma, Redis, Gemini/OpenAI, OAuth, JWT). Route mounting and global middleware order (helmet CSP → rate limiter → audit logger → CORS → body parser → health route → request-id → per-route auth) is defined in `backend/src/app.js`.

### Frontend

Next.js App Router under `frontend/app/`: `/analysis/[id]` (workspace + version compare), `/projects/[id]`, `/auth/{login,signup}`, `/settings`. Result tabs and diagram components are lazy-loaded via `next/dynamic` for bundle size. Diagrams render through `@xyflow/react` + Mermaid. All API calls funnel through the `useAuthFetch` hook (bearer token handling). Client-side auth/theme state is deferred to `useEffect` post-hydration to avoid Next.js SSR hydration mismatches — don't move that logic back into render.

### CLI (`cli/src/commands`)

`init`, `sync` (pull finalized SRS → `sra.spec.json`), `check` (scan local source, verify functional requirements are implemented), `push` (send verification results back to the platform), `review`, `doctor` (env/connectivity diagnostics), `reverse` (beta: generate requirements from an existing codebase).

### Env flags worth knowing when reading code

- `MOCK_AI`, `MOCK_QSTASH` — see Commands section above.
- `GEMINI_MODEL_NAME` — overrides the default model in `BaseAgent`.
- `RAG_SIMILARITY_THRESHOLD` — cosine similarity cutoff for RAG retrieval (default 0.25).

## Roadmap context

`v5.0_roadmap.md` documents an in-progress plan (not yet started beyond data prep) to replace Gemini with a self-hosted model stack (Ollama/vLLM), swap `gemini-embedding-001` for a local embedding model, and migrate Upstash QStash to BullMQ. If asked to touch `aiService.js`, `BaseAgent.js`, or `embeddingService.js` in ways that assume a "local provider" concept, check that doc first — it defines the target adapter shape.
