# Security & Authentication Reference

Detailed security invariants and authentication architecture for the SRA platform.
This document is the canonical source for "why" behind security rules summarized in `CLAUDE.md`.

## Authentication architecture

### Session-backed JWTs

`authMiddleware` calls `isSessionActive(sessionId, userId)` on every JWT-authenticated request. Access tokens are signed for 7 days, so without that lookup, `POST /auth/logout` and `DELETE /auth/sessions/:id` both returned success while the token kept working — the product's only two revocation controls did nothing. Every `signToken` call site must include `sessionId`; a token without one is rejected. `rotateSession` updates the existing row rather than creating one, preserving session identity.

### Short-lived access tokens (15m)

`useAuthFetch` refreshes and replays once on a 401. The refresh is deduplicated in module scope in `auth-context.tsx` because `/auth/refresh` **rotates**: two concurrent refreshes mean the second presents a cookie the first just invalidated, signing the user out mid-session.

### Refresh token rotation — lost-response handling

`Session.prevTokenHash` + `successorConfirmed` (in `sessionService.js`). The superseded refresh token stays alive until its replacement is seen in use:

- Presenting the old token **after** the replacement has been used = replay → revoke session.
- Presenting the old token **before** = lost-response case → honoured.

**Previous bug:** Rotation retired the old token instantly on write, so a rotation response the browser never received left it holding an invalidated token.

### Failed refresh → 401

`refreshToken` in `authController.js` throws with an explicit `statusCode`. A bare `Error` defaults to 500 in `errorMiddleware`, and the client reads 5xx as "the server said nothing" (so a cold start can't end a session). The sign-out lives in `refreshAccessToken`, the one place every caller funnels through.

## Cookie-bearing auth endpoint proxy

The five cookie-bearing auth calls (`login`, `signup`, `refresh`, `logout`, `exchange`) go through the frontend's own origin via `frontend/app/api/auth/[...path]/route.ts`. URLs are built in `lib/auth-endpoints.ts`.

**Why:** Frontend and backend are separate `vercel.app` deployments. `vercel.app` is on the Public Suffix List, making them different *sites*. Backend-set cookies become third-party cookies → blocked by Safari and Chrome Incognito. The proxy makes cookies first-party. The proxy forwards the browser's `Origin` (so `requireTrustedOrigin` still works) and rewrites `SameSite=None` to `Lax`.

**Rule:** Never point those five endpoints directly at `NEXT_PUBLIC_BACKEND_URL`.

## Cookie-parser scoping

`cookie-parser` is mounted only on `authRoutes` (the only two cookie readers: OAuth state cookie, refresh token). Every other route authenticates via bearer header. `/auth/refresh` and `/auth/logout` carry `requireTrustedOrigin` from `csrfMiddleware.js`; the origin allowlist is shared with `cors()` via `config/allowedOrigins.js`.

## Tenant isolation — detailed

### User-owned row reads

Every read of a user-owned row must be filtered by the caller in the query. Analysis and project IDs appear in URLs, CLI config, and traceability records — they are not secrets. `findFirst({ where: { id, userId } })` preferred over `findUnique({ where: { id } })` + post-check. Report someone else's ID exactly as a nonexistent one. `tests/unit/ownership_boundaries.test.js` asserts against the Prisma `where` clause.

### RAG corpus scoping

`retrieveContext`, `searchGoldStandardFragments`, and `findReuseCandidate` all require `userId`. `retrieveContext` takes an **options object** (`{ userId, projectId, limit }`) specifically so a call site on the old positional signature throws instead of silently running unscoped. `aiService` skips RAG entirely when `settings.userId` is absent. `tests/unit/rag_tenant_scoping.test.js` asserts on the SQL handed to Prisma.

**Previous severity:** `retrieveContext` runs on every analysis, returns requirement text and `source_title` (the owning project's name), and feeds both into prompts — one customer's spec could be reproduced, attributed, in another's document.

## AI route settings validation

`settings` on every AI route is constrained by `clientAiSettingsSchema` in `utils/validationSchemas.js`. Must never be `.passthrough()` or `z.record(z.any())`: `settings` flows into `analyzeText`, where `systemPrompt` replaces the system prompt outright, `systemPromptExtension` is interpolated into it, and `apiKey` would let a request nominate the credential. Zod strips unknown keys by default; `validate()` writes the parsed body back.

## Prompt injection sanitization

Untrusted text reaching a system prompt is sanitized in `utils/promptSanitizer.js`, applied at one choke point — `constructMasterPrompt`. `projectName` is the critical case (extracted from raw input by regex, interpolated into instruction sentences). Add new untrusted keys to `sanitizePromptSettings`, not at call sites. Keep user prose in the user turn, never templated into a system prompt.

## Credential hygiene

- `toPublicUser` in `authService` is a **whitelist** — new User fields are withheld by default.
- Both pino instances redact credential-shaped paths; `middleware/logger.js`'s `safeUrl` masks credential-bearing query parameters (OAuth callbacks wrote live authorization codes without it).
- `dataExportService` describes stored keys/tokens by metadata, never emits values.

## Account deletion

Erasure follows the foreign keys:
- `User → Analysis` and `KnowledgeChunk → Analysis` are both `ON DELETE RESTRICT`, so `prisma.user.delete()` fails.
- `accountDeletionService.hardDeleteUser` deletes chunks → analyses → projects → user in one transaction.
- `AuditLog` is `ON DELETE SET NULL` — survives with subject detached.
- Two-phase: `DELETE /auth/me` soft-deletes + revokes sessions immediately; reconciliation sweep purges after `DELETION_GRACE_DAYS`.
- `validateSession`, `loginUser`, `verifyApiKey` all refuse a soft-deleted account.

## CSP and nonce rendering

The frontend CSP carries a per-request nonce. `middleware.ts` builds the policy; `next.config.ts` does not set `Content-Security-Policy`. `app/layout.tsx` awaits `headers()` to force dynamic rendering — with static rendering, Next stamped zero nonces onto 17 script tags while `'strict-dynamic'` was in force. Restoring static rendering requires restoring `'unsafe-inline'`.
