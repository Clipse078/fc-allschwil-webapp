-- Week Planner V1: Pitch + Dressing-Room Allocation Fields
-- Adds three nullable text columns to Event for facility allocation persistence.
-- No destructive changes. All existing rows get NULL (unallocated).
--
-- pitchCode:            PitchAllocationCode value (e.g. "STADION_A", "KUNSTRASEN_2")
-- homeDressingRoomCode: DressingRoomCode value (e.g. "E1")
-- awayDressingRoomCode: DressingRoomCode value (e.g. "O1") — populated for matches

-- AlterTable
ALTER TABLE "Event"
  ADD COLUMN "pitchCode"            TEXT,
  ADD COLUMN "homeDressingRoomCode" TEXT,
  ADD COLUMN "awayDressingRoomCode" TEXT;

-- CreateIndex
CREATE INDEX "Event_pitchCode_idx" ON "Event"("pitchCode");
