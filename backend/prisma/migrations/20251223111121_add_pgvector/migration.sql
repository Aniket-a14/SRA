/*
  Warnings:

  - You are about to drop the column `vectorSignature` on the `Analysis` table. All the data in the column will be lost.
  - You are about to add a new column `vectorSignature` to the `Analysis` table, which cannot be done if there is data, without a default value.
  
*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Analysis" DROP COLUMN "vectorSignature",
ADD COLUMN     "vectorSignature" vector(768);
