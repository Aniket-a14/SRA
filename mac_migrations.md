# mac_migrations.md — Context Transfer for a Fresh Claude Code Session (Windows → macOS)

> **You are the new brain in a new body.** This file is a one-time handoff written by the previous
> Claude Code session (Windows 11, `c:\3rd_Year\SRA`, 2026-08-13) for the first Claude Code session
> on the user's new MacBook. It is *not* project documentation. It is disposable.
>
> **Read this whole file first. Do not skim.**

---

## 0. YOUR FIRST ACTIONS, IN ORDER

Do these before doing any development work the user asks for.

1. **Read this file end to end.**
2. **Recreate the memories** in §3 into the new machine's memory directory
   (`~/.claude/projects/<project-slug>/memory/`), one file per memory, plus the `MEMORY.md` index.
   The slug on the new machine will differ from Windows (`c--3rd-Year-SRA`) — it is derived from the
   new absolute path (e.g. `-Users-<you>-3rd-Year-SRA`). Let Claude Code create it naturally on
   first run, or write it to whatever path the harness reports.
3. **Do the environment bring-up** in §6 and confirm each step actually passes. Do not report
   "set up" until `pnpm test:all` is green.
4. **Tell the user what you restored, and what you could NOT restore** (secrets — see §7).
5. **Only then** run the self-destruct in §10 — and only when the user confirms.

Authority order once you're running: **`CLAUDE.md` in the repo root > this file.** `CLAUDE.md` is
checked in, versioned, and stays true. This file is a snapshot of 2026-08-13 and will rot. If they
conflict, `CLAUDE.md` wins and this file is wrong.

---

## 1. WHO THE USER IS

- **Name / git identity**: Aniket Saha — `aniketsahaworkspace@gmail.com`
- **GitHub**: `Aniket-a14`, repo `Aniket-a14/SRA`
- **Context**: 3rd-year engineering student. The repo lives under a `3rd_Year` tree; SRA is the
  flagship academic + portfolio project (the `COMMANDS/ENGINEERING_MANUAL.md` is framed around
  senior-placement preparation). Treat it as a real production system, because it is deployed and
  serving traffic — not as coursework.
- **Working style observed across sessions**:
  - Runs a genuinely rigorous SDLC for a solo project: CodeRabbit + Codex + CodeQL + Dependabot +
    Snyk + Renovate + Spectral + Lighthouse, ~19 GitHub Actions workflows, pre-commit hooks,
    issue-driven work, PR-per-change.
  - Cares intensely about **security and tenant isolation**. A large fraction of recent commits are
    security fixes. Take that seriously — never weaken a `userId` scope for convenience.
  - Writes commit messages and changelog entries as **prose that states the user-visible failure and
    the mechanism**, not as `fix: foo`. Match that voice (see §5).
  - Expects work to be *finished* — tests run, lint clean, CI considered — not sketched.
- **Pronouns**: not stated. Use they/them.

---

## 2. WHAT THE PROJECT IS

**SRA (System Requirements Analyzer)** — a pnpm monorepo that turns raw stakeholder text into formal
requirements specifications via a multi-agent LLM pipeline, plus a CLI that traces generated specs
back to source code.

> Note: the name was recently changed from "**Smart** Requirements Analyzer" to "**System**
> Requirements Analyzer" (commit `5d0cb4d`). `CLAUDE.md` still says "Smart" in its first line —
> that is stale; the README is correct. Low priority, but if you touch that line, fix it.

### Workspaces
| Workspace | Stack | Notes |
|---|---|---|
| `frontend/` | Next.js 16, React, Tailwind, BlockNote editor, Mantine, Radix | dev on port **3001**; vitest + jsdom; Playwright configured but E2E is an open issue |
| `backend/` | Node/Express, **native ESM**, Prisma 7.9.0, Jest | dev on port **3000**; API + worker |
| `cli/` | `@sra-srs/sra-cli`, published to npm, v4.2.0 | Jest, ESM |

Monorepo version: **4.2.0**. Node engine: **>=20.19.0** (Windows box ran v25.2.1, pnpm 10.33.3).

### Infrastructure (live)
- **Frontend**: Vercel → https://sra-xi.vercel.app
- **Backend**: Vercel (`backend/vercel.json`) — this is why the 300s function limit and the
  checkpointed pipeline exist.
- **Database**: Supabase Postgres + **pgvector** (project ref and region are in `backend/.env`,
  which you are carrying across by hand — see §7). Pooler host on 6543, **direct on 5432** —
  migrations must use the direct port.
- **Queue**: Upstash **QStash** (signed webhooks) + Upstash **Redis** (`rediss://`, endpoint in `backend/.env`).
- **LLM**: **BYOK** — users supply their own provider keys (Gemini / OpenAI / Claude / Grok).
  Server-side env keys exist only for **embeddings**. This distinction matters constantly.
- **IaC**: `terraform/` with **local state** (open issue #129 wants remote state).
- **Docker**: `docker-compose.yml` / `docker-compose.prod.yml`, nginx in front.

### The pipeline (memorize this shape)
```
Enqueue → worker → ProductOwner → RAG retrieval → Architect → Developer (sectional)
  → diagram repair → reflection/review/critic (max 2 passes, gate = 85) → RAG evaluation
  → persistence (single Prisma $transaction)
```
It is **checkpointed**: `pipelineBudget.js` runs as many stages as fit inside the Vercel time budget,
persists, then re-enqueues. Every stage after the draft is a yield boundary. `checkpoint.*` fields
exist so a resumed run does not re-buy AI calls. `assertBudgetFor` reads *forward* — a stage starts
only if it fits in the time remaining.

### Four SRS formats — do not cross-contaminate
IEEE 830 · ISO/IEC/IEEE 29148 · Volere · Agile PRD. `srs_drafting_standard.js` is the single source
of truth and `srs_drafting_standard.test.js` guards it. IEEE/ISO are shall-based; Volere puts
testability in the fit criterion; Agile PRD uses user stories with Given/When/Then and must **never**
say "The system shall".

**Everything else architectural is in `CLAUDE.md` and `docs/`. Read `CLAUDE.md` on your first turn
in the repo — the harness loads it automatically, but read it consciously.**

Deeper docs:
- `ARCHITECTURE.md` — system overview + diagrams
- `docs/architecture.md` — pipeline lifecycle, checkpointing, reflection, prompt versioning, BaseAgent
- `docs/security-and-auth.md` — token rotation, cookie proxy, tenant isolation, CSP
- `docs/frontend.md` — progress stream reconnection, changelog/MDX plumbing
- `docs/operations/OPERATIONS.md` — deployment, backup, DR
- `docs/security/ENCRYPTION.md`, `docs/security/INCIDENT_RESPONSE.md`
- `COMMANDS/*.txt` — 12 numbered runbooks (package mgmt, dev servers, testing, DB, backups, docker,
  secrets, git, troubleshooting, quick ref, terraform, gh CLI)

---

## 3. MEMORIES TO RECREATE (do this verbatim)

The Windows machine held these four memories as a flat `MEMORY.md`. On the new machine, write them
as **individual files with frontmatter** (the correct format), then rebuild the index.

### File: `byok-provider-keys.md`
```markdown
---
name: byok-provider-keys
description: SRA is BYOK — user-supplied API keys drive generation; server env keys are embeddings-only.
metadata:
  type: project
---

LLM generation in SRA runs on the user's own provider API key (BYOK). The server-side
`GEMINI_API_KEY` and friends exist for **embeddings only**, not for drafting.

**Why:** A missing user key is a user-facing configuration error, not a server outage — and
server env keys must never be silently used to fulfil a generation request the user is supposed
to be paying for.

**How to apply:** When debugging "generation failed", check the user's stored provider key before
suspecting the env. Never fall back from a user key to a server key. Related: [[resumable-pipeline]].
```

### File: `prisma-migration-connection.md`
```markdown
---
name: prisma-migration-connection
description: Compare schemas with `prisma migrate diff`; run migrations over the direct 5432 port, not the 6543 pooler.
metadata:
  type: project
---

Use `prisma migrate diff` to compare the Prisma schema against the live database. Connect on the
**direct** Supabase port **5432** (`DIRECT_URL`) for migrations — not the pooler on **6543**
(`DATABASE_URL`).

**Why:** The transaction pooler cannot hold the advisory locks and session state Prisma Migrate
needs; migrations run through it fail or half-apply.

**How to apply:** `DATABASE_URL` (6543, pooled) for the running app; `DIRECT_URL` (5432) for
`migrate dev` / `migrate deploy` / `migrate diff`.
```

### File: `resumable-pipeline.md`
```markdown
---
name: resumable-pipeline
description: Analysis pipelines checkpoint each stage and resume via POST /analyze/:id/resume.
metadata:
  type: project
---

A failed or timed-out analysis does not restart from zero. Stages (ProductOwner, RAG, Architect,
Developer draft, diagram repair, reflection passes, evaluation) are checkpointed, and a run is
continued with `POST /analyze/:id/resume`.

**Why:** The backend runs on Vercel with a 300s function ceiling. A full pipeline exceeds it, and
re-running completed stages re-buys the AI calls the user already paid for.

**How to apply:** When a run is stuck, resume it rather than re-analyzing. `checkpoint.*` fields on
the Analysis record say where it stopped. See `pipelineBudget.js` and `assertBudgetFor`.
Related: [[byok-provider-keys]].
```

### File: `ci-dependency-hygiene.md`
```markdown
---
name: ci-dependency-hygiene
description: CI fails on `pnpm audit --prod`; dev-only tooling must live in devDependencies.
metadata:
  type: feedback
---

CI gates on `pnpm audit --prod`. Anything that is not needed at runtime belongs strictly in
`devDependencies`.

**Why:** A dev tool listed as a production dependency drags its CVEs into the `--prod` audit and
fails the build for a package that never ships.

**How to apply:** Before adding a dependency, decide which block it belongs in. For transitive CVEs
in packages we don't control, add a `pnpm.overrides` entry in the root `package.json` — and keep the
override **inside the installed major** (crossing a major broke `minimatch@3` here once, because
`brace-expansion@5` has a different API than the v1 it expected).
```

### File: `MEMORY.md` (index — replaces whatever exists)
```markdown
- [BYOK Providers](byok-provider-keys.md) — user API keys drive generation; env keys are embeddings-only.
- [Prisma Migrations](prisma-migration-connection.md) — `migrate diff`, and use direct 5432, not pooler 6543.
- [Resumable Pipeline](resumable-pipeline.md) — checkpointed stages, resume via `POST /analyze/:id/resume`.
- [CI & Dependencies](ci-dependency-hygiene.md) — CI gates on `pnpm audit --prod`; dev tools in devDependencies.
```

**Candidate memories worth adding once you've confirmed them on the new machine** (do not write
blindly — verify first):
- The macOS-specific bring-up quirks you actually hit in §6.
- The user's commit-message voice (§5) — if you find yourself re-deriving it, write it as a
  `feedback` memory.

---

## 4. STANDING INSTRUCTIONS / INVARIANTS

`CLAUDE.md` is the authoritative list and it is thorough. These are the ones that have actually been
violated and caused incidents, so they carry the most weight:

**Security & isolation**
- Every user-owned read includes `userId` in the query. Prefer
  `findFirst({ where: { id, userId } })` over unscoped lookup + application-level check.
  Another user's ID is reported as **nonexistent**, not forbidden.
- The RAG corpus is **per user**. `retrieveContext`, `searchGoldStandardFragments`,
  `findReuseCandidate` all require `userId`; absence must throw, never silently retrieve unscoped.
- `retrieveContext` takes an options object `{ userId, projectId, limit }` — the old positional
  signature throws deliberately.
- AI-route `settings` is constrained by `clientAiSettingsSchema` (Zod). **Never** `.passthrough()`,
  never `z.record(z.any())` — that was a prompt-injection hole once.
- Untrusted text enters system prompts at exactly one choke point: `constructMasterPrompt` via
  `promptSanitizer.js`. User prose belongs in the user message.
- `toPublicUser` is a whitelist. New `User` fields are withheld by default.
- Never return or log auth material. Pino redacts credential paths; `safeUrl` masks query params.

**Auth**
- `authMiddleware` validates the session on every JWT request (`isSessionActive`). Every
  `signToken` must include `sessionId`.
- Access tokens are 15m. `useAuthFetch` refreshes on 401; refresh is deduplicated in
  `auth-context.tsx` because rotation means concurrent refreshes invalidate each other.
- Refresh rotation keeps the old token alive until its successor is seen in use
  (`prevTokenHash` / `successorConfirmed`).
- A failed refresh returns **401, not 500**. The client signs out on 401, not on arbitrary 5xx.
- The five cookie-bearing endpoints (`login`, `signup`, `refresh`, `logout`, `exchange`) go through
  `frontend/app/api/auth/[...path]/route.ts`. **Never** point them at `NEXT_PUBLIC_BACKEND_URL` —
  third-party cookies don't survive on `vercel.app`.

**Architecture**
- `routes/` → `controllers/` → `services/`. Agents are invoked only from `analysisService.js` and
  `chatService.js`. Never call a model provider from a route or controller.
- New agents extend `BaseAgent` (retry, timeout, JSON repair live there).
- Generation config is centralized in `llmGenerationConfig.js`, never per-agent.
- Prompt versions live in `utils/versions/`; old versions are kept for reproducibility — check which
  is active before editing.
- **Do not reintroduce the removed self-hosted model track.** Provider adapters under
  `backend/src/services/providers/` are the supported extension point.
- The `sleep()` between DeveloperAgent sectional calls throttles Gemini rate limits. It is not dead
  code. Someone will try to delete it. Don't.
- `Analysis.rootId` / `parentId` form a **version tree**, not mutable history.
- `REFINEMENT_SCHEMAS` must have an entry for every targetable section — unmapped means **throw**,
  not fall back to the whole-document schema. (That exact fallback is what silently deleted every
  diagram from finished documents.)
- `normalizeScore` rescales provider output to 0–100 before comparing against the 85 gate.

**Testing**
- Backend tests are **native ESM**: `jest.unstable_mockModule` at the top, then `await import(...)`.
  Plain `jest.mock` does not work.
- CLI tests mock network only; file handling uses real temp dirs. Reset `process.exitCode` in
  `afterAll`.
- Frontend tests are vitest + jsdom. Do **not** configure a JSX transform — vitest 4 / oxc handles it.

**Frontend**
- Design is **light-only**. Use semantic tokens (`foreground`, `muted-foreground`, `background`).
  No `dark:` variants.
- Auth/theme state is deferred to `useEffect` post-hydration. Do not move it back into render.
- New changelog notes must be registered in `content/changelog/index.ts` (static imports, not globbed).
- `privacy/page.tsx` names real sub-processors and endpoints — update it when those change.

**CLI**
- `src/lib/` holds logic, `src/commands/` is orchestration; tests target `lib/`.
- `push` **merges, never overwrites**: the platform owns requirement content, the CLI owns
  verification metadata. If requirement text changed since review, approval is dropped.
- `sync`/`push` are format-aware. `push` writes content only into `feature-list` sections; for other
  formats it writes only `metadata.cliTraceability`.
- `metadata.cliTraceability` is the format-independent contract — extend it, don't add new document keys.
- `reverse` **proposes** (marks `proposed`); it never asserts. Generation is always server-side.
- `frontend/lib/formats/specs.ts` mirrors backend descriptors; `format_mirror.test.js` guards drift.

---

## 5. HOW TO WRITE HERE (the house voice)

Commits and changelog entries in this repo are written as **plain declarative prose describing the
user-visible failure and its mechanism**. Real examples from the log:

- `Stop the reuse corpus from being everyone's corpus`
- `Make an auth failure say so, instead of leaving a blank corpse`
- `Let a session survive its own rotation, and stop hiding failures`
- `Give thinking models room to finish, and collapse the two input layers`
- `Write the agents to each format's own method, not one house style`

Not `fix(auth): handle 401`. Imperative mood, no scope prefixes, no emoji in the subject line.
Changelog entries under `CHANGELOG.md` are longer: they state what broke for the user, then the
mechanism, then the fix, and often cite a production date and timing (e.g. "Production run
2026-07-29: draft checkpointed at 220s, killed at 300s during the second reflection pass").

Commit trailer used on this project:
```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
PR bodies end with:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Workflow: branch → PR → CodeRabbit/Codex review → address findings → merge. Never commit straight to
`main`. Commit or push **only when asked**.

---

## 6. macOS BRING-UP CHECKLIST

Run these in order. Verify each; don't assume.

```bash
# 1. Toolchain (Homebrew)
brew install node@22 git gh postgresql@16   # postgresql for the psql/pg_dump client only
corepack enable && corepack prepare pnpm@10.33.3 --activate
node -v      # must satisfy >=20.19.0
pnpm -v

# 2. Clone
gh auth login
git clone https://github.com/Aniket-a14/SRA.git ~/3rd_Year/SRA
cd ~/3rd_Year/SRA

# 3. Install (postinstall runs `prisma generate` in backend)
pnpm install

# 4. Secrets — SEE §7. Nothing works before this.
#    backend/.env and frontend/.env are gitignored and DO NOT come with the clone.
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# ...then fill in real values from the sources listed in §7.

# 5. Prisma
pnpm --filter backend exec prisma generate

# 6. Verify
pnpm run lint:all
pnpm test:all          # backend runs with MOCK_AI=true
pnpm --filter frontend test

# 7. Run
pnpm run dev:all       # backend :3000, frontend :3001
```

**Optional / as needed**
```bash
brew install --cask docker      # docker-compose.yml, docker-compose.prod.yml
brew install terraform          # terraform/ uses LOCAL state — see §7 warning
pip install pre-commit && pre-commit install   # .pre-commit-config.yaml
npm i -g @sra-srs/sra-cli       # or use the workspace copy
```

### Windows → macOS gotchas to expect
| Thing | Windows behavior | macOS |
|---|---|---|
| Shell | PowerShell primary, Git Bash secondary | zsh. All the `COMMANDS/*.txt` runbooks with PowerShell syntax need translating. |
| Paths | `c:\3rd_Year\SRA` | `~/3rd_Year/SRA`. Anything hardcoding a drive letter breaks. |
| Line endings | CRLF risk | Set `git config --global core.autocrlf input`. Check nothing lands as CRLF in `.sh` files. |
| Filesystem case | case-insensitive | macOS default is *also* case-insensitive, so import-casing bugs still hide. Linux CI will catch them — don't assume green locally means green in Actions. |
| `cross-env` | needed for env vars in scripts | Already used throughout; keep it. Do not "simplify" `cross-env NODE_OPTIONS=...` away just because zsh doesn't need it — CI and Windows contributors do. |
| Node memory flags | `--max-old-space-size=8192` on frontend dev/build | Keep. Next.js 16 builds here are heavy. |
| `postgresql@16` | pinned client version (there was a CI fix `41195b2` for exactly this) | `brew link` it or add to PATH so `pg_dump` major version matches the server. |
| Claude Code permissions | `~/.claude/settings.json` on the Windows box is full of `PowerShell(...)` and `c:\\...` allow-rules **from other projects** | **Do not copy that file across.** Let the Mac build its own allowlist. |
| Global `CLAUDE.md` | none existed on Windows | Nothing to migrate. |

---

## 7. WHAT CANNOT BE MIGRATED IN THIS FILE — SECRETS

**No secret values are in this document, by design.** `backend/.env` and `frontend/.env` are
gitignored, so they will not arrive with `git clone`. They must be reconstructed by hand.

Move them across on a USB drive / password manager / encrypted transfer — **not** through chat, not
through a commit, not through a gist.

### `backend/.env` — variables present on the Windows box
```
NODE_ENV  PORT  BACKEND_URL  FRONTEND_URL  ANALYZER_URL  ALLOWED_ORIGINS
DATABASE_URL  DIRECT_URL                       # Supabase, pooler 6543 / direct 5432
REDIS_URL                                      # Upstash rediss://
QSTASH_TOKEN  QSTASH_CURRENT_SIGNING_KEY  QSTASH_NEXT_SIGNING_KEY
JWT_SECRET  COOKIE_SECRET  CSRF_SECRET         # JWT_SECRET: >= 256 bits (see PR #151)
ENCRYPTION_KEY  ENCRYPTION_SALT
BACKUP_ENCRYPTION_KEY  BACKUP_ENCRYPTION_SALT  # losing these makes existing backups unrestorable
INTERNAL_API_SECRET  SRA_API_KEY
GEMINI_API_KEY                                 # embeddings only
GEMINI_MODEL_NAME  GEMINI_UTILITY_MODEL_NAME
GEMINI_EMBEDDING_MODEL  GEMINI_EMBEDDING_DIMENSIONS
OPENAI_MODEL_NAME  CLAUDE_MODEL_NAME  GROK_MODEL_NAME   # names, not keys — keys are BYOK
GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET  GOOGLE_REDIRECT_URI
GITHUB_CLIENT_ID  GITHUB_CLIENT_SECRET  GITHUB_CALLBACK_URL
VERCEL_API_TOKEN
MOCK_AI  MOCK_QSTASH
LOGIN_RATE_LIMIT  MAX_CONCURRENT_ANALYSES  MAX_DAILY_ANALYSES
RAG_SIMILARITY_THRESHOLD  ALLOW_BROAD_CORS_WILDCARD  AI_NAME
```

### `frontend/.env`
```
NEXT_PUBLIC_BACKEND_URL     # http://localhost:3000 in dev
NEXT_PUBLIC_GEMINI_MODELS
```

### Where to re-obtain each, if the files are lost
| Secret | Source |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Supabase dashboard → the SRA project → Connect |
| `REDIS_URL`, `QSTASH_*` | Upstash console → the SRA Redis + QStash resources |
| `GOOGLE_*` | Google Cloud Console → OAuth credentials |
| `GITHUB_*` | GitHub → Settings → Developer settings → OAuth Apps |
| `VERCEL_API_TOKEN` | Vercel → Account Settings → Tokens |
| `GEMINI_API_KEY` | Google AI Studio |
| `JWT_SECRET` / `COOKIE_SECRET` / `CSRF_SECRET` | **Regenerating invalidates every live session.** Copy, don't regenerate, unless you intend to log everyone out. |
| `ENCRYPTION_*` / `BACKUP_ENCRYPTION_*` | **Copy. Never regenerate.** These decrypt stored data and existing backups. Regenerating them is unrecoverable data loss. |

### Drift to fix while you're in there
`backend/.env` on Windows has `ANALYZER_URL`, `INTERNAL_API_SECRET` and `SRA_API_KEY`, which are
**missing from `backend/.env.example`**; and `.env.example` has `ALLOWED_ORIGINS`,
`ALLOW_BROAD_CORS_WILDCARD`, `AI_NAME`, `LOGIN_RATE_LIMIT`, `MAX_*`, `RAG_SIMILARITY_THRESHOLD`
which the local file lacks. Worth reconciling as a small PR. Also: **issue #131** — `frontend/` has
no `.env.example`. It actually does now (`frontend/.env.example` exists with 2 keys), so #131 may be
closeable — verify before closing.

### Other non-git state on the old machine
- `terraform/` uses **local state**. `*.tfstate` and `*.tfvars` are gitignored and there is a
  `terraform/terraform.tfstate.1769920708.backup` referenced in `.gitignore`. **Copy the tfstate
  across manually or you lose the ability to `terraform destroy`/modify existing infra.**
  (Open issue #129 wants this moved to a remote backend — good first task on the Mac.)
- `backups/` directory — local backup artifacts. Copy if you want restore-testing history.
- `.venv/` at repo root — recreate, don't copy.
- `~/.claude/projects/c--3rd-Year-SRA/` — the memory dir. §3 already carries its content.

---

## 8. WHERE THINGS STAND (as of 2026-08-13)

### Just landed
- `d51b6d6` **Stop tracking terraform/tfplan (contains plaintext secret values)** — PR #152,
  **merged**. `*.tfplan` is now gitignored. Note: the file was untracked going forward; if it was
  ever committed with real secret values, **those values are still in git history** and should be
  treated as compromised → rotate them. Confirm whether that was done.
- `5d0cb4d` Project renamed "Smart" → "System" Requirements Analyzer.
- PR #150 (merged): batch of security/quality fixes — password policy, IDOR, MD5 removal, DoS,
  Docker image pinning — closing 10 open issues, plus 4 high-severity dependency CVEs that were
  failing the `pnpm audit` gate, plus CodeRabbit/Codex review findings.
- The **[Unreleased]** section of `CHANGELOG.md` is substantial and unreleased: generation-reliability
  fixes (Appendices refinement schema, checkpointed pipeline tail, score normalisation, reviewer
  verdict parsing, Critic output budget) and workspace fixes (progress-stream reconnection,
  duplicated drafting text, retry erasing the draft, session-expiry dedup). **A 4.3.0 release cut is
  the obvious next milestone.**

### Open right now
- **PR #151** — `Raise JWT_SECRET minimum to 256 bits and add nginx hardening headers`
  (branch `fix/jwt-secret-length-nginx-headers`). **Still open.** Likely first thing to finish.
  Relates to issue #127 (nginx lacks TLS termination + security headers).

### Open issues, grouped
**Security (do first)**
- #117 `[SECURITY][critical]` Plaintext secrets in `terraform/terraform.tfvars`
- #118 `[SECURITY][high]` Missing Helmet.js security headers in Express
- #127 Nginx lacks TLS termination and security headers → PR #151 partially addresses
- #128 Access tokens stored in browser localStorage
- #148 Integrate Snyk CLI for container & dependency auditing

**Infrastructure**
- #129 Terraform uses local state instead of remote backend
- #140 Enable pgvector engine for native sub-15ms vector RAG retrieval
- #144 Ollama local model adapter for zero-cost offline worker fallback
  — ⚠️ read this one against the `CLAUDE.md` rule "do not reintroduce the removed self-hosted model
  track". If it is implemented, it must be a **provider adapter** under
  `backend/src/services/providers/`, not a revival of the deleted model workspace.
- #145 Meilisearch for sub-5ms full-text requirement search
- #149 Grafana + Prometheus for server & queue metrics

**Architecture / reliability**
- #135 Semantic section & RAG cache for the multi-stage pipeline
- #136 Streaming sectional chunks via SSE for real-time UI rendering
- #137 Dynamic agent prompt compaction & context budgeting
- #138 Pre-flight JSON & Mermaid AST auto-repair in `BaseAgent`
- #139 Rate-limit-aware BYOK provider failover router
- #141 Upstash QStash Workflows for resumable multi-stage execution
- #142 Inngest for durable agent step execution & automatic retries

**DevEx / quality**
- #143 Automate Spectral API linting + CodeRabbit in CI
- #146 Bruno CLI for git-native API collection testing
- #147 Playwright for E2E frontend visual & user-flow testing
- #131 Missing `frontend/.env.example` — **probably already fixed, verify and close**

### Branches on the old machine (all pushed to origin, nothing stranded)
`main` · `security/remove-tracked-tfplan-secrets` (merged) ·
`fix/jwt-secret-length-nginx-headers` (PR #151, open) ·
`fix/security-quality-issues-batch` (merged) · `agent/quota-fallback-and-auth-fixes` ·
`codex/audit-production-readiness` · `snyk-fix-3f4d3b294dbcd5eb01a46487d5e2171d` (remote) ·
`master` (stale local, ignore)

Working tree was **clean** at handoff. Nothing uncommitted was lost.

### Suggested first moves on the Mac
1. Finish and merge **PR #151**.
2. **#117** — plaintext secrets in `terraform.tfvars`, marked critical, still open. Pairs naturally
   with #129 (remote state).
3. **#118** — Helmet.js. Small, high severity, quick win.
4. Cut **v4.3.0** from the accumulated `[Unreleased]` changelog.
5. Reconcile the `.env.example` drift noted in §7.

---

## 9. THINGS THAT WILL BITE YOU (hard-won, from the changelog)

- A Vercel function dies at **300s** with no warning. Any new pipeline stage must sit behind a yield
  boundary and an `assertBudgetFor` check.
- Provider score outputs are **not** on a common scale under BYOK. `0.86`, `8.6`, `86` all appear.
  `normalizeScore` exists for that; an ambiguous whole number is only rescaled when the six 6Cs
  sub-scores corroborate it, because `10` is either a perfect 10/10 or a scathing 10/100.
- `undefined >= 85` is `false` — a truncated Critic response used to burn a refinement pass on
  feedback that did not exist. It now defers to the Reviewer.
- `"Approved"` and `"APPROVED_WITH_COMMENTS"` are not `=== "APPROVED"`. Signed-off drafts were being
  refined anyway.
- The progress SSE stream can die from *anything* — a backgrounded iOS tab, a sleeping laptop, the
  function's own limit. It must reconnect on drop, on tab-return, and back off while unavailable.
- Refresh-token rotation means concurrent refreshes invalidate each other. That's why the dedup in
  `auth-context.tsx` exists, and why a caller joining an in-flight refresh must not return before
  the sign-out path has been decided.
- `pnpm.overrides` that cross a major boundary break things (`minimatch@3` / `brace-expansion@5`).
  Keep overrides inside the installed major.
- Local green ≠ CI green: Linux CI is case-sensitive, macOS is not.

---

## 10. SELF-DESTRUCT

Run **only** after §0 steps 1–4 are complete and the user confirms. This is irreversible.

### How this file reached you

It was committed **directly to `main`** and pushed to the public repo, so a plain clone gives it to
you with no extra steps:

```bash
git clone https://github.com/Aniket-a14/SRA.git ~/3rd_Year/SRA
cd ~/3rd_Year/SRA
cat mac_migrations.md
```

Because it is on `main`, removing it is a real commit (or a history rewrite), not a branch deletion.
Both routes are below.

### Case A — delete it with an ordinary commit (recommended)

This file contains **no secret values**. The only thing a history rewrite would buy is hiding a
document whose content is already, by design, non-sensitive — at the cost of breaking every open PR
and every other clone. That trade is not worth it. Prefer this:

```bash
cd ~/3rd_Year/SRA
git checkout main
git pull

git rm mac_migrations.md
git commit -m "Remove the migration handoff, now that it has been read

Its contents live where they belong: the invariants in CLAUDE.md, the
four project memories in the memory directory. The file was only ever
a courier."
git push origin main

git log --oneline -1                 # confirm the removal landed
ls mac_migrations.md 2>/dev/null     # expect: no such file
```

The file is gone from the working tree and from `main` going forward. It remains reachable in
history to anyone who looks for it — which is acceptable precisely because it holds nothing secret.

### Case B — full purge from history

Use this **only** if something sensitive ended up in the file after it was written (an API key
pasted in later, a customer name, credentials). If the file is unmodified from what was handed over,
Case A is correct and this section is over-engineering.

⚠️ **Read before running.** This rewrites every commit after the one that introduced the file, so
every SHA changes. It requires a force-push, it will break every open PR and every other clone,
and PR #151 and any in-flight branch will need rebasing. Given this file contains **no secret
values**, history rewriting is almost never worth it — deleting the file in a normal commit is
usually the right answer. Confirm with the user explicitly before choosing this path.

```bash
cd ~/3rd_Year/SRA

# 0. Safety net
git branch backup/pre-purge-$(date +%Y%m%d-%H%M%S)
git bundle create ~/sra-backup-$(date +%Y%m%d).bundle --all

# 1. Purge from all history (git-filter-repo is the supported tool; filter-branch is deprecated)
brew install git-filter-repo
git filter-repo --path mac_migrations.md --invert-paths --force

# 2. filter-repo drops the remote by design — restore it
git remote add origin https://github.com/Aniket-a14/SRA.git

# 3. Verify it is gone everywhere
git log --all --oneline -- mac_migrations.md   # expect: EMPTY
git rev-list --all --objects | grep mac_migrations   # expect: no output

# 4. Force-push every branch and tag  (COORDINATE FIRST — this rewrites shared history)
git push origin --force --all
git push origin --force --tags

# 5. Local cleanup
rm -f mac_migrations.md
rm -rf .git/refs/original
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

**After a force-push, GitHub still serves the old objects** via cached commit SHAs until its GC runs.
If this file had ever contained a real secret (it does not), the correct response would be to rotate
the secret, not to rely on the rewrite. Optionally open a GitHub support request to expire the cached
views.

### After destruction

Confirm to the user, in one line, that:
- the memories in §3 are written and indexed,
- the environment in §6 is verified green,
- the secrets in §7 are restored (or which are still missing),
- and this file is gone.

Then continue as a normal session. The brain is transferred; `CLAUDE.md` and the memory directory
carry it from here.
