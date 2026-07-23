# SRA Technical Debt Audit — v1

**Date**: 2026-07-22 · **Auditor**: Claude Code (staff-eng audit protocol) · **Scope**: full monorepo (`backend`, `frontend`, `cli`, `model`, infra/CI)
**Method**: git churn analysis (657 commits, 6-month window) + file-size ranking + `pnpm audit` + `madge --circular` + manual code reading across 9 dimensions, parallelized by module and independently verified for the highest-severity claims.

> This is a living document. On re-run, mark resolved findings `RESOLVED`, update stale ones, tag net-new findings `NEW`.

---

## Executive Summary

Severity counts: **4 Critical · 22 High · 29 Medium · 20 Low** (75 total findings).

1. **[CRITICAL] Live secrets are committed to a *public* GitHub repo** (`terraform/tfplan`) — Gemini/OpenAI keys, a Postgres connection string, JWT/CSRF/encryption secrets, a Vercel token, and a QStash token are recoverable from git history right now. Independently verified. **Action already in progress with the maintainer — see chat.**
2. **[CRITICAL] The worker endpoint's QStash signature check is a no-op** — `verifyQStash` computes `isValid`, never checks it, and calls `next()` unconditionally. `/api/worker/process` accepts unsigned requests.
3. **[CRITICAL] OAuth login leaks live JWTs** — access + refresh tokens are appended to a redirect URL (browser history, `Referer` leakage) and then `console.log`'d in full, in every environment including production.
4. **[HIGH, but core-product-quality-affecting] A missing `await` silently corrupts RAG context** on the direct `/internal/analyze` path — `ragContextString` is a stringified Promise, not the retrieved content.
5. Documentation and reality have diverged in the frontend: **`useAuthFetch` is used in 4 files, not "all" client calls**; **error boundaries wrap one giant blob, not per-diagram**; **2 of 8 result tabs are lazy-loaded, not all 7-8** — three separate claims in ARCHITECTURE.md that don't hold up.
6. **23 high-severity CVEs** from `pnpm audit`, concentrated in two *direct* dependencies (`axios`, `next`) — and the CI step meant to catch this (`pnpm audit --audit-level=high`) is wired with `|| true`, so it can never fail a build.
7. Two dead-but-fully-implemented backend services (`securityMonitor.js` brute-force detection, `AuditService.js` compliance logging) are **not wired into any route** — the app looks like it has protections it doesn't actually have at runtime.
8. `docker-compose.yml`'s build context is broken for both `backend` and `frontend` services — `docker compose up --build`, the exact command CLAUDE.md tells a new engineer to run, fails on the first `COPY`.
9. Test coverage is thin everywhere it matters: backend has 5 test files covering none of `authController`/`sessionService`/13 of 17 `analysisController` handlers; frontend has 3 trivial Playwright smoke checks and zero coverage of chat/diagram-edit/export; `cli` and `model` both ship `"no test specified" && exit 1` as their literal test script.
10. Two god files anchor a disproportionate share of the churn: `backend/src/controllers/analysisController.js` (938 lines, 24 commits/6mo, does DB transactions inline instead of delegating to services) and `frontend/lib/export-utils.ts` (1642 lines, 5 unrelated responsibilities crammed into one file).

---

## Architectural Mental Model

SRA is a pnpm monorepo running a 5-agent LLM pipeline (Product Owner → Architect → Developer → Reviewer/Critic reflection loop) behind a QStash-queued async worker, writing IEEE-830 SRS documents into Postgres/pgvector via Prisma, with a Next.js 16 frontend and a companion CLI for spec-to-code traceability. This matches CLAUDE.md and ARCHITECTURE.md at the orchestration level — the pipeline logic in `analysisService.js` is real and does what the docs claim.

Where the mental model breaks from the docs: the **edges of the system are less hardened than the core**. The AI orchestration (retry/backoff/JSON-repair in `BaseAgent`, surgical refinement, diagram self-repair) is carefully built and matches its documentation almost exactly. But auth (OAuth token handling, QStash signature verification), the controller layer (raw `req.body` handling with inconsistent validation), and several frontend claims about consolidation (`useAuthFetch`, error boundaries, dynamic imports) show the gap between "designed" and "actually wired everywhere" that's typical of a fast-moving solo/small-team project — features get built once, correctly, in the place the author was focused on that week, and don't get retrofitted everywhere the docs later claim they apply.

---

## Findings Table

Legend: **Sev** = Critical/High/Medium/Low · **Eff** = S/M/L

### Critical

| ID | Category | File:Line | Sev | Eff | Description | Recommendation |
|---|---|---|---|---|---|---|
| INFRA-01 | Security | `terraform/tfplan` (tracked) | Critical | S/L | Committed to a **public** repo; `.gitignore`'s `*.tfplan` doesn't match a file literally named `tfplan`. Contains Gemini/OpenAI keys, a Postgres URL, JWT/CSRF/encryption secrets, Vercel token, QStash token (independently confirmed by extracting and pattern-matching, not just subagent claim). | Rotate every credential now. Purge from git history (BFG/`git filter-repo`), not just delete. Fix gitignore to `tfplan`/`**/tfplan*`. |
| BE-01 | Security | `backend/src/routes/workerRoutes.js:39-44` | Critical | S | `if (!isValid) { /* throw commented out */ }` then `next()` runs unconditionally — QStash signature verification is fully bypassed; any unsigned request reaches `processJob`. | `if (!isValid) return res.status(401).send("Invalid Signature");` |
| BE-02 | Security | `backend/src/controllers/authController.js:65,92` | Critical | M | OAuth callbacks put live access + refresh JWTs in the redirect URL query string — leaks via browser history and `Referer` headers. | Exchange a short-lived one-time code via redirect; frontend POSTs it to trade for tokens, or set `httpOnly` cookies directly. |
| BE-03 | Security/Observability | `backend/src/controllers/authController.js:66` | Critical | S | `console.log('🚀 REDIRECTING TO:', redirectUrl)` prints the full token-bearing URL to stdout on every login, all environments. | Delete the line, or log only `result.user.id`. |

### High

| ID | Category | File:Line | Sev | Eff | Description | Recommendation |
|---|---|---|---|---|---|---|
| BE-08 | Correctness bug | `backend/src/services/aiService.js:71` | High | S | `ragContextString = formatRagContext(ragResults);` — missing `await` on an `async` function (`ragService.js:96`); silently injects `[object Promise]` into the prompt on the `/internal/analyze` path. | Add `await`. Add a regression test asserting real content lands in `finalPrompt`. |
| BE-04 | Security/Observability | `backend/src/app.js:44-51` | High | S | Unconditional debug middleware logs full URL + query string for any path containing `"callback"` — captures OAuth `code`/`state` to stdout in production. | Remove or gate behind `NODE_ENV==='development'`. |
| BE-05 | Security | `backend/src/config/{google,github}OAuth.js`, `authController.js:45-96` | High | M | No CSRF `state` param generated/validated on OAuth start/callback — classic login-CSRF exposure. | Generate + store + verify a random `state`. |
| BE-06 | Contract/Type debt | `backend/src/routes/analysisRoutes.js:14-29` | High | M | Only `POST /` validates with Zod (`analyzeSchema`); 13 other handlers take raw `req.body`. `updateAnalysis` spreads `...resultUpdates` into `resultJson` with zero shape validation. | Add Zod schemas per route; whitelist which `resultJson` keys `updateAnalysis` may touch. |
| BE-07 | Architectural decay | `backend/src/controllers/analysisController.js` (938 lines, 24 churns/6mo) | High | L | God controller: DB transactions/embedding orchestration inline instead of delegated to services; "get next version" logic duplicated 3x (`:383-390`, `:534-539`, `queueService.js:50-55`). | Extract `getNextVersion(tx, rootId)` helper; move DB writes for `updateAnalysis`/`finalizeAnalysis`/`regenerate` into services. |
| BE-09 | Performance | `backend/src/services/graphService.js:80-102,105-129` | High | M | Sequential per-item `findUnique`/`create` inside a single `$transaction` for every node/edge — risks timeout/lock contention on larger graphs. | Batch: `findMany` once, diff in memory, `createMany`. |
| BE-10 | Dead code / false security | `backend/src/services/securityMonitor.js` (232 lines) | High | M | Fully implemented brute-force/exfiltration detector — zero importers anywhere. In-process `Map` wouldn't even work correctly across the documented 2-replica deployment. | Wire into `authController.login`, move state to Redis, or delete — currently implies protection that doesn't exist. |
| INFRA-02 | Security | `.gitignore:70`; git history | High | S | `terraform.tfstate.*.backup` was committed, then reactively gitignored by exact filename, then deleted — still recoverable from history; evidence gitignore rules were added *after* a leak, not before. | Purge from history regardless of INFRA-01 outcome; verify its contents too. |
| INFRA-03 | Performance/DX | `docker-compose.yml:14-16,43-44` vs `backend/Dockerfile:13`, `frontend/Dockerfile:12` | High | S | Compose sets `context: ./backend`/`./frontend`, but both Dockerfiles' first `COPY` expects the **monorepo root** (`pnpm-workspace.yaml` etc.) as context. `docker compose up --build`, as instructed in CLAUDE.md, fails on the first `COPY` for both services. | `context: .` + `dockerfile: backend/Dockerfile` (matches what `docker-publish.yml` already does correctly). |
| INFRA-04 | Observability | `.github/workflows/backend.yml:52-54`, `frontend.yml:56-58` | High | S | `pnpm audit --audit-level=high \|\| true` — always succeeds. The 23 known high CVEs give no CI signal at all. | Remove `\|\| true`, or gate behind a documented allowlist. |
| INFRA-05 | Architectural decay | `.github/workflows/auto-tag.yml:29-57` vs `release.yml:3-26` | High | S | Both create a GitHub Release for the same tag independently (`auto-tag.yml` pushes the tag that triggers `release.yml`) — race/duplicate release risk. | Pick one owner; drop the release step from the other. |
| INFRA-07 | Security/config debt | `terraform/variables.tf:32-93`, `vercel.tf:16-17,33-34` | High | M | 8 of 9 `sensitive = true` vars are declared "to avoid storing secrets in state" but never referenced by any resource — and INFRA-01 proves they got populated with real values at apply-time anyway. | Wire into real resources or delete the declarations — don't leave sensitive placeholders inviting real values. |
| CLI-01 | Security | `cli/src/config/config-manager.js:7,30-33`; `init.js:74-75` | High | S | CLI bearer token persisted **plaintext** to `sra.config.json` in the project dir; nothing in root `.gitignore` covers it; the only warning is a suppressed `logger.debug`. | Auto-append to `.gitignore` on `init`; upgrade the tip to `logger.warn`; consider OS keychain storage. |
| CLI-02 | Security | `cli/src/api/api-client.js:24-32` | High | S | Bearer token is sent to whatever `backendUrl` sits in the local config file, with zero host allowlisting — combined with CLI-01, a tampered committed config would exfiltrate a teammate's live token. | Validate `backendUrl` against an allowlist before attaching the Authorization header. |
| FE-01 | Consistency rot / doc drift | 9+ components (see full subagent detail) vs `lib/hooks.ts` | High | M | ARCHITECTURE.md claims all client API calls go through `useAuthFetch` — it's used in 4 files; 9+ others hand-roll `fetch()` + manually duplicated bearer header. | Migrate remaining call sites onto the hook, or document the real pattern. |
| FE-02 | Error handling / doc drift | `app/analysis/[id]/page.tsx:756-762`; `components/error-boundary.tsx` | High | M | ARCHITECTURE.md claims granular boundaries "isolate Mermaid/Flowchart failures" — in reality one `<ErrorBoundary>` wraps all 8 result tabs; a bad DFD payload blanks everything, not just the diagram. | Wrap `MermaidRenderer`/`DFDViewer` individually. |
| FE-03 | Type/contract debt | `types/analysis.ts:91` vs `DFDViewer.tsx:144-145`, `export-utils.ts:315,323,332`, `dfd-diagram-section.tsx:22,44` | High | S | Declared type (`level0`/`level1`/`caption`) doesn't match what every real consumer reads (`dfd_level_0`/`dfd_level_1`) — bridged with 3 separate `as any` casts instead of a type fix. | Fix `AnalysisModels.dataFlowDiagram`; remove the casts. |
| FE-04 | Shipped stub | `lib/export-utils.ts:1519-1522`; `page.tsx:717-731` | High | S/M | `generateAPI()` returns a placeholder string, wired to a real "Export API Blueprint (MD)" menu item that shows a success toast and downloads it as if real. | Implement it or remove/hide the menu item. |
| FE-05 | Test debt | `tests/e2e/basic_flow.spec.ts` | High | L | Only e2e spec; 3 trivial smoke checks. Zero coverage of intake→analysis→results, chat refinement, diagram edit/repair, version compare, or export — exactly the highest-churn files. | Add e2e coverage for the golden path + chat-driven refinement. |
| FE-06 | Security | `mermaid-renderer.tsx:43,67,88`; `next.config.ts:13` | High | M | Verified: `securityLevel: 'loose'` + `ref.current.innerHTML = svg` on LLM-originated, user-editable diagram content, with production CSP verified to include `script-src 'unsafe-inline' 'unsafe-eval'`. Plausible chained XSS via prompt-injected or hand-crafted diagram labels. | `securityLevel: 'strict'` or sanitize before `innerHTML`; tighten CSP where Next.js allows it. |
| FE-07 | Architectural decay | `lib/export-utils.ts` (1642 lines) | High | L | Single file: SVG→PNG conversion, off-screen diagram capture (~250 lines), hand-rolled IEEE-830 PDF layout engine (~1100 lines of jsPDF cursor math), zip bundling, codebase export — 5 unrelated responsibilities. | Split into `pdf/`, `diagram-capture/`, `bundle-export/` modules. |
| FE-08 | Doc drift / performance | `results-tabs.tsx:16-24` | High | M | ARCHITECTURE.md claims all 7-8 tabs are `next/dynamic`-loaded — only 2 of 8 actually are; the other 6 (including ones nesting `DiagramEditor`) are static imports in the initial chunk. | Convert remaining tabs to `next/dynamic`, or correct the doc. |

### Medium (29 total — representative selection; full list in appendix tables below)

| ID | Category | File:Line | Sev | Eff | Description | Recommendation |
|---|---|---|---|---|---|---|
| BE-11 | Dead code | `backend/src/services/AuditService.js` | Medium | M | `getPendingReviews`/`verifyRequirement` unwired to any route; own N+1 loop at `:21-25`. | Wire up or delete; fix N+1 if kept. |
| BE-12 | Correctness bug | `backend/src/middleware/auditLogger.js:128-130` | Medium | S | `req.statusCode` (always `undefined`) instead of `res.statusCode` — every login logs as `LOGIN_FAILURE` regardless of outcome. No `AuditLog` table exists; it's `console.log` only. | Fix to `res.statusCode`; add a real `AuditLog` model if compliance logging matters. |
| BE-13 | Test debt | `backend/tests/` | Medium | L | 13/17 `analysisController` handlers, all of auth/session/apiKey services, all 5 agents, the broken `verifyQStash` path, `graphService`, `dataEncryption` — zero coverage. `json_repair.test.js` tests a standalone reimplementation, not the real `BaseAgent.parseJSON`. | Prioritize a signature-bypass regression test, an auth/session test, and pointing the JSON-repair test at the real export. |
| BE-14 | Dead code | `backend/src/index.js` | Medium | S | Orphaned alternate entrypoint importing a nonexistent `routes/analyze.js`; wide-open `cors()`; not referenced anywhere. | Delete. |
| BE-15 | Dead/broken code | `backend/src/utils/dataEncryption.js:211-222` | Medium | S | `encryptUserPII` references `phone`/`address` fields that don't exist on `User`; encrypting `email` would break the `@unique` lookup used everywhere. Unused elsewhere. | Delete these exports, or fix to target real fields. |
| BE-16 | Consistency rot | `aiService.js:90-190` vs `agents/BaseAgent.js:58-121` | Medium | M | Two independent Gemini retry/JSON-repair stacks for the same underlying API, with divergent robustness. | Have `aiService.js` delegate to `BaseAgent` or a shared client module. |
| BE-17 | Consistency rot | `analysisController.js:909,934,868-873` | Medium | S | `generateDFD`/`autoFixValidationIssue`/`repairDiagram`'s 429 branch bypass the standard `{success,message,data}` response shape. | Route through `successResponse`/`errorResponse`. |
| BE-18 | Config debt | `app.js:57,72-75` vs `.env.example:18` vs `config/security.js:7-9` | Medium | S | `ALLOWED_ORIGINS` is documented for CORS but only wired into CSP; multi-origin deployments relying on it for CORS will be silently rejected. | Parse into the `cors()` `origin` option too. |
| BE-19 | Dead code | `analysisService.js:507-509` | Medium | S | Confirmed-unreachable "LEGACY / DIRECT SYNC FLOW" branch — every call site always passes `analysisId`. | Delete; simplify surrounding logic. |
| INFRA-06 | Config debt | `.github/workflows/backend.yml:63` | Medium | S | Pins `actions/upload-artifact@v7` while every other workflow uses `@v4` — anomalous, risks resolution failure. | Align to `@v4`. |
| INFRA-08 | Performance | `nginx/nginx.conf:1-25` | Medium | S | No `proxy_read_timeout` set — nginx's 60s default can 504 a request before `BaseAgent`'s documented 6-minute Gemini timeout fires. | Add `proxy_read_timeout 360s;`. |
| INFRA-09 | Config debt | `renovate.json:3-12` | Medium | S | Deprecated `config:base` preset; `automerge: true` monorepo-wide including `cli` (zero real tests). | Switch to `config:recommended`; exclude `cli`/`model` from automerge until CLI-03 is fixed. |
| CLI-03 | Test debt | `cli/package.json:12`; `.github/workflows/cli.yml:58-59` | Medium | M | Literal `"no test specified" && exit 1`; CI test step is commented out — zero test coverage for any of the 7 CLI commands. | Add a minimal suite for `check.js`/`config-manager.js`; re-enable the CI step. |
| CLI-04 | Doc drift | `cli/src/commands/reverse.js:1-7` | Medium | S | Complete no-op stub registered as a real "(Beta)" command with no indication nothing happened. | Exit with a clear "not implemented" status, or hide from `--help` until real. |
| CLI-05 | Contract debt | `cli/src/commands/check.js:17-42` | Medium | M | Only checks file *existence*, not implementation — a stub file at the right path "verifies" a requirement, contradicting the documented behavior. | Rename to reflect reality, or add a real content heuristic. |
| MODEL-01 | Architectural decay | `model/scripts/split_dataset.py` vs `.py`/`.js` variant | Medium | M | JS variant (which feeds the real trainer) does no shuffling — hardcoded `slice(0,69)`/`slice(69)` — risking a biased, file-order-dependent eval split vs. the Python version's seeded shuffle. | Consolidate onto one script, or rename to make the pipeline-stage difference explicit and add shuffling to the JS path. |
| MODEL-02 | Contract debt | `model/scripts/train_sra.py:22`; `fast_verify.py` | Medium | S | A dataset validator exists but is never called before `load_dataset` — malformed rows fail deep inside HF `datasets.map` with an opaque trace. | Call `fast_verify.verify_dataset()` as a pre-flight step. |
| FE-09 | Dead code | `lib/intake-context.tsx` (176 lines) | Medium | S | Unmounted provider; uses `alert()` instead of `sonner`; no auth header; points at an undocumented, different env var than the rest of the app. | Delete, or fix all four inconsistencies before wiring it up. |
| FE-10 | Duplication | `lib/analysis-api.ts:6-19`, `lib/projects-api.ts:5-17` | Medium | S | Byte-for-byte duplicated `handleResponse()` helper. | Extract to `lib/fetch-utils.ts`. |
| FE-11 | Consistency rot | `analysis-api.ts`, `projects-api.ts`, `actions/analysis.ts`, `hooks.ts`, `swr-utils.ts` | Medium | M | 3 parallel idioms for the same job (plain functions, server action, hook), each with its own error shape. | Consolidate onto one client-side and one server-side pattern. |
| FE-12 | Dependency debt | `package.json` (18+ entries) | Medium | S | `recharts`, `embla-carousel-react`, `cmdk`, `vaul`, `react-day-picker`, `input-otp`, `next-themes`, `core-js`, `react-hook-form`, `@hookform/resolvers`, `react-resizable-panels`, 10 unused `@radix-ui/*` — zero imports found. Shadcn scaffold leftovers. | Prune; confirm bundle-size improvement. |
| FE-13 | Bug | `components/editable-section.tsx:18` | Medium | S | `useState(items)` never resyncs on prop change; no remount key at any of 3 call sites — "Cancel" doesn't actually revert visible edits. | `useEffect(() => setLocalItems(items), [items])`, or key by edit session. |
| FE-14 | Security | `lib/auth-context.tsx:32,45-47,77-78,132-134,144-147` | Medium | L | Both access **and refresh** tokens in `localStorage` — an XSS anywhere (see FE-06) can mint sessions indefinitely, not just replay a short-lived token. | Move refresh token to an httpOnly cookie. |
| FE-15 | Observability | `project-chat-panel.tsx:48-50`; `page.tsx:360-362` | Medium | S | `catch(e){console.error}` with no UI feedback — chat history/draft-reset failures are silent to the user. | Surface via the existing `sonner` convention. |
| FE-16 | Performance | `export-utils.ts:103-357`, `:416-1516` | Medium | M | Sequential fixed `setTimeout(2500ms)` per diagram (10-15s+ for 4-6 diagrams) plus a fully synchronous ~1100-line jsPDF pass — blocks the main thread during PDF export. | Yield between captures; consider a Web Worker for the jsPDF pass. |
| FE-18 | Architectural decay | `app/analysis/[id]/page.tsx` (802 lines, 30 churns/6mo) | Medium | L | One component owns routing, SWR polling, 6 view states, all export handlers, finalize/validate/autofix mutations. | Extract view-state branches and export menu into separate components/hooks. |

### Low (20 total — see appendix)

Full list: BE-20, BE-21, BE-22 (magic-number cooldowns, thin rate-limit coverage on worker routes, unbounded IP-geolocation call in `sessionService.js`); FE-17, FE-19, FE-20, FE-21, FE-22 (`Record<string, any>` in `kv-display.tsx`, undocumented/unused env vars, dev CSP allowance shipped to prod, process-wide TLS bypass in Playwright config, repeated magic numbers); INFRA-10, INFRA-11, INFRA-12 (stale `.coderabbit.yaml` module description, CodeQL matrix missing Python, checkout-action version drift); CLI-06 through CLI-10 (swallowed error messages in `sync.js`/`push.js`, version-string mismatch, dead `.srarating` global-config field, compose/Dockerfile working-dir mismatch, unused `update-notifier`/`open` deps); MODEL-03 through MODEL-09 (bare `except:` in training script, silent skip in `repair_dataset.js`, no `requirements.txt`, stale roadmap doc references a script that doesn't exist in this checkout, stale `package.json` `main` field, assertion-free "test", Python/JS pipeline-stage drift).

---

## Top 5 — If You Fix Nothing Else, Fix These

### 1. INFRA-01 — Secrets in a public repo
Already being handled in this conversation. Sequence: rotate all 8+ credentials → purge `terraform/tfplan` and `terraform.tfstate.*.backup` from git history → fix `.gitignore`.

### 2. BE-01 — QStash signature check is a no-op
```diff
  const isValid = await receiver.verify({ signature, body, url });

- if (!isValid) {
-     // throw new Error("Invalid QStash Signature");
-     // Note: Receiver.verify throws if invalid usually, but returns boolean in some versions.
-     // Let's assume strict verification.
- }
+ if (!isValid) {
+     log.error("QStash signature verification failed");
+     return res.status(401).send("Invalid Signature");
+ }
  next();
```
Add a test: POST to `/api/worker/process` with a garbage/missing `upstash-signature` header, assert `401`.

### 3. BE-02 + BE-03 — JWT leakage through OAuth redirect + logging
```diff
- const redirectUrl = `${frontendUrl}/?token=${result.token}&refreshToken=${result.refreshToken}`;
- console.log('🚀 REDIRECTING TO:', redirectUrl);
- res.redirect(redirectUrl);
+ const oneTimeCode = await issueOneTimeExchangeCode(result); // short-lived, single-use, stored server-side
+ res.redirect(`${frontendUrl}/auth/complete?code=${oneTimeCode}`);
```
Frontend then POSTs `code` to a new `/auth/exchange` endpoint that trades it for the real tokens (set as `httpOnly` cookies, or returned once in a response body — never in a URL). Apply the same fix to `githubCallback` (`authController.js:92`).

### 4. BE-08 — Missing `await` silently corrupts RAG context
```diff
- ragContextString = formatRagContext(ragResults);
+ ragContextString = await formatRagContext(ragResults);
```
One-line fix; add a regression test asserting `finalPrompt` contains retrieved chunk text, not `[object Promise]`.

### 5. FE-06 — Mermaid XSS chain
```diff
  m.default.initialize({
      ...
-     securityLevel: 'loose',
+     securityLevel: 'strict',
      ...
  })
```
And in `next.config.ts`, narrow `script-src` away from `'unsafe-inline' 'unsafe-eval'` wherever Next.js's own inline-script needs allow it (nonce-based CSP if full removal isn't feasible). Diagram content originates from LLM output and is user-editable — this is the one path where "loose" + broad CSP + `innerHTML` chain into a real XSS primitive.

---

## Quick Wins (Low Effort × Medium+ Severity)

- [ ] BE-03 — delete the `console.log` of the token-bearing redirect URL
- [ ] BE-04 — remove/gate the unconditional `"callback"` debug-logging middleware in `app.js`
- [ ] BE-08 — add the missing `await` on `formatRagContext`
- [ ] BE-12 — fix `req.statusCode` → `res.statusCode` in `auditLogger.js`
- [ ] BE-14 — delete orphaned `backend/src/index.js`
- [ ] BE-15 — delete `dataEncryption.js`'s dead PII exports referencing nonexistent User fields
- [ ] BE-18 — wire `ALLOWED_ORIGINS` into the actual `cors()` config, not just CSP
- [ ] BE-19 — delete the confirmed-dead legacy branch in `analysisService.js:507-509`
- [ ] FE-03 — fix the `dataFlowDiagram` type to match reality; drop the 3 `as any` casts
- [ ] FE-04 — implement or hide the fake "Export API Blueprint" menu item
- [ ] FE-09 — delete unused `lib/intake-context.tsx`
- [ ] FE-10 — dedupe `handleResponse()` between `analysis-api.ts`/`projects-api.ts`
- [ ] FE-13 — fix `editable-section.tsx`'s stale-state-on-cancel bug
- [ ] INFRA-03 — fix `docker-compose.yml`'s build context (one-line change per service)
- [ ] INFRA-04 — remove `|| true` from the CI dependency-audit step
- [ ] INFRA-06 — align `upload-artifact` version across workflows
- [ ] CLI-01 — auto-append `sra.config.json` to `.gitignore` on `init`; upgrade the warning to visible
- [ ] CLI-02 — allowlist `backendUrl` before attaching the bearer token
- [ ] MODEL-02 — call the existing `fast_verify.py` validator before `train_sra.py`'s `load_dataset`

---

## Things That Look Bad But Are Actually Fine

- **`analysisController.js`'s `tx.$executeRaw` with interpolated values** — Prisma tagged-template literals auto-parameterize; not SQL injection.
- **`backupService.js`'s `pg_dump`/`pg_restore` invocation** — uses `execFile` with an argument array (not shell-concatenated), careful `pgpass`/env handling. Genuinely solid.
- **`dataEncryption.js`'s AES-256-GCM primitive usage** — random IV, GCM mode, `scryptSync`, auth-tag checked on decrypt. The crypto is correct; only the *fields it targets* are dead (BE-15).
- **`queueService.js`'s MD5 idempotency hash** — confirmed non-cryptographic dedup use only, never auth/integrity. Fine.
- **axios as a direct high-CVE dependency** — all first-party call sites use fixed hardcoded hostnames, no user-controlled proxy/redirect targets. Version bump still warranted, but low practical exploitability as used here.
- **`madge`-confirmed zero circular deps** in `backend/src` (101 files scanned).
- **`@mantine/*` packages with no direct imports** — required peer dependencies of `@blocknote/mantine`, not dead weight.
- **`components/editor.tsx` (`@blocknote/*`)** — dynamically imported from `feature-display.tsx`, genuinely in use despite not showing up in a shallow grep.
- **`securityLevel: 'loose'` in isolation** — Mermaid's `'strict'` mode strips styling/click attributes the app's theming needs; only a real problem combined with `innerHTML` + permissive CSP (that combination is FE-06, correctly flagged).
- **`catch { toast.error(...) }` in `diagram-editor.tsx`** — looks like a swallowed error at a glance, but does surface user feedback.
- **Client-side auth/theme state deferred to `useEffect`** — this is CLAUDE.md's documented intentional hydration-safety pattern, checked line-by-line, no bugs found in the implementation itself.
- **`pr-labeler.yml`'s `pull_request_target` trigger** — normally a red flag, but it only invokes `actions/labeler@v5` against PR metadata, never checks out or executes PR-controlled code. Safe as used.
- **`pr-agent.yml` reading secrets on a `pull_request` trigger** — GitHub doesn't forward repo secrets (other than a read-only `GITHUB_TOKEN`) to fork-originated `pull_request` workflows. Not exploitable as written.
- **`check.js`/`reverse.js`** — brief asked to look for unbounded synchronous repo scans; neither does one (`check.js` only touches paths already listed in the spec; `reverse.js` is a no-op stub).
- **Backend/frontend Dockerfiles** — both correctly switch to a non-root user.
- **`docker-publish.yml`'s build context** — correctly uses `context: .`; only the *compose* file (INFRA-03) is broken, published images build fine.
- **`sleep()` calls and `MOCK_AI`/`MOCK_QSTASH` branches throughout `analysisService.js`** — confirmed intentional Gemini free-tier rate-limit accommodations and local-dev escape hatches, not dead code or bugs.

---

## Open Questions for the Maintainer

**Backend / Auth:**
1. Is the `verifyQStash` bypass (BE-01) a known interim state, or a straight regression? The ownership check in `workerController.js` (userId+analysisId+status match) provides a secondary guard — how much defense-in-depth was intended here?
2. Were `securityMonitor.js` and `AuditService.js` built ahead of their call sites (planned-but-unshipped), or are they leftovers from a refactor where the call sites were removed?
3. Is field-level PII encryption still planned for `User.email`/future `phone`/`address` fields, or should those `dataEncryption.js` exports just be removed?
4. Token-in-URL-redirect + no CSRF `state` on OAuth (BE-02/BE-05) — time pressure, or a deliberate trade-off for a specific frontend integration constraint?
5. Is `ALLOWED_ORIGINS` (BE-18) only wired into CSP by design (single known production frontend), or was multi-origin CORS support intended and just not finished?

**Frontend:**
6. Is `lib/intake-context.tsx` (FE-09) a dead first draft, or a parallel flow meant to be wired in later?
7. Is "Export API Blueprint (MD)" (FE-04) a known placeholder, or should it come out of the UI now?
8. Was the drift from "all calls via `useAuthFetch`" to 9+ hand-rolled `fetch()` sites (FE-01) an intentional per-endpoint choice, or accumulated inconsistency?
9. Storing both access and refresh tokens in `localStorage` (FE-14) — deliberate (e.g., CLI token reuse), or is a cookie-based migration already planned?
10. Are `recharts`/`embla-carousel-react`/`cmdk`/`vaul`/etc. (FE-12) scaffold leftovers slated for trimming, or wired up in an unmerged branch?

**Infra / CLI / Model:**
11. Have the credentials in `terraform/tfplan` already been rotated as of this audit, or is that still outstanding?
12. Has `docker compose up --build` been run recently? The build-context break (INFRA-03) suggests either it's untested since the last Dockerfile restructure, or there's an uncommitted local override.
13. Is `split_dataset.py` or `split_dataset.js` (MODEL-01) the canonical script for the live data pipeline, or genuinely different pipeline stages that happen to share a name?
14. Are `auto-tag.yml` and `release.yml` both meant to be live simultaneously, or did one supersede the other without removal?
15. Was pinning `actions/upload-artifact@v7` in `backend.yml` deliberate, or has that step never actually been exercised/noticed failing?

---

*Full per-module finding sets (with additional Low-severity rows not reproduced in the summary tables above) are preserved in this audit run's source material and can be expanded back into this document on request.*
