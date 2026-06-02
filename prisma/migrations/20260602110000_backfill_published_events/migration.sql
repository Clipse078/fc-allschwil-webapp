-- Publishing Safety Layer — Sprint 0
-- Backfill: mark already-visible events as PUBLISHED so they continue to
-- appear on public channels after the reviewStage = PUBLISHED gate is enforced.
--
-- Criteria for backfill:
--   • Event has at least one public-channel visibility flag set to TRUE
--     (websiteVisible OR infoboardVisible), meaning it was already being
--     served to external consumers before this gate was added.
--   • Event is in an active-serving status (not CANCELLED or ARCHIVED).
--   • Event is not already PUBLISHED and not REJECTED.
--
-- publishedAt is set to the event's createdAt if no explicit publishedAt
-- exists, providing a conservative audit-trail timestamp.
--
-- Safe to re-run: conditions exclude already-PUBLISHED rows.

UPDATE "Event"
SET
  "reviewStage"  = 'PUBLISHED',
  "publishedAt"  = COALESCE("publishedAt", "createdAt")
WHERE
  ("websiteVisible" = true OR "infoboardVisible" = true)
  AND "status" IN ('SCHEDULED', 'LIVE', 'COMPLETED', 'POSTPONED')
  AND "reviewStage" NOT IN ('PUBLISHED', 'REJECTED');
