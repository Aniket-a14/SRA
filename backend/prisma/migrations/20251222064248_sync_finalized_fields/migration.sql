-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "isFinalized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "vectorSignature" JSONB;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "settings" JSONB;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "tags" TEXT[],
    "sourceAnalysisId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeChunk_type_idx" ON "KnowledgeChunk"("type");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_hash_idx" ON "KnowledgeChunk"("hash");

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_sourceAnalysisId_fkey" FOREIGN KEY ("sourceAnalysisId") REFERENCES "Analysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
