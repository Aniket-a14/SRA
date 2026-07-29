-- Refresh-token rotation used to retire the old token the moment the new one was written.
-- A rotation response the browser never received (closed tab, dropped mobile connection)
-- therefore left it holding a token the server had already invalidated, and the next refresh
-- signed the user out of a session with days left on it. These two columns keep the
-- superseded token valid until the replacement is observed in use. See sessionService.js.

ALTER TABLE "Session" ADD COLUMN "prevTokenHash" TEXT;
ALTER TABLE "Session" ADD COLUMN "successorConfirmed" BOOLEAN NOT NULL DEFAULT true;

-- Nullable + UNIQUE: Postgres permits many NULLs, so only sessions mid-rotation take a slot.
CREATE UNIQUE INDEX "Session_prevTokenHash_key" ON "Session"("prevTokenHash");
