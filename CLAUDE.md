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

**The pipeline outlives the function that runs it, and only where it says so.** A run needs ~360s; a Vercel function is killed at 300s (`backend/vercel.json`). `pipelineBudget.js` therefore lets one invocation run as many *checkpointed* stages as fit, then persist and re-enqueue itself — `checkpointAndYield` is the pairing of the two, and yielding anywhere a checkpoint has not just been written loses work. The check is `assertBudgetFor(stage, STAGE_COST_MS.next)`, not `assertBudget`: being 1s inside the deadline is not permission to begin 90s of reflection. It reads forward because the plain version shipped, and a production run checkpointed its draft at 220s of a 240s budget, entered a reflection loop with no yield point anywhere in it, and was killed at 300s mid-audit — leaving the row `IN_PROGRESS` behind a stale checkpoint with the progress stream silent until the reconciliation sweep. Every stage after the draft (`diagram_repair`, each reflection pass, `audit_complete`) is now a boundary, and `checkpoint.diagramsRepaired` / `checkpoint.reflection` exist so resuming does not re-buy AI calls an earlier invocation already paid for.

**The quality gate compares against 85, so the number has to be on that scale.** Only Gemini is handed a response schema for the Critic call — BYOK means OpenAI, Claude and Grok answer from the prompt alone, and a model asked to score quality returns `0.86` or `8.6` as readily as `86`. `normalizeScore` in `reflectionStage.js` rescales and writes the result back onto the audit, so the stored benchmark is the number the gate judged. A bare `10` is deliberately *not* rescaled without corroboration from the six 6Cs sub-scores: it is either a perfect 10/10 or a scathing 10/100, and guessing wrong upward issues a failing document as exceptional. An unreadable audit defers to the Reviewer rather than reading as 0 — `undefined >= 85` was false, which spent a refinement pass on feedback that did not exist. Reviewer status goes through `isApprovedStatus`, because "Approved" and "APPROVED_WITH_COMMENTS" are not `=== "APPROVED"`.

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

**Every read of a user-owned row is filtered by the caller, in the query.** Analysis and project ids are not secrets — they appear in URLs, in the CLI's `sra.config.json`, and in the traceability records `sra push` publishes — so a lookup by id alone is a cross-tenant read. Two shipped that way (`getJobStatus`, which returns `resultJson`, and `getFullProjectGraph`); both now take a `userId` and throw if called without one. Prefer `findFirst({ where: { id, userId } })` over `findUnique({ where: { id } })` plus a check afterwards, and report someone else's id exactly as you report a nonexistent one. `tests/unit/ownership_boundaries.test.js` asserts against the Prisma `where` clause, not the return value — the bug is an absent filter, which a return-value assertion cannot see.

**The reuse corpus is per-user, and retrieval must stay that way.** `retrieveContext`, `searchGoldStandardFragments` and `findReuseCandidate` all searched `KnowledgeChunk`/`Analysis` across every account. `retrieveContext` was the serious one: it runs on every analysis, returns the requirement text and `source_title` (the owning project's *name*), and feeds both into the Architect and Developer prompts — so one customer's finalized spec could be reproduced, attributed, into another's document, with no attacker involved. All three now require a `userId`. `retrieveContext` takes an **options object** (`{ userId, projectId, limit }`) specifically so a call site left on the old positional signature throws instead of silently running unscoped; `aiService` skips RAG entirely when `settings.userId` is absent rather than guessing. `tests/unit/rag_tenant_scoping.test.js` asserts on the SQL handed to Prisma, since the filter *is* the fix.

**A bearer token is only as good as its session.** `authMiddleware` calls `isSessionActive(sessionId, userId)` on every JWT-authenticated request. Access tokens are signed for 7 days, so without that lookup `POST /auth/logout` and `DELETE /auth/sessions/:id` both returned success while the token kept working — the product's only two revocation controls did nothing. Every `signToken` call site must therefore include `sessionId`; a token without one is rejected. `rotateSession` updates the existing row rather than creating one, which is what lets refresh keep the same session identity.

**Access tokens are short-lived (15m), and that depends on two things staying true.** `useAuthFetch` refreshes and replays once on a 401 — without it, every call in the app starts failing the moment the token expires, with no recovery until reload. The refresh is deduplicated in module scope in `auth-context.tsx`, because `/auth/refresh` **rotates**: two concurrent refreshes mean the second presents a cookie the first just invalidated, and the user is signed out mid-session. Don't add a second refresh path; call `refreshAccessToken` from the context.

**The five cookie-bearing auth calls go through this app's own origin, and must stay there.** `frontend/app/api/auth/[...path]/route.ts` proxies `login`, `signup`, `refresh`, `logout` and `exchange` to the backend; `lib/auth-endpoints.ts` is the only place those URLs are built. Frontend and backend are separate deployments on `vercel.app`, which is on the Public Suffix List — so they are different *sites*, and a cookie the backend sets is a third-party cookie. Safari blocks those and Chrome blocks them in Incognito, which meant the refresh cookie never arrived and the user was signed out every fifteen minutes. Pointing any of those five back at `NEXT_PUBLIC_BACKEND_URL` reintroduces it. Everything else calls the backend directly and authenticates with a bearer header, which no cookie policy touches. The proxy forwards the browser's `Origin`, so the backend's `requireTrustedOrigin` guard still sees the real one, and rewrites `SameSite=None` to `Lax` because the cookie is now first-party.

**Rotation keeps the superseded refresh token alive until its replacement is seen in use.** `Session.prevTokenHash` + `successorConfirmed` (see `sessionService.js`). Rotation used to retire the old token the instant the new one was written, so a rotation response the browser never received — a tab closed mid-request, a dropped connection — left it holding a token the server had already invalidated. Presenting the old token *after* the replacement has been used is a replay and revokes the session; presenting it before is the lost-response case and is honoured.

**A failed refresh must answer 401, and the client signs out only on 401.** `refreshToken` in `authController.js` throws with an explicit `statusCode` — a bare `Error` defaults to 500 in `errorMiddleware`, and the client deliberately reads 5xx as "the server said nothing" so a cold start cannot end a session. That mismatch produced an app that stayed signed in, let the user navigate, and failed every request behind it. The sign-out itself lives in `refreshAccessToken`, the one place every caller funnels through, not in `/auth/me`'s path — which runs at mount and so never fired for a session that expired mid-use.

**Erasure follows the foreign keys, not the model graph.** `User → Analysis` and `KnowledgeChunk → Analysis` are both `ON DELETE RESTRICT`, so `prisma.user.delete()` fails outright for anyone who has finalized an analysis. `accountDeletionService.hardDeleteUser` deletes chunks → analyses → projects → user in that order inside one transaction; `AuditLog` is `ON DELETE SET NULL` and deliberately survives with the subject detached. Erasure is two-phase: `DELETE /auth/me` soft-deletes and revokes sessions immediately, the reconciliation sweep purges after `DELETION_GRACE_DAYS`. `validateSession`, `loginUser` and `verifyApiKey` all refuse a soft-deleted account, so "deleted" means unusable at once, not merely scheduled.

**The privacy policy is part of the code.** `frontend/app/privacy/page.tsx` names the sub-processors the backend actually calls, the retention periods in `reconciliationService`, and endpoints that exist (`GET /auth/me/export`, `DELETE /auth/me`, surfaced by `components/privacy-settings.tsx`). Changing any of those means changing that page — a policy describing a control the product lacks is a misrepresentation, not a stale doc.

**The frontend CSP carries a per-request nonce, which is why no page is static.** `middleware.ts` builds the policy; `next.config.ts` deliberately no longer sets `Content-Security-Policy`. `app/layout.tsx` awaits `headers()` purely to force dynamic rendering — verified necessary: with the pages statically rendered, Next stamped **zero** nonces onto 17 script tags while `'strict-dynamic'` was in force, which blocks every script. If you restore static rendering, you must also restore `script-src 'unsafe-inline'`, and that trade should be a deliberate one.

**Nothing that authenticates leaves in a response or a log.** `toPublicUser` in `authService` is a whitelist, so a field added to `User` later is withheld by default rather than published (signup and login used to return the bcrypt hash). Both pino instances redact credential-shaped paths, and `middleware/logger.js`'s `safeUrl` masks credential-bearing query parameters — without it the OAuth callbacks wrote live authorization codes into the access log. `dataExportService` follows the same rule: it describes stored keys, OAuth tokens and `Session.token` by metadata and never emits their values.

`settings` on every AI route is constrained by one shared `clientAiSettingsSchema` in `utils/validationSchemas.js`. It must never be `.passthrough()` or `z.record(z.any())`: `settings` flows into `analyzeText`, where `systemPrompt` replaces the system prompt outright, `systemPromptExtension` is interpolated into it, and `apiKey` would let a request nominate the credential it is billed to. Zod strips unknown keys by default and `validate()` writes the parsed body back, so *omitting* `.passthrough()` is the enforcement. Add a key there only if a client is genuinely entitled to choose it.

Untrusted text that reaches a *system* prompt is sanitized in `utils/promptSanitizer.js` and applied at one choke point — `constructMasterPrompt`. `projectName` is the case that matters: `aiService` extracts it from raw stakeholder input by regex, and the prompt templates interpolate it into instruction sentences. Add new untrusted keys to `sanitizePromptSettings` rather than sanitizing at the call site, and keep user-supplied prose in the user turn (`analyzeText`'s `text`), never templated into a system prompt.

### Frontend

Next.js App Router under `frontend/app/`: `/analysis/[id]` (workspace + version compare), `/projects/[id]`, `/auth/{login,signup}`, `/settings`, `/changelog`. Result tabs and diagram components are lazy-loaded via `next/dynamic` for bundle size. Diagrams render through `@xyflow/react` + Mermaid. All API calls funnel through the `useAuthFetch` hook (bearer token handling). Client-side auth/theme state is deferred to `useEffect` post-hydration to avoid Next.js SSR hydration mismatches — don't move that logic back into render. There is no dark theme — the design system is light-only, so components should use the semantic tokens (`foreground`, `muted-foreground`, `background`) rather than hardcoded colours, but no `dark:` variants are expected.

**The live progress stream must assume it will be cut off.** `useAnalysisProgress` reads `GET /analyze/:id/stream` with fetch, not `EventSource` (which cannot send the Authorization header). Its effect used to depend only on `[id, token, active]` — none of which a dropped connection touches — so a stream ended by a backgrounded iOS tab, a sleeping laptop or the serverless function's own 300s limit was never re-opened, and returning to the tab showed a page frozen on the last stage it had heard about, for a run that had often already finished. It now reconnects on a body that ends without a `terminal` event, backs off while the stream stays unavailable, reconnects immediately on `visibilitychange`, and does not retry a 401/403. Drafting text is kept as *committed + live*: `sectionBreak` settles a section, `tokenReset` rewinds only the section in flight. A retry used to clear the reader's whole document, so one rate-limited call late in the run erased four minutes of visible drafting. What reaches the panel at all is decided by `jsonTextStream.js`'s skip list and `tokenStream.js`'s per-section repeat filter — the appendices prompt carries the whole document so far, and a model extending it will sometimes replay it first.

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
