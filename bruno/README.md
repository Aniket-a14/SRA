# SRA API collection (Bruno)

Covers the auth session lifecycle, project CRUD, the analysis enqueue/status/history
contract, and provider-key listing — end to end, against a real running backend and
database (no network mocking; this is not a substitute for the Jest suite, which covers
business logic in isolation).

## Running locally

1. Start the backend with `MOCK_AI=true` and `MOCK_QSTASH=true` so the run needs no real
   Gemini key or Upstash queue:

   ```bash
   cd backend
   MOCK_AI=true MOCK_QSTASH=true pnpm dev
   ```

2. From the repo root:

   ```bash
   npx @usebruno/cli run bruno -r --env local
   ```

## Folder order

Numbered so a full `-r` run works end to end: `00-health` needs no auth; `01-auth` creates
a fresh account (a new email per run, so re-running never collides) and leaves an access
token and refresh cookie behind for every folder after it; `02-projects` and `03-analysis`
depend on that token; `05-cleanup` deletes the project the run created and logs out last —
logging out revokes the session, so nothing after it in the run can use the token again.

`/auth/refresh` and `/auth/logout` are CSRF-guarded (`requireTrustedOrigin`): they
authenticate with the ambient refresh cookie, so both requests send an `Origin` header
matching `frontendOrigin`, the same way a real browser would.

## Environments

- `local` — a developer's own `pnpm dev` instance on port 3000.
- `dev` — used by CI (`bru run bruno -r --env dev`), same port, ephemeral database.
