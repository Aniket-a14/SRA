-- AlterTable: Add missing columns to KnowledgeChunk
ALTER TABLE "KnowledgeChunk" ADD COLUMN IF NOT EXISTS "embedding" vector(768);
ALTER TABLE "KnowledgeChunk" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "KnowledgeChunk" ADD COLUMN IF NOT EXISTS "qualityScore" DOUBLE PRECISION;

-- Enforce strict version uniqueness inside each analysis lineage.
CREATE UNIQUE INDEX IF NOT EXISTS "Analysis_rootId_version_key"
ON "Analysis"("rootId", "version");

-- Restore vector ANN index for finalized analysis retrieval.
CREATE INDEX IF NOT EXISTS "Analysis_vectorSignature_hnsw_idx"
ON "Analysis" USING hnsw ("vectorSignature" vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE "vectorSignature" IS NOT NULL;

-- Add ANN index for reusable chunk retrieval.
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx"
ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64)
WHERE "embedding" IS NOT NULL;
