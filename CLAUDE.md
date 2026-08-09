# CLAUDE.md

## What this is

SRA (Smart Requirements Analyzer) — a pnpm monorepo that turns stakeholder text into requirements specs (IEEE 830, ISO 29148, Volere, Agile PRD) via a multi-agent LLM pipeline, plus a CLI that traces generated specs back to source code. Workspaces: `frontend` (Next.js 16), `backend` (Node/Express API + worker), `cli` (`@sra-srs/sra-cli`).

## Commands

Package manager is **pnpm**. Run from repo root.

```bash
pnpm install                      # install all workspaces
pnpm run dev:all                  # backend + frontend concurrently
pnpm run lint:all                 # eslint across all workspaces (pre-commit hook)
pnpm test:all                     # backend + CLI Jest suites

# Single workspace
pnpm --filter backend test        # MOCK_AI=true, native ESM
pnpm --filter @sra-srs/sra-cli test
pnpm --filter frontend test       # vitest, jsdom

# Backend single file/name
pnpm --filter backend exec jest tests/unit/<file>
pnpm --filter backend exec jest -t "test name"

# Prisma
pnpm --filter backend exec prisma generate
pnpm --filter backend exec prisma migrate dev
```

**Backend tests**: native ESM — use `jest.unstable_mockModule` at the top, then `await import(...)`. Not `jest.mock`.
**CLI tests**: mock network only; file handling uses real temp dirs. Reset `process.exitCode` in `afterAll`.
**Frontend tests**: vitest + jsdom. Don't configure a JSX transform (vitest 4/oxc handles it).
**Dev env flags**: `MOCK_AI=true` skips Gemini; `MOCK_QSTASH=true` (or `NODE_ENV=development`) runs worker in-process.

## Architecture rules

- `routes/` → `controllers/` → `services/` — agents are invoked only from `analysisService.js` and `chatService.js`.
- Extend `BaseAgent` for new agents — retry, timeout, JSON repair live there.
- Generation config is centralized in `llmGenerationConfig.js`, not per-agent.
- Prompt versions live in `utils/versions/` — old versions kept for reproducibility. Check which is active before editing.
- Do not call model providers directly from routes/controllers.
- Do not reintroduce the removed self-hosted model track. Provider adapters under `backend/src/services/providers/` are the supported extension point.
- The `sleep()` between DeveloperAgent sectional calls throttles Gemini rate limits — not dead code.
- `Analysis.rootId`/`parentId` form a version tree, not mutable history.

## AI / analysis pipeline

Enqueue → worker → ProductOwner → RAG retrieval → Architect → Developer (sectional) → diagram repair → reflection/review/critic (max 2 passes, threshold 85) → RAG evaluation → persistence (single `$transaction`).

- Pipeline is **checkpointed**: `pipelineBudget.js` lets a Vercel function run as many stages as fit, then persist and re-enqueue. Every stage after the draft is a yield boundary. `checkpoint.*` fields prevent re-buying AI calls.
- `normalizeScore` rescales provider outputs to 0–100 before comparing against the 85 gate.
- `REFINEMENT_SCHEMAS` must have an entry for every targetable section — unmapped = throw, not fallback.
- `ReviewerAgent`/`CriticAgent` take an optional `spec` format — without it they default to IEEE 830.
- `ChatAgent` uses compact snapshots (`promptCompaction.js`), not the full SRS JSON.

## SRS format rules

Four formats with **materially different** drafting conventions — do not cross-contaminate:
- **IEEE 830 / ISO 29148**: shall-based, `draftingConventionFor` provides normative-language rules.
- **Volere**: testability in fit criterion, `qualityAttributeRulesFor` is empty.
- **Agile PRD**: user stories with Given/When/Then, never "The system shall".
- `srs_drafting_standard.js` is the single source; `srs_drafting_standard.test.js` guards this.
- Identifier prefixes: `deriveProjectPrefix` (e.g., `FTP-REQ-001`).

## Security and tenant isolation

- **Every user-owned read must include `userId` in the query.** Prefer `findFirst({ where: { id, userId } })` over unscoped lookup + application check. Report another user's ID as nonexistent.
- **RAG corpus is per-user.** `retrieveContext`, `searchGoldStandardFragments`, `findReuseCandidate` require `userId`. Absence must not silently perform unscoped retrieval.
- `retrieveContext` takes an options object `{ userId, projectId, limit }` — old positional signature throws.
- AI route `settings` is constrained by `clientAiSettingsSchema` (Zod). Never use `.passthrough()` or `z.record(z.any())`.
- Untrusted text in system prompts is sanitized at one choke point — `constructMasterPrompt` via `promptSanitizer.js`. User prose belongs in the user message, not interpolated into system prompts.
- `toPublicUser` is a whitelist — new `User` fields are withheld by default.
- Never return or log authentication material. Pino instances redact credential paths; `safeUrl` masks query parameters.

## Authentication

- `authMiddleware` validates session on every JWT request (`isSessionActive`). Every `signToken` must include `sessionId`.
- Access tokens are short-lived (15m). `useAuthFetch` refreshes on 401; refresh is deduplicated in `auth-context.tsx` (rotation means concurrent refreshes invalidate each other).
- Refresh token rotation keeps the old token alive until its successor is seen in use (lost-response handling via `prevTokenHash`/`successorConfirmed`).
- Failed refresh must return 401 (not 500). Client signs out on 401, not arbitrary 5xx.
- The five cookie-bearing auth endpoints (`login`, `signup`, `refresh`, `logout`, `exchange`) go through `frontend/app/api/auth/[...path]/route.ts`. URLs in `lib/auth-endpoints.ts`. **Never point them at `NEXT_PUBLIC_BACKEND_URL`** (third-party cookie problem on `vercel.app`).
- Account deletion: soft-delete + session revocation immediately, hard delete via reconciliation sweep. Deletion order: chunks → analyses → projects → user. Audit logs survive with detached subject.

## Frontend rules

- `useAuthFetch` is the central authenticated API path (bearer token).
- Design is light-only — use semantic tokens (`foreground`, `muted-foreground`, `background`), no `dark:` variants.
- Auth/theme state is deferred to `useEffect` post-hydration — do not move back into render.
- Live progress stream must reconnect after interrupted streams; drafting state is committed + live.
- New changelog notes must be registered in `content/changelog/index.ts` (static imports, not globbed).
- Privacy page (`privacy/page.tsx`) names real sub-processors and endpoints — update it when those change.

## CLI rules

- `src/lib/` holds logic; `src/commands/` is orchestration. Tests target `lib/`.
- `sync` and `push` are **format-aware**. `push` writes content only into `feature-list` sections; for other formats it writes only `metadata.cliTraceability`.
- `push` **merges, not overwrites**. Platform owns requirement content, CLI owns verification metadata. When requirement text changes since review, approval is dropped.
- Structured requirements (Volere `rationale`/`fitCriterion`, ISO `verificationMethod`/`source`) must survive the round-trip. Use `normalizeRequirement`, never `reqToString` for extraction.
- `metadata.cliTraceability` is the format-independent contract — extend it rather than adding new document keys.
- `reverse` proposes (marks `proposed`), does not assert. Generation is always server-side (BYOK key lives on platform).
- `frontend/lib/formats/specs.ts` mirrors backend descriptors — `format_mirror.test.js` guards drift.

## Deeper documentation

- [docs/architecture.md](docs/architecture.md) — pipeline lifecycle, checkpointing details, reflection mechanics, prompt versioning, provider adapters, BaseAgent internals.
- [docs/security-and-auth.md](docs/security-and-auth.md) — auth architecture, token rotation, cookie proxy, tenant isolation details, AI settings validation, credential hygiene, account deletion, CSP.
- [docs/frontend.md](docs/frontend.md) — progress stream reconnection, changelog/MDX plumbing, frontend testing, privacy page coupling.
- [ARCHITECTURE.md](ARCHITECTURE.md) — system-level architecture overview with diagrams.
