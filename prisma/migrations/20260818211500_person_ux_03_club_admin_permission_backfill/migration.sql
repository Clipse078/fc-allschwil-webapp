-- PERSON-UX-08C
--
-- Backfill the 11 PERSON-UX-03 sensitive Person-domain permissions
-- to already-materialized tenant Club Admin roles.
--
-- PERSON-UX-03 created the Permission rows, but existing tenant
-- Club Admin roles are materialized Role records and therefore do
-- not automatically acquire permissions introduced later.
--
-- Canonical tenant Club Admin key shape:
--   club_admin__<tenantKey>
--
-- Authorization remains explicit:
-- - people.view does NOT imply sensitive-domain access
-- - no Trainer / Coordinator / normal tenant role is changed
-- - no tenant-specific special case
--
-- Idempotent via the RolePermission unique constraint.

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  gen_random_uuid()::text,
  r."id",
  p."id",
  CURRENT_TIMESTAMP
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."key" LIKE 'club_admin__%'
  AND p."key" IN (
    'people.development.view',
    'people.development.manage',
    'people.assessments.view',
    'people.assessments.manage',
    'people.health.view',
    'people.health.manage',
    'people.finance.view',
    'people.finance.manage',
    'people.private_documents.view',
    'people.private_documents.manage',
    'people.audit.view'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;