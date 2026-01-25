-- Create HNSW index for vector similarity search
-- m=16, ef_construction=64 are reasonable defaults for 768d vectors
CREATE INDEX "Analysis_vectorSignature_hnsw_idx" ON "Analysis" USING hnsw ("vectorSignature" vector_cosine_ops) WITH (m = 16, ef_construction = 64);