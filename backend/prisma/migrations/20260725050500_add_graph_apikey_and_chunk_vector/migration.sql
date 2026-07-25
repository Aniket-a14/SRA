-- Closes schema drift that `prisma migrate status` could not see: it compares applied
-- migration NAMES, not actual database shape, so it reported "up to date" while three
-- features were silently broken against the live database.
--
-- Observed in a production-mode run on 2026-07-25:
--   * RAG retrieval failed on every query  -> `column kc.qualityScore does not exist`
--     (KnowledgeChunk was also missing `embedding` and `metadata` entirely, so vector
--      recycling could never have worked)
--   * Knowledge-graph storage failed       -> `table public.GraphNode does not exist`
--   * CLI `sra_live_` API-key auth had no  -> `ApiKey` table at all
-- All three fail non-fatally, which is why an analysis still completed and scored well.

-- AlterTable
-- Schema declares `updatedAt DateTime @updatedAt`, so Prisma always supplies the value on
-- insert and update. Safe to drop the redundant database default: no raw SQL inserts into
-- Analysis exist (verified), so nothing relies on it.
ALTER TABLE "Analysis" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
-- `vector(768)` rather than the unconstrained `vector` Prisma generates for
-- Unsupported("vector"): it matches Analysis.vectorSignature and GEMINI_EMBEDDING_DIMENSIONS,
-- makes a dimension mismatch a database error instead of silently meaningless cosine
-- distances, and is a precondition for ever adding an ivfflat/hnsw index.
ALTER TABLE "KnowledgeChunk" ADD COLUMN     "embedding" vector(768),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "qualityScore" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "GraphNode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphEdge" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GraphNode_projectId_idx" ON "GraphNode"("projectId");

-- CreateIndex
CREATE INDEX "GraphNode_type_idx" ON "GraphNode"("type");

-- CreateIndex
CREATE UNIQUE INDEX "GraphNode_projectId_name_type_key" ON "GraphNode"("projectId", "name", "type");

-- CreateIndex
CREATE INDEX "GraphEdge_sourceId_idx" ON "GraphEdge"("sourceId");

-- CreateIndex
CREATE INDEX "GraphEdge_targetId_idx" ON "GraphEdge"("targetId");

-- CreateIndex
CREATE INDEX "GraphEdge_relation_idx" ON "GraphEdge"("relation");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- AddForeignKey
ALTER TABLE "GraphNode" ADD CONSTRAINT "GraphNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "GraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
