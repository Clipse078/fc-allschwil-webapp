-- Migration: 20260818110000_person_ux_03_domain_permissions
--
-- PERSON-UX-03: Granular Person-domain permission keys.
--
-- Introduces 11 new TENANT-scoped, grantableByAdmin=true Permission records
-- for sensitive Person domains. Generic people.view alone does NOT grant
-- access to any of these domains — every grant is a deliberate, configurable
-- RolePermission assignment through the existing role-management UI.
--
-- Domain → permission mapping (canonical boundary for AUDIT-01):
--   Development / assessments → people.development.view / .manage
--   Assessments sub-type      → people.assessments.view  / .manage
--   Health / medical          → people.health.view        / .manage
--   Finance                   → people.finance.view       / .manage
--   Private documents         → people.private_documents.view / .manage
--   Audit history             → people.audit.view
--
-- All keys: module = 'PEOPLE', scope = 'TENANT', grantableByAdmin = true.
-- Uses ON CONFLICT DO NOTHING — idempotent if re-run or if seed ran first.
--
-- Note: the Permission table uses an existing PEOPLE enum value for module,
-- so no schema/enum migration is required.

INSERT INTO "Permission" ("id", "key", "name", "module", "scope", "grantableByAdmin", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'people.development.view',         'View person development data',     'PEOPLE', 'TENANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'people.development.manage',       'Manage person development data',   'PEOPLE', 'TENANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'people.assessments.view',         'View person assessments',          'PEOPLE', 'TENANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'people.assessments.manage',       'Manage person assessments',        'PEOPLE', 'TENANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'people.health.view',              'View person health data',          'PEOPLE', 'TENANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'people.health.manage',            'Manage person health data',        'PEOPLE', 'TENANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'people.finance.view',             'View person finance data',         'PEOPLE', 'TENANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'people.finance.manage',           'Manage person finance data',       'PEOPLE', 'TENANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'people.private_documents.view',  'View person private documents',    'PEOPLE', 'TENANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'people.private_documents.manage','Manage person private documents',  'PEOPLE', 'TENANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'people.audit.view',              'View person audit history',        'PEOPLE', 'TENANT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
