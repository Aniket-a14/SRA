-- CreateEnum
CREATE TYPE "QuotaSource" AS ENUM ('PROVIDER', 'COUNTED');

-- CreateTable
CREATE TABLE "ModelQuotaState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "source" "QuotaSource" NOT NULL,
    "requestLimit" INTEGER,
    "requestsRemaining" INTEGER,
    "tokensRemaining" INTEGER,
    "requestsUsed" INTEGER NOT NULL DEFAULT 0,
    "usageDate" TEXT NOT NULL,
    "exhaustedAt" TIMESTAMP(3),
    "resetsAt" TIMESTAMP(3),
    "lastErrorText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelQuotaState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelQuotaState_userId_idx" ON "ModelQuotaState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelQuotaState_userId_provider_modelName_key" ON "ModelQuotaState"("userId", "provider", "modelName");

-- AddForeignKey
ALTER TABLE "ModelQuotaState" ADD CONSTRAINT "ModelQuotaState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

