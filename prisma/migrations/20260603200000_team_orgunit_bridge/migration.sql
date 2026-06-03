-- Slice 11.3: Team ↔ OrgUnit bridge
-- Adds optional orgUnitId FK on Team, with SET NULL on OrgUnit delete.

ALTER TABLE "Team" ADD COLUMN "orgUnitId" TEXT;

ALTER TABLE "Team"
  ADD CONSTRAINT "Team_orgUnitId_fkey"
  FOREIGN KEY ("orgUnitId")
  REFERENCES "OrgUnit"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "Team_orgUnitId_idx" ON "Team"("orgUnitId");
