-- Security hardening: hashed session tokens, queryable audit trail, account erasure,
-- per-account lockout counters, and scoped API keys.
--
-- Written by hand rather than taken from `migrate diff`, because the generated form was
--     ALTER TABLE "Session" DROP COLUMN "token", ADD COLUMN "tokenHash" TEXT NOT NULL;
-- which fails outright against a table that has rows. The question that forces is what to
-- do with the sessions already in there, and the answer is to end them: their `token`
-- column holds the live refresh credential in clear text, which is the whole reason for
-- this change. Hashing them in place would keep every existing plaintext token valid and
-- merely stop writing new ones, leaving the exposure that motivated the migration intact.
--
-- CONSEQUENCE ON DEPLOY: every signed-in user is signed out once and must log in again.
-- Access tokens outlive this by up to their TTL, but authMiddleware validates the session
-- behind each one, so they stop working immediately too. This is intended.

-- 1. End every existing session and destroy the stored plaintext tokens.
DELETE FROM "Session";

-- 2. Sessions are now identified by a SHA-256 digest of the refresh token.
ALTER TABLE "Session" DROP COLUMN "token";
ALTER TABLE "Session" ADD COLUMN "tokenHash" TEXT NOT NULL;
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- 3. Account erasure (soft-delete + grace window) and per-account lockout state.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- 4. Scoped API keys. Existing keys are backfilled to read+write by the column default:
-- that is the authority they already exercised, minus the destructive operations nobody
-- ever deliberately granted them.
ALTER TABLE "ApiKey" ADD COLUMN "scopes" TEXT[] DEFAULT ARRAY['read', 'write']::TEXT[];

-- 5. Persistent audit trail. userId is nullable with ON DELETE SET NULL so erasing an
-- account detaches its audit rows rather than deleting them — the record that an action
-- occurred survives, the link to the person does not.
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
