-- PUB-SEASON-BACKFILL-01: FC Allschwil historical SFV match season assignment.
--
-- 204 SFV-imported MATCH events were created before the 2026/2027 Season
-- record existed and therefore have seasonId = NULL.  This migration assigns
-- the canonical 2026/2027 season to all of them.
--
-- Invariants verified before authoring this migration:
--   - Exactly one Season with key = '2026/2027' exists:
--       id = cmso85qmu000004l5d3q0xbi4
--       startDate = 2026-07-01, endDate = 2027-06-30
--   - FC Allschwil tenant (key = 'fc-allschwil') id = cmomwboak0000tsf3zzivrs46
--   - All 204 null-season MATCH events for this tenant fall within
--     [2026-07-01, 2027-06-30] — zero events fall outside the boundaries.
--   - All 204 events have source = SFV and wochenplanVisible = false.
--     wochenplanVisible is intentionally false on SFV matches and is NOT
--     changed by this migration.
--
-- Scope:
--   - Only Event.seasonId is written.
--   - type, source, websiteVisible, wochenplanVisible, homepageVisible,
--     infoboardVisible, and all other fields are left untouched.
--   - Scoped to tenantId = fc-allschwil only; no other tenant is touched.
--   - Idempotent: WHERE seasonId IS NULL ensures a retry assigns nothing twice.

UPDATE "Event"
SET    "seasonId" = (
         SELECT "id"
         FROM   "Season"
         WHERE  "key" = '2026/2027'
       )
WHERE  "type"      = 'MATCH'
  AND  "seasonId"  IS NULL
  AND  "tenantId"  = (SELECT "id" FROM "Tenant" WHERE "key" = 'fc-allschwil')
  AND  "startAt"  >= '2026-07-01'::date
  AND  "startAt"  <  '2027-07-01'::date;
