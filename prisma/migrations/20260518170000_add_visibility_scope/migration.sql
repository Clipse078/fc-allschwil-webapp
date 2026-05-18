-- CreateEnum: VisibilityScope
-- Safe: new enum created with CREATE TYPE (not ALTER TYPE ADD VALUE).
-- No transaction restriction.
CREATE TYPE "VisibilityScope" AS ENUM ('ORGANISATION', 'RESTRICTED', 'PRIVATE');

-- AlterTable: Meeting — add visibility fields
-- All columns nullable or NOT NULL with DEFAULT → safe on populated tables.
ALTER TABLE "Meeting"
  ADD COLUMN "visibilityScope"    "VisibilityScope" NOT NULL DEFAULT 'ORGANISATION',
  ADD COLUMN "createdByUserId"    TEXT,
  ADD COLUMN "visibleRoleRefs"    JSONB,
  ADD COLUMN "visibleUserRefs"    JSONB,
  ADD COLUMN "visibleTeamRefs"    JSONB,
  ADD COLUMN "visibleOrgUnitRefs" JSONB,
  ADD COLUMN "visiblePersonRefs"  JSONB;

-- AlterTable: Initiative — add visibility fields
ALTER TABLE "Initiative"
  ADD COLUMN "visibilityScope"    "VisibilityScope" NOT NULL DEFAULT 'ORGANISATION',
  ADD COLUMN "createdByUserId"    TEXT,
  ADD COLUMN "visibleRoleRefs"    JSONB,
  ADD COLUMN "visibleUserRefs"    JSONB,
  ADD COLUMN "visibleTeamRefs"    JSONB,
  ADD COLUMN "visibleOrgUnitRefs" JSONB,
  ADD COLUMN "visiblePersonRefs"  JSONB;

-- CreateIndex
CREATE INDEX "Meeting_visibilityScope_idx"    ON "Meeting"("visibilityScope");
CREATE INDEX "Initiative_visibilityScope_idx" ON "Initiative"("visibilityScope");
