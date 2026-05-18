-- AlterTable: Target — add visibility fields
-- Consistent with Meeting (20260518170000) and Initiative (20260518170000) patterns.
-- All columns nullable or NOT NULL DEFAULT — safe on populated tables.
-- Existing Target rows default to visibilityScope = 'ORGANISATION' (fully visible).
ALTER TABLE "Target"
  ADD COLUMN "visibilityScope"    "VisibilityScope" NOT NULL DEFAULT 'ORGANISATION',
  ADD COLUMN "createdByUserId"    TEXT,
  ADD COLUMN "visibleRoleRefs"    JSONB,
  ADD COLUMN "visibleUserRefs"    JSONB,
  ADD COLUMN "visibleTeamRefs"    JSONB,
  ADD COLUMN "visibleOrgUnitRefs" JSONB,
  ADD COLUMN "visiblePersonRefs"  JSONB;

-- CreateIndex
CREATE INDEX "Target_visibilityScope_idx" ON "Target"("visibilityScope");
