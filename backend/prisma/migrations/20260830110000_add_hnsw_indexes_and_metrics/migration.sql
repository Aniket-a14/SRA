-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- AlterTable
ALTER TABLE "KnowledgeChunk" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "QualityMetricRecord" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "clarity" DOUBLE PRECISION NOT NULL,
    "completeness" DOUBLE PRECISION NOT NULL,
    "conciseness" DOUBLE PRECISION NOT NULL,
    "consistency" DOUBLE PRECISION NOT NULL,
    "correctness" DOUBLE PRECISION NOT NULL,
    "context" DOUBLE PRECISION NOT NULL,
    "ragFaithfulness" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityMetricRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatMessage_userId_idx" ON "ChatMessage"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_userId_idx" ON "KnowledgeChunk"("userId");

-- CreateIndex: HNSW Vector Index on KnowledgeChunk embedding
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx" ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- CreateIndex: Functional expression index for Analysis idempotency check
CREATE INDEX IF NOT EXISTS "Analysis_metadata_inputHash_idx" ON "Analysis" (((metadata->>'inputHash'))) WHERE status = 'PENDING';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QualityMetricRecord_analysisId_version_idx" ON "QualityMetricRecord"("analysisId", "version");
CREATE INDEX IF NOT EXISTS "QualityMetricRecord_userId_idx" ON "QualityMetricRecord"("userId");
CREATE INDEX IF NOT EXISTS "QualityMetricRecord_promptVersion_idx" ON "QualityMetricRecord"("promptVersion");
CREATE INDEX IF NOT EXISTS "QualityMetricRecord_createdAt_idx" ON "QualityMetricRecord"("createdAt");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_userId_fkey') THEN
        ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'KnowledgeChunk_userId_fkey') THEN
        ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QualityMetricRecord_analysisId_fkey') THEN
        ALTER TABLE "QualityMetricRecord" ADD CONSTRAINT "QualityMetricRecord_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QualityMetricRecord_userId_fkey') THEN
        ALTER TABLE "QualityMetricRecord" ADD CONSTRAINT "QualityMetricRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
