-- Registrations V2: Assignment Workflow
-- Adds targetGroupId FK to Registration, enabling routing from
-- registration → target group → responsible person.
--
-- assignedToUserId was already in the schema from V1 (but blocked in the API).
-- This migration only adds the target group link.

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN "targetGroupId" TEXT;

-- CreateIndex
CREATE INDEX "Registration_targetGroupId_idx" ON "Registration"("targetGroupId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_targetGroupId_fkey"
  FOREIGN KEY ("targetGroupId") REFERENCES "TargetGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
