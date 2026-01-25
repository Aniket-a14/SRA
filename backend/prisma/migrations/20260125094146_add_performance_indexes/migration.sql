-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'COMPLETED';

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Analysis_parentId_idx" ON "Analysis"("parentId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_sourceAnalysisId_idx" ON "KnowledgeChunk"("sourceAnalysisId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_tags_idx" ON "KnowledgeChunk" USING GIN ("tags");
