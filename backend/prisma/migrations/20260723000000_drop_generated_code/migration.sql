-- Frontend rehaul: the Code Assets feature (codeGenService.js, the Code Assets tab,
-- and the POST /:id/code endpoint) was removed as a user-facing feature per explicit
-- product decision. This drops the now-unused Analysis.generatedCode column.
--
-- NOT YET APPLIED to any database -- same policy as the Phase 3 migration: review,
-- then apply with `prisma migrate deploy` once you've confirmed you don't need the
-- historical generatedCode JSON blobs for anything (they are not read anywhere in
-- the codebase after this change).

ALTER TABLE "Analysis" DROP COLUMN "generatedCode";
