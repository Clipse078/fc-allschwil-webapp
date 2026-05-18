-- AlterEnum: Add TEMPLATES to PermissionModule
--
-- ⚠️  PostgreSQL transaction caveat: ALTER TYPE ... ADD VALUE cannot run inside
--   a transaction block. Apply manually if prisma migrate deploy fails:
--     psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TEMPLATES';"
--   Then: npx prisma migrate resolve --applied 20260518220000_add_templates_permission_module
--
ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'TEMPLATES';
