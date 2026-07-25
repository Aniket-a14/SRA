# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SRA (Smart Requirements Analyzer) is a pnpm monorepo that turns raw stakeholder text into IEEE-830 requirements specs via a multi-agent LLM pipeline, plus a CLI that traces generated specs back to real source code. Workspaces: `frontend` (Next.js 16), `backend` (Node/Express API + worker), `cli` (`@sra-srs/sra-cli`).

## Commands

Run from repo root unless noted. Package manager is **pnpm** (see `pnpm-workspace.yaml`: `frontend`, `backend`, `cli`).

```bash
pnpm install                      # install all workspaces
pnpm run dev:backend              # backend only (nodemon src/server.js)
pnpm run dev:frontend             # frontend only (next dev -p 3001)
pnpm run dev:all                  # both, concurrently

pnpm run lint:all                 # eslint across all workspaces (also run by pre-commit)
pnpm --filter backend lint        # single workspace
pnpm --filter frontend lint

pnpm test:backend                 # backend Jest suite
pnpm test:cli                     # CLI Jest suite
pnpm test:all                     # both
```

Backend test internals (`backend/package.json`):
- `test` script = `cross-env NODE_OPTIONS=--experimental-vm-modules MOCK_AI=true jest` — native ESM + Jest, with `MOCK_AI=true` so no real Gemini calls happen during tests.
- Run a single file: `pnpm --filter backend exec jest tests/unit/json_repair.test.js`
- Run by name: `pnpm --filter backend exec jest -t "some test name"`
- Test layout: `backend/tests/{unit,contract,e2e,snapshots}`.
- Tests mock ESM natively via Jest's `unstable_mockModule` at the top of the test file (not `jest.mock`), then `await import(...)` the module under test afterward — required because this is a native ESM codebase (`"type": "module"`), not transpiled CJS.

CLI tests (`cli/tests`) use the same native-ESM Jest setup, minus `MOCK_AI` (the CLI makes no model calls). They mock the network only — the local `sra.spec.json`/`sra.config.json` are written to a real temp dir and `process.chdir`'d into, so file handling is exercised rather than stubbed. A command that signals failure via `process.exitCode` must reset it in `afterAll`, or the flag leaks out and fails the whole Jest run.

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
- **Drafting conventions are per-format and must not bleed.** `utils/prompt_templates/srs_drafting_standard.js` is the single source for how a requirement is worded. The four formats encode different methods, not styles: IEEE 830 and ISO 29148 are shall-based (`draftingConventionFor` returns the normative-language rules); Volere puts testability in the **fit criterion** and Volere descriptions may legitimately use words an IEEE requirement bans; an Agile PRD uses user stories with Given/When/Then and never "The system shall". `qualityAttributeRulesFor` is empty for Volere/PRD because they quantify elsewhere. `ReviewerAgent`/`CriticAgent` run against **all four** formats and take an optional `spec` — without it they default to IEEE 830 and mark a Volere or PRD document down for missing sections its method never defined. `tests/unit/srs_drafting_standard.test.js` guards the cross-contamination. Identifier prefixes come from `deriveProjectPrefix` (an acronym — `FTP-REQ-001`), imported by both `v2_2_0` and the agents so the system turn and user turn cannot disagree.
- Prompts are versioned in `backend/src/utils/versions/` (`v1_0_0.js` … `v2_1_0.js`, "Gold Standard"); shared prompt fragments live in `backend/src/utils/prompt_templates/`. When changing agent behavior, check which prompt version is active before editing — old versions are kept for reproducibility/rollback, not deleted.
- `ChatAgent` + `backend/src/utils/promptCompaction.js` handle conversational refinement without re-sending the full SRS JSON: `createChatSnapshot()` / `createReviewSnapshot()` build small, character-token-counted context payloads.

### Data model (`backend/prisma/schema.prisma`)

Postgres with `pgvector` + `uuid-ossp` extensions. Key models: `User` → `Project` → `Analysis` (tree via `rootId`/`parentId`, `resultJson` holds the full generated SRS, `vectorSignature` for similarity), `ChatMessage` (per-analysis refinement chat), `KnowledgeChunk` (shredded, embedded requirement fragments for RAG/reuse, tagged with a GIN index), `GraphNode`/`GraphEdge` (project-level entity graph for Graph-RAG), `ApiKey`, `Session`.

### Backend module layout

`routes/` → `controllers/` → `services/` is the standard flow; `agents/` are only invoked from `services/analysisService.js` and `chatService.js`. `middleware/` includes rate limiting (Redis-backed via `rate-limit-redis`, distributed sliding window), audit logging, and JWT auth. `config/` holds all external client setup (Prisma, Redis, Gemini/OpenAI, OAuth, JWT). Route mounting and global middleware order (helmet CSP → rate limiter → audit logger → CORS → body parser → health route → request-id → per-route auth) is defined in `backend/src/app.js`.

Two security middlewares are deliberately *not* global. `cookie-parser` is mounted on `authRoutes` alone, because that router holds the only two cookie readers in the codebase (the OAuth state cookie and the refresh token) — every other route authenticates with a bearer header. Consequently `/auth/refresh` and `/auth/logout` are the only endpoints reachable with an ambient credential, and they carry `requireTrustedOrigin` from `middleware/csrfMiddleware.js`; the origin allowlist it checks is shared with `cors()` via `config/allowedOrigins.js`, so the two can't drift apart.

Untrusted text that reaches a *system* prompt is sanitized in `utils/promptSanitizer.js` and applied at one choke point — `constructMasterPrompt`. `projectName` is the case that matters: `aiService` extracts it from raw stakeholder input by regex, and the prompt templates interpolate it into instruction sentences. Add new untrusted keys to `sanitizePromptSettings` rather than sanitizing at the call site, and keep user-supplied prose in the user turn (`analyzeText`'s `text`), never templated into a system prompt.

### Frontend

Next.js App Router under `frontend/app/`: `/analysis/[id]` (workspace + version compare), `/projects/[id]`, `/auth/{login,signup}`, `/settings`, `/changelog`. Result tabs and diagram components are lazy-loaded via `next/dynamic` for bundle size. Diagrams render through `@xyflow/react` + Mermaid. All API calls funnel through the `useAuthFetch` hook (bearer token handling). Client-side auth/theme state is deferred to `useEffect` post-hydration to avoid Next.js SSR hydration mismatches — don't move that logic back into render. There is no dark theme — the design system is light-only, so components should use the semantic tokens (`foreground`, `muted-foreground`, `background`) rather than hardcoded colours, but no `dark:` variants are expected.

`/changelog` publishes customer-facing **release notes**, which are a different document from the repo-root `CHANGELOG.md`. That file stays the terse engineering log of what changed; the notes explain what a release means for someone using the platform. Both need updating for a release — they are not generated from each other.

Notes are MDX under `frontend/content/changelog/`, one file per release named `YYYY-MM-DD-vX.Y.Z.mdx`. YAML frontmatter (`title`, `description`, `date`, `version`, optional `tags`, `milestone`) is typed as `ReleaseMeta` and exposed as a `meta` export by `remark-mdx-frontmatter`; `frontend/types/mdx.d.ts` declares it. **A new note must be registered in `content/changelog/index.ts`** — imports are static, not globbed, so an unregistered file simply never appears. Ordering is `compareReleases` in `lib/changelog.ts` (date, then numeric version — four releases share 2026-02-01, and `3.0.10` must outrank `3.0.9`).

MDX plumbing: `@next/mdx` in `next.config.ts` with `remark-gfm` (tables), `remark-frontmatter` and `remark-mdx-frontmatter`. Turbopack serializes the config, so **plugins must be named as strings, not imported** — a function reference fails the build. Element styling lives in `frontend/mdx-components.tsx`; there is no `@tailwindcss/typography`, so there is no `prose` class to fall back on. Inline code is the exception, styled in `globals.css` under `.release-note code`: a note may write `<code>` as JSX inside an `<Accordion>`, and JSX authored directly in MDX bypasses the component map entirely.

`frontend/lib/changelog.test.ts` reads the frontmatter with its own small parser rather than importing the MDX — vitest has no MDX transform configured, so importing `content/changelog` from a test breaks the suite. Keep pure logic in `lib/`, not beside the registry.

Frontend tests run under vitest in a **jsdom** environment (`pnpm --filter frontend test`), covering both pure `lib/` logic and component render tests (`components/**/*.test.tsx`) via `@testing-library/react`. Test through a component's exported surface rather than exporting internals to reach them. Don't configure a JSX transform: vitest 4 uses oxc, which handles the automatic runtime, and an `esbuild.jsx` block is silently ignored with a warning. `tests/setup-dom.ts` stubs `matchMedia` and `ResizeObserver`, which jsdom does not implement and several components read on mount.

### CLI (`cli/`)

Commands (`cli/src/commands`): `init` (link a folder to an analysis), `analyze` (start a run from a file/stdin), `reverse` (generate a spec *from* the local codebase), `sync` (pull the document → `sra.spec.json`), `check` (trace requirements to files), `review` (human approve/reject), `push` (publish traceability), `status`, `list`, `projects`, `formats`, `doctor`.

The behaviour worth knowing before editing:

- **`src/lib/` holds the logic; `src/commands/` is mostly orchestration.** `spec.js` (extract/merge requirement groups), `formats.js` (platform registry client), `scanner.js` (codebase scan + evidence matching), `progress.js` (SSE consumer with polling fallback), `traceability.js` (the record `push` writes). Tests target `lib/`, not the commands.
- **Round-trip is format-aware, and must stay that way.** `sync` records `source: {section, index, kind}` on every extracted group, read from `GET /api/formats/:id`. `push` writes content back **only** into `feature-list` sections; for every other format it writes just `metadata.cliTraceability`. Writing IEEE's `systemFeatures` into a Volere/ISO/Agile document injects a section the format does not define and that nothing renders — `cli/tests/push.test.js` guards this.
- **`push` merges; it does not overwrite.** The platform owns requirement *content*, the CLI owns *verification state*. `mergeRequirements` walks the remote list and applies only local `metadata`, so an edit made on the website after the last sync survives the next push, a requirement added there is left alone, and one deleted there is not resurrected. A decision is bound to the words it was given: when a requirement matches by id but its text has changed since review, the approval is deliberately dropped and reported rather than restamped onto wording nobody read.
- **Structured requirements must survive the round-trip.** `requirementModel` decides a requirement's shape: `ieee` is a plain string, while `volere-shell` (`rationale`/`fitCriterion`) and `iso-29148` (`rationale`/`verificationMethod`/`source`) are objects. In both the text field is `description`, because that is what the frontend's `isShell` guard, the DOCX exporter and the CLI's `reqToString` all read. Extraction in `cli/src/lib/spec.js` must use `normalizeRequirement`, never `reqToString` — flattening to text at sync time meant `push` wrote plain strings back over the platform's objects and destroyed every fit criterion and verification method. ISO's `verificationMethod` is canonicalised post-generation by `backend/src/formats/normalize.js` (unrecognised → `TBD`, never coerced to a plausible method), because only Gemini receives the response schema at all.
- **`frontend/lib/formats/specs.ts` duplicates the backend descriptors.** `backend/tests/unit/format_mirror.test.js` compares them textually and fails on drift; it exists because ISO was left declaring `requirementModel: "ieee"` on the frontend after the backend moved on.
- **`metadata.cliTraceability` is the format-independent contract** between CLI and web app, rendered by `frontend/components/analysis/cli-traceability-panel.tsx` for every format. Extend it rather than adding new document keys.
- **Generation is always server-side.** `reverse` builds a local digest and posts it to `POST /api/analyze`; it never calls a model itself, because BYOK means the user's key lives on the platform.
- **`sra reverse` proposes, it does not assert.** Heuristic links are marked `proposed` and only `check` promotes them to `verified`.

### Env flags worth knowing when reading code

- `MOCK_AI`, `MOCK_QSTASH` — see Commands section above.
- `GEMINI_MODEL_NAME` — overrides the default model in `BaseAgent`.
- `RAG_SIMILARITY_THRESHOLD` — cosine similarity cutoff for RAG retrieval (default 0.25).

## Removed: the self-hosted model track

There was a `model/` workspace (dataset harvesting, benchmarking, QLoRA fine-tuning scripts) and a `v5.0_roadmap.md` planning a self-hosted stack — Ollama/vLLM for generation, a local embedding model, BullMQ for the queue. Both were deleted on 2026-07-25.

BYOK made the premise obsolete: users supply a key for the provider they choose, so the platform hosts no model and has no reason to fine-tune one. Don't reintroduce a "local provider" concept into `aiService.js`, `BaseAgent.js` or `embeddingService.js` on the strength of that old plan — the provider adapters under `backend/src/services/providers/` are the extension point, and a new provider is a new adapter.
