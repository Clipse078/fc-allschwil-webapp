-- CMS V2 Slice 9 (Check 8): ContentRevision restore tracking fields
--
-- Additive migration: adds isRestore and parentRevisionId to ContentRevision.
-- All existing revision records remain valid (isRestore defaults false, parentRevisionId NULL).
--
-- isRestore:         true when this revision was created by a restore action.
--                    Enables easy identification without parsing changeNote.
-- parentRevisionId:  FK to the source revision when isRestore = true.
--                    Enables: visual diffing, rollback chains, branching, merge history.

ALTER TABLE "ContentRevision" ADD COLUMN "isRestore"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContentRevision" ADD COLUMN "parentRevisionId" TEXT;

-- Self-referencing FK for restore chain
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_parentRevisionId_fkey"
  FOREIGN KEY ("parentRevisionId") REFERENCES "ContentRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for filtering restore revisions
CREATE INDEX "ContentRevision_isRestore_idx" ON "ContentRevision"("isRestore");
