-- AlterEnum: Add ORG to PermissionModule
-- Introduces dedicated org permissions (org.view, org.manage) so that
-- Organisation / Org Unit access is no longer gated by users.manage.
--
-- ⚠️  ALTER TYPE … ADD VALUE cannot run inside a transaction block.
--     If prisma migrate deploy fails here, apply manually:
--
--     psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'ORG';"
--     npx prisma migrate resolve --applied 20260603160000_add_org_permission_module

ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'ORG';
