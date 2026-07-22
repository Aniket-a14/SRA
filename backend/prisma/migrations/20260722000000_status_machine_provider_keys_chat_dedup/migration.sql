-- Phase 3: status state machine, version-race fix, chat dedup, provider keys.
--
-- NOT YET APPLIED to any database. Written by hand (not via `prisma migrate dev`)
-- to avoid touching backend/.env's live DATABASE_URL without explicit sign-off —
-- review this file, then apply with `prisma migrate deploy` (or `migrate dev` in a
-- disposable/dev database first) once you're satisfied it's safe for your data.

-- ============================================================================
-- 0. Pre-flight: deterministically renumber `version` within each rootId chain.
--    Historically, queueService.js / chatService.js / analysisController.js each
--    computed `version = max(version)+1` with a separate read-then-write (no
--    unique constraint), so a race between two concurrent writers (e.g. a chat
--    edit and a regenerate firing close together) could produce two rows with
--    the same (rootId, version). Renumbering by creation order is a no-op for
--    every rootId that was never raced, and repairs any pair that was, so the
--    unique constraint added below can't fail on existing data.
-- ============================================================================
WITH ordered AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY "rootId" ORDER BY "createdAt" ASC, id ASC) AS new_version
    FROM "Analysis"
    WHERE "rootId" IS NOT NULL
)
UPDATE "Analysis" a
SET version = ordered.new_version
FROM ordered
WHERE a.id = ordered.id
  AND a.version IS DISTINCT FROM ordered.new_version;

-- ============================================================================
-- 1. Status state machine — replace the free-text `status` column with a real
--    enum. Existing string values ('PENDING' | 'IN_PROGRESS' | 'COMPLETED' |
--    'FAILED' | 'DRAFT') map 1:1 onto the new enum, so the USING cast is exact.
-- ============================================================================
-- CreateEnum
CREATE TYPE "AnalysisLifecycleStatus" AS ENUM ('DRAFT', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalysisResultQuality" AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('GEMINI', 'OPENAI', 'CLAUDE', 'GROK');

-- AlterTable: status TEXT -> AnalysisLifecycleStatus
ALTER TABLE "Analysis"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "AnalysisLifecycleStatus" USING ("status"::"AnalysisLifecycleStatus"),
    ALTER COLUMN "status" SET DEFAULT 'COMPLETED';

-- AlterTable: resultQuality (replaces the untyped metadata.isPartial flag)
ALTER TABLE "Analysis" ADD COLUMN "resultQuality" "AnalysisResultQuality" NOT NULL DEFAULT 'FULL';

-- Backfill: rows the failsafe path (analysisService.js) marked via metadata.isPartial
-- get their PARTIAL quality reflected in the typed column too.
UPDATE "Analysis"
SET "resultQuality" = 'PARTIAL'
WHERE (metadata->>'isPartial')::boolean IS TRUE;

-- AlterTable: updatedAt (needed by Phase 5's stale-IN_PROGRESS reconciliation sweep)
ALTER TABLE "Analysis" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- 2. Version-race fix: enforce uniqueness at the DB level. Application code
--    (see backend/src/services/versioning.js) retries on the resulting P2002
--    instead of relying on the old read-max-then-write pattern.
-- ============================================================================
-- CreateIndex
CREATE UNIQUE INDEX "Analysis_rootId_version_key" ON "Analysis"("rootId", "version");

-- CreateIndex
CREATE INDEX "Analysis_status_idx" ON "Analysis"("status");

-- ============================================================================
-- 3. Chat dedup: client-generated message id, unique when present (multiple
--    NULLs are allowed by Postgres unique indexes, so pre-migration rows with
--    no clientMessageId are unaffected).
-- ============================================================================
-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "clientMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_clientMessageId_key" ON "ChatMessage"("clientMessageId");

-- ============================================================================
-- 4. Multi-provider architecture: user-supplied third-party LLM keys.
-- ============================================================================
-- CreateTable
CREATE TABLE "UserProviderKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "maskedKey" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProviderKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserProviderKey_userId_idx" ON "UserProviderKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProviderKey_userId_provider_key" ON "UserProviderKey"("userId", "provider");

-- AddForeignKey
ALTER TABLE "UserProviderKey" ADD CONSTRAINT "UserProviderKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
