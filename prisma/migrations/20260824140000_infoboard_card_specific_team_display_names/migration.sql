-- INFOBOARD-TEAMNAME-04A — card-type-specific Infoboard team display names
--
-- Adds nullable presentation-only Team fields for Training, Match, and
-- Tournament Infoboard cards. No existing rows are modified.

ALTER TABLE "Team" ADD COLUMN "infoboardTrainingDisplayName" TEXT;
ALTER TABLE "Team" ADD COLUMN "infoboardMatchDisplayName" TEXT;
ALTER TABLE "Team" ADD COLUMN "infoboardTournamentDisplayName" TEXT;
