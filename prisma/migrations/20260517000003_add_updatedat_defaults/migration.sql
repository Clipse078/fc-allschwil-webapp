-- Non-destructive: add DB-level DEFAULT CURRENT_TIMESTAMP to all @updatedAt
-- columns that were created without a default by the init migration.
-- Existing rows are unaffected. New INSERT/UPDATE that omit updatedAt
-- will receive the current timestamp from the DB rather than failing
-- with a NOT NULL constraint violation.

ALTER TABLE "Team"       ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Season"     ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Event"      ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TeamSeason" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Cover remaining @updatedAt models that may also lack a DB-level default
ALTER TABLE "User"                         ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Role"                         ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RoleWorkflowRule"             ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "RoleWorkflowReviewAssignment" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PlayerSquadMember"            ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TrainerTeamMember"            ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "EventImportRun"               ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Tenant"                       ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UserTenant"                   ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
