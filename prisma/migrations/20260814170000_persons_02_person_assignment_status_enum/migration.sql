-- PERSONS-02-FIX: Create PersonAssignmentStatus enum and migrate status column.
--
-- Root cause: migration 20260814150000_persons_01_02_c1_dedicated_assignment_model
-- created PersonAssignment.status as TEXT (DEFAULT 'ACTIVE') instead of the
-- PersonAssignmentStatus enum type required by prisma/schema.prisma.
-- Prisma's generated queries cast values to "public.PersonAssignmentStatus",
-- which did not exist, causing DriverAdapterError on /dashboard/persons.
--
-- All columns, indexes, and foreign keys on PersonAssignment are correct.
-- Only the enum type and column cast are missing.
--
-- Correct ALTER sequence for PostgreSQL:
--   1. DROP DEFAULT first (prevents "cannot be cast automatically" error)
--   2. CREATE TYPE
--   3. ALTER COLUMN TYPE with explicit USING cast
--   4. SET DEFAULT with typed cast
--
-- Idempotent on both STAGE (0 rows, TEXT column) and fresh databases.

-- 1. Drop the existing text default before type change.
ALTER TABLE "PersonAssignment" ALTER COLUMN "status" DROP DEFAULT;

-- 2. Create the enum type (idempotent guard).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PersonAssignmentStatus') THEN
    CREATE TYPE "PersonAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
END $$;

-- 3. Alter status from TEXT to PersonAssignmentStatus.
--    USING casts existing TEXT values ('ACTIVE'/'INACTIVE') to enum labels.
ALTER TABLE "PersonAssignment"
  ALTER COLUMN "status" TYPE "PersonAssignmentStatus"
  USING "status"::"PersonAssignmentStatus";

-- 4. Restore the typed default.
ALTER TABLE "PersonAssignment"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"PersonAssignmentStatus";
