-- WEBSITE-CONSUMERS-01F-A: OrgUnit key and name corrections for FC Allschwil.
--
-- Two OrgUnit records were created with typos in the key and name fields.
-- These typos cause the FC Allschwil website to fail to match the canonical
-- OrgUnit key strings, routing all affected teams into "Trainingsgruppe".
--
-- Corrections (tenant: fc-allschwil):
--   1. "akitve" / "Akitve"     → "aktive" / "Aktive"
--   2. "kinderfussbal" / "Kinderfussbal" → "kinderfussball" / "Kinderfussball"
--
-- Safety:
--   - OrgUnit.id is unchanged — all TeamSeasonOrgUnit and Team.orgUnitId
--     relations remain intact (they reference id, not key).
--   - @@unique([tenantId, key]) constraint is satisfied: neither "aktive"
--     nor "kinderfussball" exists for this tenant before this migration.
--   - The UPDATE is scoped by both tenantId and the current (typo'd) key
--     to prevent accidental updates to other tenants or other records.

UPDATE "OrgUnit"
SET    "key"  = 'aktive',
       "name" = 'Aktive'
WHERE  "key"      = 'akitve'
  AND  "tenantId" = (SELECT "id" FROM "Tenant" WHERE "key" = 'fc-allschwil');

UPDATE "OrgUnit"
SET    "key"  = 'kinderfussball',
       "name" = 'Kinderfussball'
WHERE  "key"      = 'kinderfussbal'
  AND  "tenantId" = (SELECT "id" FROM "Tenant" WHERE "key" = 'fc-allschwil');
