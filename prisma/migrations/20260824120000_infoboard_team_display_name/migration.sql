-- INFOBOARD-TEAMNAME-01A — optional Infoboard Screen 1 team display override
--
-- Adds Team.infoboardDisplayName as a nullable presentation-only field.
-- No existing rows are modified. No automatic renaming.

ALTER TABLE "Team" ADD COLUMN "infoboardDisplayName" TEXT;
