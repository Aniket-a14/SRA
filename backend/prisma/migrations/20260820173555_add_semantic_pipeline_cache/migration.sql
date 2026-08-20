-- CreateTable
-- vector(768) to match GEMINI_EMBEDDING_DIMENSIONS, same as KnowledgeChunk.embedding and
-- Analysis.vectorSignature — Prisma generates unconstrained `vector` for Unsupported() columns.
CREATE TABLE "SemanticPipelineCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "embedding" vector(768),
    "output" JSONB NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SemanticPipelineCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SemanticPipelineCache_userId_sectionName_idx" ON "SemanticPipelineCache"("userId", "sectionName");

-- Create HNSW index for vector similarity search, matching the m/ef_construction defaults
-- used for Analysis.vectorSignature and KnowledgeChunk.embedding.
CREATE INDEX "SemanticPipelineCache_embedding_hnsw_idx" ON "SemanticPipelineCache" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- AddForeignKey
ALTER TABLE "SemanticPipelineCache" ADD CONSTRAINT "SemanticPipelineCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
