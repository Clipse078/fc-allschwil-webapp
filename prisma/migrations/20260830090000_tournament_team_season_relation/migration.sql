-- TEAM-PUBLIC-NEXT-EVENT-01A
-- Add the canonical, nullable TeamSeason owner for tournament Events.
--
-- Backfill safety:
--   * only TOURNAMENT rows are considered;
--   * Event.teamId, Event.seasonId, and Event.tenantId must all be present;
--   * TeamSeason must match the exact (teamId, seasonId) pair;
--   * the Team owning that TeamSeason must belong to Event.tenantId;
--   * HAVING COUNT(*) = 1 fails closed if legacy constraints ever permit
--     multiple candidates.
-- Every unresolved or ambiguous Event intentionally remains NULL.

-- AddColumn
ALTER TABLE "Event" ADD COLUMN "teamSeasonId" TEXT;

-- Backfill only exact, tenant-safe, unambiguous legacy mappings.
WITH "UnambiguousTournamentTeamSeason" AS (
  SELECT
    e."id" AS "eventId",
    MIN(ts."id") AS "teamSeasonId"
  FROM "Event" e
  INNER JOIN "TeamSeason" ts
    ON ts."teamId" = e."teamId"
   AND ts."seasonId" = e."seasonId"
  INNER JOIN "Team" t
    ON t."id" = ts."teamId"
   AND t."tenantId" = e."tenantId"
  WHERE e."type" = 'TOURNAMENT'
    AND e."teamSeasonId" IS NULL
    AND e."teamId" IS NOT NULL
    AND e."seasonId" IS NOT NULL
    AND e."tenantId" IS NOT NULL
  GROUP BY e."id"
  HAVING COUNT(ts."id") = 1
)
UPDATE "Event" e
SET "teamSeasonId" = candidate."teamSeasonId"
FROM "UnambiguousTournamentTeamSeason" candidate
WHERE e."id" = candidate."eventId"
  AND e."teamSeasonId" IS NULL;

-- CreateIndex
CREATE INDEX "Event_tenantId_teamSeasonId_type_startAt_idx"
  ON "Event"("tenantId", "teamSeasonId", "type", "startAt");

-- AddForeignKey
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_teamSeasonId_fkey"
  FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
